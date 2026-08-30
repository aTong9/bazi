import { parseAnalysisResponse, parseM0AnalysisResponse } from "./api";
import { REALITY_GATES } from "./constants";
import { analysisInputFingerprint, hourOptions, inactiveSecondarySubject, JIAZI, m0InputFingerprint, monthOptions, riskCandidateFingerprint } from "./domain";
import type { AnalysisArchive, AnalysisWorkspaceSnapshot, ArchiveWorkspaceSnapshot, M0WorkspaceSnapshot, SubjectDraft } from "./types";
import { formatFourPillars, isCurrentCalendarAdapter, resolveSolarBirth } from "../../../packages/calendar/src/resolve-solar-birth";
import { birthInputDependencyFlags } from "../../../packages/domain/src/birth-input";

export const ARCHIVE_STORAGE_KEY = "bazi.relationship.archives.v1";
const MAX_ARCHIVES = 20;
const BACKUP_SCHEMA = "bazi.relationship.archive-backup.v1";
const READING_SCHEMA = "bazi.relationship.reading.v1";
const M0_READING_SCHEMA = "bazi.m0.reading.v1";
const CROSS_STATE_KEYS = ["steady", "pressure", "repair", "turningPoint", "counterevidenceReviewed"] as const;

interface ArchiveEnvelope { version: 1; archives: AnalysisArchive[] }
interface ArchiveBackup {
  schema: typeof BACKUP_SCHEMA;
  exportedAt: string;
  containsSensitiveData: true;
  archives: AnalysisArchive[];
}

export interface ArchiveImportResult {
  readonly archives: AnalysisArchive[];
  readonly added: number;
  readonly updated: number;
  readonly skipped: number;
}

export function archiveId(mode: ArchiveWorkspaceSnapshot["analysisMode"], requestId: string): string {
  return mode === "structure" ? `archive-m0-${requestId}` : `archive-${requestId}`;
}

export function loadArchives(storage: Pick<Storage, "getItem"> = localStorage): AnalysisArchive[] {
  return readArchives(storage, false);
}

export function recoverableArchiveStorage(storage: Pick<Storage, "getItem"> = localStorage): string | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return null;
    readArchives(storage, true);
    return null;
  } catch {
    return raw ?? null;
  }
}

function readArchives(storage: Pick<Storage, "getItem">, failOnInvalid: boolean): AnalysisArchive[] {
  let raw: string | null;
  try {
    if (typeof storage?.getItem !== "function") throw new Error();
    raw = storage.getItem(ARCHIVE_STORAGE_KEY);
  } catch {
    if (failOnInvalid) throw new Error("无法读取本机档案，已停止写入以保护现有数据。");
    return [];
  }
  if (!raw) return [];
  try {
    const envelope = JSON.parse(raw) as unknown;
    if (!isEnvelope(envelope)) throw new Error();
    return envelope.archives.map((archive) => {
      const migrated = migrateLegacyStructuralSupplement(archive);
      parseWorkspaceResult(migrated.workspace);
      if (!workspaceResultMatches(migrated.workspace)) throw new Error();
      return normalizeArchive(migrated);
    });
  } catch {
    if (failOnInvalid) throw new Error("本机档案数据已损坏，已停止写入以避免覆盖；请先导出浏览器存储以便恢复。");
    return [];
  }
}

