import { describe, expect, it } from "vitest";

import { deleteArchive, importArchiveBackup, loadArchives, previewArchiveBackup, renameArchive, saveArchive, serializeArchiveBackup, serializeReadingPackage } from "./archive-store";
import { analysisInputFingerprint, m0InputFingerprint, riskCandidateFingerprint } from "./domain";
import { makeAnalysisResponse, makeM0AnalysisResponse } from "./test/analysis-fixture";
import type { AnalysisArchive, AnalysisWorkspaceSnapshot, M0WorkspaceSnapshot } from "./types";

describe("local analysis archive", () => {
  it("round-trips a complete workspace and replaces the same analysis instead of duplicating it", () => {
    const storage = memoryStorage();
    const workspace = makeWorkspace();
    expect(saveArchive(workspace, storage, new Date("2026-08-30T01:00:00Z"))).toHaveLength(1);
    const archives = saveArchive(workspace, storage, new Date("2026-08-30T02:00:00Z"));
    expect(archives).toHaveLength(1);
    expect(archives[0]?.savedAt).toBe("2026-08-30T02:00:00.000Z");
    expect(archives[0]?.title).toBe("主命盘 · 甲寅日 · 关系画像");
    expect(archives[0]?.workspace).toEqual(workspace);
    expect(archives[0]?.workspace).not.toBe(workspace);
  });

  it("names a two-chart archive with both user labels", () => {
    const workspace = makeWorkspace();
    workspace.primarySubject.subjectId = "小林";
    workspace.secondarySubject.subjectId = "阿青";
    workspace.hasSecondarySubject = true;
    workspace.result.relationship.structuralSupplement = { ...workspace.result.relationship.structuralSupplement, available: true, fields: {} };
    workspace.resultInputFingerprint = analysisInputFingerprint(workspace);
    const archive = saveArchive(workspace, memoryStorage())[0]!;
    expect(archive.title).toBe("小林 · 甲寅日 × 阿青 · 乙卯日 · 关系画像");
  });

  it("ignores corrupted or response-invalid browser data", () => {
    const malformed = memoryStorage("not-json");
    expect(loadArchives(malformed)).toEqual([]);
    const before = malformed.value();
    expect(() => saveArchive(makeWorkspace(), malformed)).toThrow("已停止写入以避免覆盖");
    expect(malformed.value()).toBe(before);

    const invalid = memoryStorage(JSON.stringify({
      version: 1,
      archives: [{ id: "bad", title: "bad", savedAt: new Date().toISOString(), rulesetDigest: "x", workspace: { result: {} } }],
    }));
    expect(loadArchives(invalid)).toEqual([]);

    const validArchive = saveArchive(makeWorkspace(), memoryStorage())[0]!;
    const duplicated = memoryStorage(JSON.stringify({ version: 1, archives: [validArchive, validArchive] }));
    expect(loadArchives(duplicated)).toEqual([]);
    expect(() => saveArchive(makeWorkspace(), duplicated)).toThrow("已停止写入以避免覆盖");
    const oversized = Array.from({ length: 21 }, (_, index) => {
      const archive = structuredClone(validArchive);
      archive.id = `archive-over-${index}`;
      archive.workspace.result.requestId = `over-${index}`;
      return archive;
    });
    expect(loadArchives(memoryStorage(JSON.stringify({ version: 1, archives: oversized })))).toEqual([]);
  });

  it("upgrades legacy v1 subjects to an explicit manual input source", () => {
    const workspace = makeWorkspace();
    const archive = relationshipArchive(saveArchive(workspace, memoryStorage(), new Date("2026-08-30T01:00:00Z"))[0]!);
    archive.workspace.primarySubject.birthTimeStatus = "unknown";
    archive.workspace.primarySubject.hour = "庚午";
    archive.workspace.primarySubject.birthInput = {
      method: "solar_utc8_assist", solarLocalDateTime: "1986-05-29T12:00", resolutionStatus: "resolved", resolvedPillars: "丙寅 癸巳 癸酉 戊午",
      adapter: { id: "lunar-typescript-standard-time", version: "1.8.6", civilTimeBasis: "UTC+08:00", trueSolarTimeApplied: false },
    };
    archive.workspace.hasSecondarySubject = false;
    archive.workspace.secondarySubject.subjectId = "不应保留的旧另一方";
    archive.workspace.secondarySubject.birthInput = {
      method: "solar_utc8_assist", solarLocalDateTime: "1991-02-03T04:05", resolutionStatus: "not_calculated", resolvedPillars: null,
      adapter: { id: "lunar-typescript-standard-time", version: "1.8.6", civilTimeBasis: "UTC+08:00", trueSolarTimeApplied: false },
    };
    delete archive.workspace.resultInputFingerprint;
    archive.workspace.gates[0] = { ...archive.workspace.gates[0]!, status: "pass", note: "画像模式不应保留的闸门事实" };
    archive.workspace.crossState.steady = true;
    archive.workspace.crossState.evidence.steady = "画像模式不应保留的跨情境事实";
    archive.workspace.crossState.evidence.pressure = "未勾选但遗留的隐藏事实";
    archive.workspace.observations = [{
      chainId: "M4-C01", slot: 0, source: "self_report", context: "画像模式不应保留的风险观察", direction: "supports",
      basisFingerprint: "legacy", candidateFingerprint: "legacy", basisRequestId: archive.workspace.result.requestId,
    }];
    const storage = memoryStorage(JSON.stringify({ version: 1, archives: [archive] }));
    const restored = relationshipArchive(loadArchives(storage)[0]!);
    expect(restored.workspace.primarySubject.birthInput).toEqual({ method: "manual_four_pillars" });
    expect(restored.workspace.primarySubject.hour).toBe("甲子");
    expect(restored.workspace.secondarySubject).toMatchObject({ subjectId: "另一方", birthInput: { method: "manual_four_pillars" } });
    expect(JSON.stringify(restored)).not.toContain("1991-02-03T04:05");
    expect(restored.workspace.gates[0]).toMatchObject({ status: "not_assessed", note: "" });
    expect(restored.workspace.crossState).toMatchObject({ steady: false, evidence: { steady: "", pressure: "" } });
    expect(restored.workspace.observations).toEqual([]);
    expect(restored.workspace.crossState.evidence.pressure).toBe("");
    expect(restored.workspace.resultInputFingerprint).toBe(analysisInputFingerprint(restored.workspace));

    const hiddenDraft = makeWorkspace();
    hiddenDraft.crossState.evidence.pressure = "不应保存的隐藏事实";
    hiddenDraft.resultInputFingerprint = analysisInputFingerprint(hiddenDraft);
    expect(relationshipArchive(saveArchive(hiddenDraft, memoryStorage())[0]!).workspace.crossState.evidence.pressure).toBe("");
  });

  it("deletes only the selected archive", () => {
    const storage = memoryStorage();
    const first = makeWorkspace();
    const second = { ...makeWorkspace(), result: { ...makeAnalysisResponse(), requestId: "request-second" } };
    saveArchive(first, storage);
    const two = saveArchive(second, storage);
    const remaining = deleteArchive(two[1]!.id, storage);
    expect(remaining.map((item) => item.id)).toEqual(["archive-request-second"]);
  });

  it("renames the selected archive and records it as the newest backup version", () => {
    const storage = memoryStorage();
    const first = saveArchive(makeWorkspace(), storage, new Date("2026-08-30T01:00:00Z"));
    saveArchive(workspaceWithRequestId("request-second"), storage, new Date("2026-08-30T02:00:00Z"));
    const renamed = renameArchive(first[0]!.id, "  小林   长期观察  ", storage, new Date("2026-08-30T03:00:00Z"));
    expect(renamed[0]).toMatchObject({ id: first[0]!.id, title: "小林 长期观察", titleCustomized: true, savedAt: "2026-08-30T03:00:00.000Z" });
    const updated = saveArchive(makeWorkspace(), storage, new Date("2026-08-30T04:00:00Z"));
    expect(updated[0]).toMatchObject({ title: "小林 长期观察", titleCustomized: true, savedAt: "2026-08-30T04:00:00.000Z" });
    expect(() => renameArchive(first[0]!.id, "   ", storage)).toThrow("不能为空");
    expect(loadArchives(storage)[0]?.title).toBe("小林 长期观察");
  });

  it("never evicts an existing archive when the 20-item limit is reached", () => {
    const storage = memoryStorage();
    for (let index = 0; index < 20; index += 1) saveArchive(workspaceWithRequestId(`request-${index}`), storage);
    const before = storage.value();
    expect(() => saveArchive(workspaceWithRequestId("request-20"), storage)).toThrow("档案已满 20 份");
    expect(storage.value()).toBe(before);

    const updated = saveArchive(workspaceWithRequestId("request-0"), storage, new Date("2026-08-30T05:00:00Z"));
    expect(updated).toHaveLength(20);
    expect(updated[0]?.id).toBe("archive-request-0");
  });

  it("keeps all local archives when an import exceeds remaining capacity", () => {
    const destination = memoryStorage();
    for (let index = 0; index < 20; index += 1) saveArchive(workspaceWithRequestId(`local-${index}`), destination);
    const beforeIds = loadArchives(destination).map((archive) => archive.id).sort();
    const source = memoryStorage();
    const incoming = saveArchive(workspaceWithRequestId("incoming"), source);
    const imported = importArchiveBackup(serializeArchiveBackup(incoming), destination);
    expect(imported).toMatchObject({ added: 0, updated: 0, skipped: 1 });
    expect(imported.archives.map((archive) => archive.id).sort()).toEqual(beforeIds);
  });

  it("exports a self-describing backup and imports new and newer records", () => {
    const source = memoryStorage();
    const first = saveArchive(makeWorkspace(), source, new Date("2026-08-30T01:00:00Z"));
    const backup = serializeArchiveBackup(first, new Date("2026-08-30T02:00:00Z"));
    expect(JSON.parse(backup)).toMatchObject({
      schema: "bazi.relationship.archive-backup.v1",
      exportedAt: "2026-08-30T02:00:00.000Z",
      containsSensitiveData: true,
    });

    const destination = memoryStorage();
    const added = importArchiveBackup(backup, destination);
    expect(added).toMatchObject({ added: 1, updated: 0, skipped: 0 });

    saveArchive(makeWorkspace(), destination, new Date("2026-08-30T03:00:00Z"));
    const older = importArchiveBackup(backup, destination);
    expect(older).toMatchObject({ added: 0, updated: 0, skipped: 1 });

    const newerBackup = serializeArchiveBackup(saveArchive(makeWorkspace(), source, new Date("2026-08-30T04:00:00Z")));
    const beforePreview = destination.value();
    expect(previewArchiveBackup(newerBackup, destination)).toMatchObject({ added: 0, updated: 1, skipped: 0 });
    expect(destination.value()).toBe(beforePreview);
    const newer = importArchiveBackup(newerBackup, destination);
    expect(newer).toMatchObject({ added: 0, updated: 1, skipped: 0 });
    expect(newer.archives[0]?.savedAt).toBe("2026-08-30T04:00:00.000Z");

    const readingStorage = memoryStorage();
    const reading = serializeReadingPackage(makeWorkspace(), new Date("2026-08-30T05:00:00Z"));
    expect(JSON.parse(reading)).toMatchObject({ schema: "bazi.relationship.reading.v1", exportedAt: "2026-08-30T05:00:00.000Z", containsSensitiveData: true });
    expect(previewArchiveBackup(reading, readingStorage)).toMatchObject({ added: 1, updated: 0, skipped: 0 });
    expect(readingStorage.value()).toBeNull();
    expect(importArchiveBackup(reading, readingStorage)).toMatchObject({ added: 1, updated: 0, skipped: 0 });
    expect(loadArchives(readingStorage)[0]?.workspace.result.requestId).toBe(makeWorkspace().result.requestId);
  });

  it("saves, restores, and imports standalone M0 archives through the same protected store", () => {
    const source = memoryStorage();
    const saved = saveArchive(makeM0Workspace(), source, new Date("2026-08-30T06:00:00Z"));
    expect(saved[0]).toMatchObject({ title: "主命盘 · 甲寅日 · 原局结构", workspace: { analysisMode: "structure" } });
    expect(loadArchives(source)[0]?.workspace.analysisMode).toBe("structure");

    const mixed = saveArchive(makeWorkspace(), source, new Date("2026-08-30T07:00:00Z"));
    const destination = memoryStorage();
    expect(importArchiveBackup(serializeArchiveBackup(mixed), destination)).toMatchObject({ added: 2, updated: 0, skipped: 0 });

    const reading = serializeReadingPackage(makeM0Workspace(), new Date("2026-08-30T08:00:00Z"));
    expect(JSON.parse(reading)).toMatchObject({ schema: "bazi.m0.reading.v1", workspace: { analysisMode: "structure" } });
    expect(previewArchiveBackup(reading, memoryStorage())).toMatchObject({ added: 1, updated: 0, skipped: 0 });

    const legacyWorkspace = makeM0Workspace();
    const legacyReading = JSON.stringify({
      schema: "bazi.m0.reading.v1", exportedAt: "2026-08-30T08:00:00.000Z", containsSensitiveData: true,
      resultInputFingerprint: "legacy-ui-fingerprint", subject: legacyWorkspace.primarySubject, result: legacyWorkspace.result,
    });
    expect(importArchiveBackup(legacyReading, memoryStorage())).toMatchObject({ added: 1, updated: 0, skipped: 0 });

    const mismatched = JSON.parse(reading) as { workspace: M0WorkspaceSnapshot };
    mismatched.workspace.primarySubject.subjectId = "被拼接的命盘";
    expect(() => importArchiveBackup(JSON.stringify(mismatched), memoryStorage())).toThrow("输入与分析结果不一致");
  });

  it("rejects unknown, duplicated, oversized, or response-invalid backups without mutating storage", () => {
    const storage = memoryStorage();
    const current = saveArchive(makeWorkspace(), storage).map(relationshipArchive);
    const valid = JSON.parse(serializeArchiveBackup(current)) as Record<string, unknown>;
    const before = storage.value();

    expect(() => importArchiveBackup("not-json", storage)).toThrow("不是有效的 JSON");
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, schema: "future" }), storage)).toThrow("版本不受支持");
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, hiddenPayload: "不应随备份传播" }), storage)).toThrow("包含未声明字段");
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: Array.from({ length: 21 }, () => current[0]) }), storage)).toThrow("数量超过 20");
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [current[0], current[0]] }), storage)).toThrow("重复档案");
    const invalidResponse = structuredClone(current[0]!);
    invalidResponse.workspace.result = { rulesetDigest: invalidResponse.rulesetDigest } as typeof invalidResponse.workspace.result;
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [invalidResponse] }), storage)).toThrow("分析结果无效");
    const mismatchedIdentity = structuredClone(current[0]!);
    mismatchedIdentity.id = "archive-other-request";
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [mismatchedIdentity] }), storage)).toThrow("身份无效");
    const mismatchedInput = structuredClone(current[0]!);
    mismatchedInput.workspace.primarySubject.subjectId = "被拼接的另一命盘";
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [mismatchedInput] }), storage)).toThrow("输入与分析结果不一致");
    const hiddenSubjectField = structuredClone(current[0]!);
    (hiddenSubjectField.workspace.primarySubject as unknown as Record<string, unknown>).privateMemo = "未声明的敏感信息";
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [hiddenSubjectField] }), storage)).toThrow("档案结构无效");
    const mismatchedSupplement = structuredClone(current[0]!);
    mismatchedSupplement.workspace.hasSecondarySubject = true;
    mismatchedSupplement.workspace.resultInputFingerprint = analysisInputFingerprint(mismatchedSupplement.workspace);
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [mismatchedSupplement] }), storage)).toThrow("输入与分析结果不一致");
    const duplicatedObservation = structuredClone(current[0]!);
    duplicatedObservation.workspace.analysisMode = "evaluate";
    duplicatedObservation.workspace.resultInputFingerprint = analysisInputFingerprint(duplicatedObservation.workspace);
    const chain = duplicatedObservation.workspace.result.relationship.m4.riskChains[0]!;
    const observation = {
      chainId: chain.id,
      slot: 0 as const,
      source: "self_report" as const,
      context: "压力下的现实观察",
      direction: "supports" as const,
      basisFingerprint: duplicatedObservation.workspace.resultInputFingerprint,
      candidateFingerprint: riskCandidateFingerprint(chain),
      basisRequestId: duplicatedObservation.workspace.result.requestId,
    };
    duplicatedObservation.workspace.observations = [observation, { ...observation, context: "重复占用同一观察槽" }];
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [duplicatedObservation] }), storage)).toThrow("输入与分析结果不一致");
    duplicatedObservation.workspace.observations = [{ ...observation, basisRequestId: "another-request" }];
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [duplicatedObservation] }), storage)).toThrow("输入与分析结果不一致");
    expect(storage.value()).toBe(before);
  });
});

