import { describe, expect, it } from "vitest";

import { deleteArchive, importArchiveBackup, loadArchives, saveArchive, serializeArchiveBackup } from "./archive-store";
import { makeAnalysisResponse } from "./test/analysis-fixture";
import type { AnalysisWorkspaceSnapshot } from "./types";

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
    const archive = saveArchive(workspace, memoryStorage())[0]!;
    expect(archive.title).toBe("小林 · 甲寅日 × 阿青 · 乙卯日 · 关系画像");
  });

  it("ignores corrupted or response-invalid browser data", () => {
    const malformed = memoryStorage("not-json");
    expect(loadArchives(malformed)).toEqual([]);

    const invalid = memoryStorage(JSON.stringify({
      version: 1,
      archives: [{ id: "bad", title: "bad", savedAt: new Date().toISOString(), rulesetDigest: "x", workspace: { result: {} } }],
    }));
    expect(loadArchives(invalid)).toEqual([]);
  });

  it("upgrades legacy v1 subjects to an explicit manual input source", () => {
    const workspace = makeWorkspace();
    delete workspace.primarySubject.birthInput;
    delete workspace.secondarySubject.birthInput;
    const archive = saveArchive(workspace, memoryStorage(), new Date("2026-08-30T01:00:00Z"))[0]!;
    const storage = memoryStorage(JSON.stringify({ version: 1, archives: [archive] }));
    const restored = loadArchives(storage)[0]!;
    expect(restored.workspace.primarySubject.birthInput).toEqual({ method: "manual_four_pillars" });
    expect(restored.workspace.secondarySubject.birthInput).toEqual({ method: "manual_four_pillars" });
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
    const newer = importArchiveBackup(newerBackup, destination);
    expect(newer).toMatchObject({ added: 0, updated: 1, skipped: 0 });
    expect(newer.archives[0]?.savedAt).toBe("2026-08-30T04:00:00.000Z");
  });

  it("rejects unknown, duplicated, oversized, or response-invalid backups without mutating storage", () => {
    const storage = memoryStorage();
    const current = saveArchive(makeWorkspace(), storage);
    const valid = JSON.parse(serializeArchiveBackup(current)) as Record<string, unknown>;
    const before = storage.value();

    expect(() => importArchiveBackup("not-json", storage)).toThrow("不是有效的 JSON");
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, schema: "future" }), storage)).toThrow("版本不受支持");
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: Array.from({ length: 21 }, () => current[0]) }), storage)).toThrow("数量超过 20");
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [current[0], current[0]] }), storage)).toThrow("重复档案");
    const invalidResponse = structuredClone(current[0]!);
    invalidResponse.workspace.result = { rulesetDigest: invalidResponse.rulesetDigest } as typeof invalidResponse.workspace.result;
    expect(() => importArchiveBackup(JSON.stringify({ ...valid, archives: [invalidResponse] }), storage)).toThrow("分析结果无效");
    expect(storage.value()).toBe(before);
  });
});

function makeWorkspace(): AnalysisWorkspaceSnapshot {
  return {
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
}

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: (_key: string) => value,
    setItem: (_key: string, next: string) => { value = next; },
    value: () => value,
  };
}