export function saveArchive(
  workspace: ArchiveWorkspaceSnapshot,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  now = new Date(),
  expectedSavedAt?: string | null,
): AnalysisArchive[] {
  if (!isWorkspace(workspace)) throw new Error("当前工作区无法保存为有效档案。");
  parseWorkspaceResult(workspace);
  if (!workspaceResultMatches(workspace)) throw new Error("当前工作区输入与分析结果不一致，请重新生成分析。");
  const current = readArchives(storage, true);
  const existing = current.find((item) => item.id === archiveId(workspace.analysisMode, workspace.result.requestId));
  if (expectedSavedAt !== undefined && (existing?.savedAt ?? null) !== expectedSavedAt) {
    throw new Error("档案已在另一标签页更新，请重新确认较新版本后再保存。");
  }
  const archive = normalizeArchive({
    id: archiveId(workspace.analysisMode, workspace.result.requestId),
    title: existing?.titleCustomized ? existing.title : archiveTitle(workspace),
    ...(existing?.titleCustomized ? { titleCustomized: true as const } : {}),
    savedAt: now.toISOString(),
    rulesetDigest: workspace.result.rulesetDigest,
    workspace: structuredClone(workspace),
  });
  if (current.length >= MAX_ARCHIVES && !current.some((item) => item.id === archive.id)) {
    throw new Error("看盘档案已满 20 份，请先导出备份并删除不再需要的档案。");
  }
  const archives = [archive, ...current.filter((item) => item.id !== archive.id)];
  persist(archives, storage);
  return archives;
}

export function deleteArchive(id: string, expectedSavedAt: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): AnalysisArchive[] {
  const current = readArchives(storage, true);
  const target = current.find((archive) => archive.id === id);
  if (!target) throw new Error("档案已在另一标签页删除，请刷新档案列表。");
  if (target.savedAt !== expectedSavedAt) throw new Error("档案已在另一标签页更新，请重新打开档案列表后再删除。");
  const archives = current.filter((archive) => archive.id !== id);
  persist(archives, storage);
  return archives;
}

export function renameArchive(
  id: string,
  expectedSavedAt: string,
  title: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  now = new Date(),
): AnalysisArchive[] {
  const normalizedTitle = title.trim().replace(/\s+/gu, " ");
  if (!normalizedTitle) throw new Error("档案名称不能为空。");
  if (normalizedTitle.length > 300) throw new Error("档案名称不能超过 300 个字符。");
  const archives = readArchives(storage, true);
  const archive = archives.find((item) => item.id === id);
  if (!archive) throw new Error("档案已在另一标签页删除，请刷新档案列表。");
  if (archive.savedAt !== expectedSavedAt) throw new Error("档案已在另一标签页更新，请重新打开档案列表后再重命名。");
  const renamed = { ...archive, title: normalizedTitle, titleCustomized: true as const, savedAt: now.toISOString() };
  const updated = [renamed, ...archives.filter((item) => item.id !== id)];
  persist(updated, storage);
  return updated;
}