function makeWorkspace(): AnalysisWorkspaceSnapshot {
  const workspace: AnalysisWorkspaceSnapshot = {
    analysisMode: "profile",
    roleBasis: "female_traditional",
    primarySubject: { subjectId: "主命盘", year: "庚申", month: "己丑", day: "甲寅", hour: "庚午", birthTimeStatus: "exact", dataQuality: "high", birthInput: { method: "manual_four_pillars" } },
    secondarySubject: { subjectId: "另一方", year: "己巳", month: "丙寅", day: "乙卯", hour: "丙子", birthTimeStatus: "exact", dataQuality: "high", birthInput: { method: "manual_four_pillars" } },
    hasSecondarySubject: false,
    gates: ["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"].map((id, index) => ({ id: id as `RG0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`, label: `闸门 ${index + 1}`, status: "not_assessed", note: "" })),
    crossState: { steady: false, pressure: false, repair: false, turningPoint: false, counterevidenceReviewed: false, evidence: { steady: "", pressure: "", repair: "", turningPoint: "", counterevidenceReviewed: "" } },
    observations: [],
    result: makeAnalysisResponse(),
  };
  workspace.resultInputFingerprint = analysisInputFingerprint(workspace);
  return workspace;
}

function workspaceWithRequestId(requestId: string): AnalysisWorkspaceSnapshot {
  const workspace = makeWorkspace();
  workspace.result = { ...workspace.result, requestId };
  return workspace;
}

function makeM0Workspace(): M0WorkspaceSnapshot {
  const primarySubject = { subjectId: "主命盘", year: "庚申", month: "己丑", day: "甲寅", hour: "庚午", birthTimeStatus: "exact" as const, dataQuality: "high" as const, birthInput: { method: "manual_four_pillars" as const } };
  return { analysisMode: "structure", resultInputFingerprint: m0InputFingerprint(primarySubject), primarySubject, result: makeM0AnalysisResponse() };
}

function relationshipArchive(archive: AnalysisArchive): AnalysisArchive & { workspace: AnalysisWorkspaceSnapshot } {
  if (archive.workspace.analysisMode === "structure") throw new Error("expected relationship archive");
  return archive as AnalysisArchive & { workspace: AnalysisWorkspaceSnapshot };
}

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: (_key: string) => value,
    setItem: (_key: string, next: string) => { value = next; },
    value: () => value,
  };
}