export function serializeArchiveBackup(archives: readonly AnalysisArchive[], now = new Date()): string {
  const backup: ArchiveBackup = {
    schema: BACKUP_SCHEMA,
    exportedAt: now.toISOString(),
    containsSensitiveData: true,
    archives: archives.map(cloneJson),
  };
  if (!isArchiveList(backup.archives)) throw new Error("档案中存在无法导出的无效记录。");
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function serializeReadingPackage(workspace: ArchiveWorkspaceSnapshot, now = new Date()): string {
  if (!isWorkspace(workspace)) throw new Error("当前工作区无法导出为完整看盘包。");
  parseWorkspaceResult(workspace);
  if (!workspaceResultMatches(workspace)) throw new Error("当前工作区输入与分析结果不一致，请重新生成分析。");
  const exportedAt = now.toISOString();
  const archive = normalizeArchive({
    id: archiveId(workspace.analysisMode, workspace.result.requestId),
    title: archiveTitle(workspace),
    savedAt: exportedAt,
    rulesetDigest: workspace.result.rulesetDigest,
    workspace: structuredClone(workspace),
  });
  const schema = workspace.analysisMode === "structure" ? M0_READING_SCHEMA : READING_SCHEMA;
  return `${JSON.stringify({ schema, exportedAt, containsSensitiveData: true, workspace: archive.workspace }, null, 2)}\n`;
}

export function importArchiveBackup(
  raw: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): ArchiveImportResult {
  const result = previewArchiveBackup(raw, storage);
  persist(result.archives, storage);
  return result;
}

export function previewArchiveBackup(
  raw: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): ArchiveImportResult {
  const imported = parseBackup(raw);
  const current = readArchives(storage, true);
  const merged = new Map(current.map((archive) => [archive.id, archive]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const candidate of imported) {
    const existing = merged.get(candidate.id);
    if (!existing) {
      if (merged.size >= MAX_ARCHIVES) {
        skipped += 1;
      } else {
        merged.set(candidate.id, candidate);
        added += 1;
      }
    } else if (Date.parse(candidate.savedAt) > Date.parse(existing.savedAt)) {
      merged.set(candidate.id, candidate);
      updated += 1;
    } else {
      skipped += 1;
    }
  }
  const ordered = [...merged.values()].sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
  const archives = ordered;
  return { archives, added, updated, skipped };
}

export function archiveTitle(workspace: ArchiveWorkspaceSnapshot): string {
  const day = workspace.primarySubject.day;
  if (workspace.analysisMode === "structure") return `${workspace.primarySubject.subjectId.trim() || "主命盘"} · ${day}日 · 原局结构`;
  const mode = workspace.analysisMode === "evaluate" ? "现实评估" : "关系画像";
  const secondaryLabel = workspace.secondarySubject.subjectId.trim() || "另一方命盘";
  const pair = workspace.hasSecondarySubject ? ` × ${secondaryLabel} · ${workspace.secondarySubject.day}日` : "";
  return `${workspace.primarySubject.subjectId.trim() || "主命盘"} · ${day}日${pair} · ${mode}`;
}

function persist(archives: AnalysisArchive[], storage: Pick<Storage, "setItem">): void {
  const envelope: ArchiveEnvelope = { version: 1, archives };
  storage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(envelope));
}

function parseBackup(raw: string): AnalysisArchive[] {
  if (raw.length > 20_000_000) throw new Error("备份文件超过 20 MB。");
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("备份文件不是有效的 JSON。");
  }
  if (!value || typeof value !== "object") throw new Error("备份文件结构无效。");
  if ([READING_SCHEMA, M0_READING_SCHEMA].includes(String((value as Record<string, unknown>).schema))) return [parseReadingPackage(value as Record<string, unknown>)];
  const backup = value as Partial<ArchiveBackup>;
  if (!hasOnlyKeys(backup, ["schema", "exportedAt", "containsSensitiveData", "archives"])) throw new Error("备份文件包含未声明字段。");
  if (backup.schema !== BACKUP_SCHEMA) throw new Error("备份版本不受支持。");
  if (backup.containsSensitiveData !== true || !isIsoTimestamp(backup.exportedAt)) {
    throw new Error("备份文件元数据无效。");
  }
  if (!Array.isArray(backup.archives) || backup.archives.length > MAX_ARCHIVES || !backup.archives.every(isArchive)) {
    throw new Error("备份中的档案结构无效或数量超过 20 份。");
  }
  const migrated = backup.archives.map(migrateLegacyStructuralSupplement);
  const ids = new Set<string>();
  for (const archive of migrated) {
    if (ids.has(archive.id)) throw new Error("备份中包含重复档案。");
    ids.add(archive.id);
    try {
      parseWorkspaceResult(archive.workspace);
    } catch {
      throw new Error(`档案“${archive.title}”的分析结果无效。`);
    }
    if (!workspaceResultMatches(archive.workspace)) throw new Error(`档案“${archive.title}”的输入与分析结果不一致。`);
    if (!archiveIdentityMatches(archive)) throw new Error(`档案“${archive.title}”的身份无效。`);
  }
  return migrated.map(normalizeArchive);
}

function parseReadingPackage(value: Record<string, unknown>): AnalysisArchive {
  const legacy = value.schema === M0_READING_SCHEMA && value.workspace === undefined;
  if (!hasOnlyKeys(value, legacy
    ? ["schema", "exportedAt", "containsSensitiveData", "resultInputFingerprint", "subject", "result"]
    : ["schema", "exportedAt", "containsSensitiveData", "workspace"])) throw new Error("完整看盘包包含未声明字段。");
  if (value.containsSensitiveData !== true || !isIsoTimestamp(value.exportedAt)) {
    throw new Error("完整看盘包元数据无效。");
  }
  const workspaceValue = value.schema === M0_READING_SCHEMA && value.workspace === undefined
    ? legacyM0Workspace(value)
    : value.workspace;
  if (!isWorkspace(workspaceValue)) throw new Error("完整看盘包工作区无效。");
  if ((value.schema === M0_READING_SCHEMA) !== (workspaceValue.analysisMode === "structure")) throw new Error("完整看盘包类型与工作区不一致。");
  const archive = migrateLegacyStructuralSupplement({
    id: archiveId(workspaceValue.analysisMode, workspaceValue.result.requestId),
    title: archiveTitle(workspaceValue),
    savedAt: value.exportedAt,
    rulesetDigest: workspaceValue.result.rulesetDigest,
    workspace: structuredClone(workspaceValue),
  });
  try {
    parseWorkspaceResult(archive.workspace);
  } catch {
    throw new Error("完整看盘包的分析结果无效。");
  }
  if (!workspaceResultMatches(archive.workspace)) throw new Error("完整看盘包的输入与分析结果不一致。");
  return normalizeArchive(archive);
}

function legacyM0Workspace(value: Record<string, unknown>): unknown {
  if (!isSubject(value.subject) || !value.result || typeof value.result !== "object") return null;
  const primarySubject = structuredClone(value.subject) as SubjectDraft;
  return { analysisMode: "structure", resultInputFingerprint: m0InputFingerprint(primarySubject), primarySubject, result: value.result };
}

function isEnvelope(value: unknown): value is ArchiveEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<ArchiveEnvelope>;
  return hasOnlyKeys(envelope, ["version", "archives"]) && envelope.version === 1 && isArchiveList(envelope.archives);
}

function isArchiveList(value: unknown): value is AnalysisArchive[] {
  return Array.isArray(value) && value.length <= MAX_ARCHIVES && value.every((archive) => isArchive(archive) && archiveIdentityMatches(archive))
    && new Set(value.map((archive) => archive.id)).size === value.length;
}

function archiveIdentityMatches(archive: AnalysisArchive): boolean { return archive.id === archiveId(archive.workspace.analysisMode, archive.workspace.result.requestId); }

function isArchive(value: unknown): value is AnalysisArchive {
  if (!value || typeof value !== "object") return false;
  const archive = value as Partial<AnalysisArchive>;
  return hasOnlyKeys(archive, ["id", "title", "titleCustomized", "savedAt", "rulesetDigest", "workspace"])
    && typeof archive.id === "string" && archive.id.length > 0 && typeof archive.title === "string" && archive.title.length > 0 && archive.title.length <= 300
    && (archive.titleCustomized === undefined || archive.titleCustomized === true)
    && isIsoTimestamp(archive.savedAt)
    && typeof archive.rulesetDigest === "string" && archive.rulesetDigest === archive.workspace?.result?.rulesetDigest
    && isWorkspace(archive.workspace);
}

function isWorkspace(value: unknown): value is ArchiveWorkspaceSnapshot {
  if (!value || typeof value !== "object") return false;
  const workspace = value as Partial<ArchiveWorkspaceSnapshot>;
  if (workspace.analysisMode === "structure") {
    const structure = workspace as Partial<M0WorkspaceSnapshot>;
    return hasOnlyKeys(structure, ["analysisMode", "resultInputFingerprint", "primarySubject", "result"])
      && typeof structure.resultInputFingerprint === "string" && isSubject(structure.primarySubject)
      && Boolean(structure.result && typeof structure.result === "object");
  }
  const relationship = workspace as Partial<AnalysisWorkspaceSnapshot>;
  return hasOnlyKeys(relationship, ["analysisMode", "roleBasis", "resultInputFingerprint", "primarySubject", "secondarySubject", "hasSecondarySubject", "gates", "crossState", "observations", "result"])
    && (relationship.analysisMode === "profile" || relationship.analysisMode === "evaluate")
    && ["female_traditional", "male_traditional", "unspecified"].includes(String(relationship.roleBasis))
    && isSubject(relationship.primarySubject) && isSubject(relationship.secondarySubject)
    && typeof relationship.hasSecondarySubject === "boolean"
    && isGateList(relationship.gates) && isObservationList(relationship.observations)
    && isCrossState(relationship.crossState)
    && Boolean(relationship.result && typeof relationship.result === "object");
}

function isSubject(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const subject = value as Record<string, unknown>;
  const input = record(subject.birthInput);
  const pillars = [subject.year, subject.month, subject.day, subject.hour].join(" ");
  const solarResolution = input?.method === "solar_utc8_assist" && typeof input.solarLocalDateTime === "string" && input.solarLocalDateTime
    ? resolveSolarBirth(input.solarLocalDateTime)
    : null;
  return hasOnlyKeys(subject, ["subjectId", "year", "month", "day", "hour", "birthTimeStatus", "dataQuality", "birthInput"])
    && typeof subject.subjectId === "string" && subject.subjectId.length <= 120
    && ["year", "month", "day", "hour"].every((key) => typeof subject[key] === "string" && JIAZI.includes(String(subject[key])))
    && monthOptions(String(subject.year)).includes(String(subject.month))
    && (subject.birthTimeStatus === "unknown" || hourOptions(String(subject.day)).includes(String(subject.hour)))
    && ["exact", "approximate", "unknown"].includes(String(subject.birthTimeStatus))
    && ["high", "medium", "low", "unknown"].includes(String(subject.dataQuality))
    && (subject.birthInput === undefined || isBirthInput(subject.birthInput))
    && (!input || input.method === "manual_four_pillars" || (
      (input.resolutionStatus === "resolved") === (input.resolvedPillars !== null)
      && (subject.birthTimeStatus === "unknown" || input.resolutionStatus !== "resolved" || input.resolvedPillars === pillars)
      && (!input.solarLocalDateTime || (solarResolution?.status !== "invalid" && solarResolution?.status !== "unsupported"))
      && (subject.birthTimeStatus === "unknown" || input.resolutionStatus !== "resolved" || !isCurrentCalendarAdapter(input.adapter)
        || (solarResolution?.status === "resolved" && formatFourPillars(solarResolution.fourPillars) === pillars))
    ));
}

function isBirthInput(value: unknown): boolean {
  const input = record(value);
  if (!input) return false;
  if (input.method === "manual_four_pillars") return hasOnlyKeys(input, ["method"]);
  if (input.method !== "solar_utc8_assist") return false;
  const adapter = record(input.adapter);
  return hasOnlyKeys(input, ["method", "solarLocalDateTime", "resolutionStatus", "resolvedPillars", "adapter"])
    && typeof input.solarLocalDateTime === "string" && input.solarLocalDateTime.length <= 32
    && ["not_calculated", "resolved", "boundary_unresolved", "invalid", "unsupported"].includes(String(input.resolutionStatus))
    && (input.resolvedPillars === null || isPillarSummary(input.resolvedPillars))
    && Boolean(adapter && hasOnlyKeys(adapter, ["id", "version", "civilTimeBasis", "trueSolarTimeApplied"])
      && typeof adapter.id === "string" && typeof adapter.version === "string"
      && adapter.civilTimeBasis === "UTC+08:00" && adapter.trueSolarTimeApplied === false);
}

function isPillarSummary(value: unknown): boolean {
  return typeof value === "string" && value.split(" ").length === 4 && value.split(" ").every((pillar) => JIAZI.includes(pillar));
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function normalizeArchive(archive: AnalysisArchive): AnalysisArchive {
  const value = structuredClone(archive);
  value.workspace.primarySubject = normalizeSubject(value.workspace.primarySubject);
  if (value.workspace.analysisMode === "structure") {
    value.workspace.resultInputFingerprint = m0InputFingerprint(value.workspace.primarySubject);
    return value;
  }
  value.workspace.secondarySubject = value.workspace.hasSecondarySubject ? normalizeSubject(value.workspace.secondarySubject) : inactiveSecondarySubject();
  value.workspace.gates = value.workspace.gates.map((gate) => ({ ...gate, label: REALITY_GATES.find((canonical) => canonical.id === gate.id)!.label }));
  for (const state of CROSS_STATE_KEYS) {
    if (value.workspace.analysisMode === "profile") value.workspace.crossState[state] = false;
    if (!value.workspace.crossState[state]) value.workspace.crossState.evidence[state] = "";
  }
  if (value.workspace.analysisMode === "profile") {
    value.workspace.gates = value.workspace.gates.map((gate) => ({ ...gate, status: "not_assessed", note: "" }));
    value.workspace.observations = [];
  }
  value.workspace.resultInputFingerprint = analysisInputFingerprint(value.workspace);
  return value;
}

function migrateLegacyStructuralSupplement(archive: AnalysisArchive): AnalysisArchive {
  const value = structuredClone(archive);
  if (value.workspace.analysisMode === "structure") return value;
  const result = record(value.workspace.result);
  const relationship = record(result?.relationship);
  const supplement = record(relationship?.structuralSupplement);
  if (!supplement || Object.hasOwn(supplement, "status") || Object.hasOwn(supplement, "dependencyFlags")) return value;
  const dependencyFlags = value.workspace.hasSecondarySubject ? birthInputDependencyFlags(value.workspace.secondarySubject) : [];
  supplement.status = value.workspace.hasSecondarySubject ? dependencyFlags.length ? "limited" : "complete" : null;
  supplement.dependencyFlags = dependencyFlags;
  return value;
}

function workspaceResultMatches(workspace: ArchiveWorkspaceSnapshot): boolean {
  if (workspace.analysisMode === "structure") return workspace.resultInputFingerprint === m0InputFingerprint(workspace.primarySubject)
    && subjectResultMatches(workspace.primarySubject, workspace.result.m0.fields);
  return workspace.roleBasis === workspace.result.relationship.roleBasis
    && workspace.hasSecondarySubject === workspace.result.relationship.structuralSupplement.available
    && (workspace.resultInputFingerprint === undefined || workspace.resultInputFingerprint === analysisInputFingerprint(workspace))
    && subjectResultMatches(workspace.primarySubject, workspace.result.m0.fields)
    && (!workspace.hasSecondarySubject || subjectResultMatches(workspace.secondarySubject, workspace.result.relationship.structuralSupplement.fields!))
    && (workspace.analysisMode === "profile" || workspaceGatesMatch(workspace))
    && (workspace.analysisMode === "profile" || workspaceCrossStateMatches(workspace))
    && workspaceObservationsMatch(workspace);
}

function subjectResultMatches(subject: SubjectDraft, fields: Record<string, { value: unknown }>): boolean {
  const validation = record(fields.input_validation?.value);
  const pillars = record(fields.pillar_element_ten_god_map?.value);
  if (!validation || validation.birthTimeStatus !== subject.birthTimeStatus || !pillars) return false;
  return (["year", "month", "day", "hour"] as const).every((position) => {
    if (position === "hour" && subject.birthTimeStatus === "unknown") return Object.hasOwn(pillars, position) && pillars[position] === null;
    const pillar = record(pillars[position]);
    return record(pillar?.stem)?.stem === subject[position][0] && record(pillar?.branch)?.branch === subject[position][1];
  });
}

function parseWorkspaceResult(workspace: ArchiveWorkspaceSnapshot): void {
  if (workspace.analysisMode === "structure") parseM0AnalysisResponse(workspace.result);
  else parseAnalysisResponse(workspace.result);
}

function workspaceObservationsMatch(workspace: AnalysisWorkspaceSnapshot): boolean {
  if (workspace.analysisMode === "profile") return true;
  const basisFingerprint = workspace.resultInputFingerprint ?? analysisInputFingerprint(workspace);
  const candidates = new Map(workspace.result.relationship.m4.riskChains.map((chain) => [chain.id, riskCandidateFingerprint(chain)]));
  const slots = new Set<string>();
  const bindingsMatch = workspace.observations.every((observation) => {
    const slot = `${observation.chainId}:${observation.slot}`;
    if (slots.has(slot)) return false;
    slots.add(slot);
    return observation.basisFingerprint === basisFingerprint
      && observation.basisRequestId === workspace.result.requestId
      && observation.candidateFingerprint === candidates.get(observation.chainId);
  });
  if (!bindingsMatch) return false;
  return workspace.result.relationship.m4.riskChains.every((chain) => {
    const evidence = workspace.observations.filter((item) => item.chainId === chain.id && item.context.trim());
    const supports = evidence.filter((item) => item.direction === "supports");
    const contradicts = evidence.filter((item) => item.direction === "contradicts");
    const independentSupport = new Set(supports.map((item) => `${item.source}\u0000${item.context.trim()}`)).size;
    const realityStatus = contradicts.length && supports.length ? "mixed_evidence" : contradicts.length ? "contradicted" : independentSupport >= 2 ? "observed_pattern" : "unconfirmed";
    return chain.realityStatus === realityStatus
      && chain.evidenceIds.length === evidence.length
      && chain.evidenceIds.every((id, index) => id.endsWith(`-${chain.id}-${evidence[index]!.slot}`));
  });
}

function workspaceGatesMatch(workspace: AnalysisWorkspaceSnapshot): boolean {
  const results = new Map(workspace.result.relationship.m5.realityGates.map((gate) => [gate.id, gate]));
  return workspace.gates.every((gate) => {
    const note = gate.note.trim();
    const unsupported = ["pass", "conditional", "fail"].includes(gate.status) && !note;
    const safetyFailure = gate.status === "fail" && (gate.id === "RG01" || gate.id === "RG07");
    const status = unsupported && !safetyFailure ? "unknown" : gate.status;
    const result = results.get(gate.id);
    return result?.status === status && (result.note?.trim() ?? "") === note;
  });
}

function workspaceCrossStateMatches(workspace: AnalysisWorkspaceSnapshot): boolean {
  const expected = CROSS_STATE_KEYS.flatMap((state) => {
    const note = workspace.crossState.evidence[state].trim();
    return workspace.crossState[state] && note ? [{ state, note }] : [];
  });
  const actual = workspace.result.relationship.m5.crossStateEvidence;
  return actual.length === expected.length && expected.every((item, index) => actual[index]?.state === item.state && actual[index]?.note.trim() === item.note);
}

function normalizeSubject(subject: SubjectDraft): SubjectDraft {
  if (subject.birthTimeStatus === "unknown") return { ...subject, hour: hourOptions(subject.day)[0]!, birthInput: { method: "manual_four_pillars" } };
  return { ...subject, birthInput: subject.birthInput ?? { method: "manual_four_pillars" } };
}

function isGateList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 8) return false;
  const ids = new Set(value.map((gate) => record(gate)?.id));
  return ids.size === 8 && value.every((gate) => {
    const item = record(gate);
    return item && hasOnlyKeys(item, ["id", "label", "status", "note"])
      && /^RG0[1-8]$/u.test(String(item.id)) && typeof item.label === "string" && typeof item.note === "string"
      && ["pass", "conditional", "fail", "unknown", "not_assessed"].includes(String(item.status));
  });
}

function isCrossState(value: unknown): boolean {
  const item = record(value);
  const evidence = item && record(item.evidence);
  return Boolean(item && evidence && hasOnlyKeys(item, [...CROSS_STATE_KEYS, "evidence"]) && hasOnlyKeys(evidence, CROSS_STATE_KEYS)
    && CROSS_STATE_KEYS.every((key) => typeof item[key] === "boolean" && typeof evidence[key] === "string"));
}

function isObservationList(value: unknown): boolean {
  return Array.isArray(value) && value.every((observation) => {
    const item = record(observation);
    return item && hasOnlyKeys(item, ["chainId", "slot", "source", "context", "direction", "basisFingerprint", "candidateFingerprint", "basisRequestId"])
      && typeof item.chainId === "string" && (item.slot === 0 || item.slot === 1)
      && ["self_report", "partner_report", "joint_record", "third_party_record"].includes(String(item.source))
      && typeof item.context === "string" && ["supports", "contradicts"].includes(String(item.direction))
      && ["basisFingerprint", "candidateFingerprint", "basisRequestId"].every((key) => typeof item[key] === "string");
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function hasOnlyKeys(value: object, allowed: readonly string[]): boolean {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
