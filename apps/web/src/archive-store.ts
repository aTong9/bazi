import { parseAnalysisResponse } from "./api";
import { analysisInputFingerprint, JIAZI, riskCandidateFingerprint } from "./domain";
import type { AnalysisArchive, AnalysisWorkspaceSnapshot, SubjectDraft } from "./types";

export const ARCHIVE_STORAGE_KEY = "bazi.relationship.archives.v1";
const MAX_ARCHIVES = 20;
const BACKUP_SCHEMA = "bazi.relationship.archive-backup.v1";

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
      parseAnalysisResponse(archive.workspace.result);
      if (!workspaceResultMatches(archive.workspace)) throw new Error();
      return normalizeArchive(archive);
    });
  } catch {
    if (failOnInvalid) throw new Error("本机档案数据已损坏，已停止写入以避免覆盖；请先导出浏览器存储以便恢复。");
    return [];
  }
}

export function saveArchive(
  workspace: AnalysisWorkspaceSnapshot,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  now = new Date(),
): AnalysisArchive[] {
  if (!isWorkspace(workspace)) throw new Error("当前工作区无法保存为有效档案。");
  parseAnalysisResponse(workspace.result);
  if (!workspaceResultMatches(workspace)) throw new Error("当前工作区输入与分析结果不一致，请重新生成分析。");
  const current = readArchives(storage, true);
  const existing = current.find((item) => item.id === `archive-${workspace.result.requestId}`);
  const archive = normalizeArchive({
    id: `archive-${workspace.result.requestId}`,
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

export function deleteArchive(id: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): AnalysisArchive[] {
  const archives = readArchives(storage, true).filter((archive) => archive.id !== id);
  persist(archives, storage);
  return archives;
}

export function renameArchive(
  id: string,
  title: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  now = new Date(),
): AnalysisArchive[] {
  const normalizedTitle = title.trim().replace(/\s+/gu, " ");
  if (!normalizedTitle) throw new Error("档案名称不能为空。");
  if (normalizedTitle.length > 300) throw new Error("档案名称不能超过 300 个字符。");
  const archives = readArchives(storage, true);
  const archive = archives.find((item) => item.id === id);
  if (!archive) throw new Error("档案不存在。");
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

export function archiveTitle(workspace: AnalysisWorkspaceSnapshot): string {
  const day = workspace.primarySubject.day;
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
  const backup = value as Partial<ArchiveBackup>;
  if (backup.schema !== BACKUP_SCHEMA) throw new Error("备份版本不受支持。");
  if (backup.containsSensitiveData !== true || typeof backup.exportedAt !== "string" || !Number.isFinite(Date.parse(backup.exportedAt))) {
    throw new Error("备份文件元数据无效。");
  }
  if (!Array.isArray(backup.archives) || backup.archives.length > MAX_ARCHIVES || !backup.archives.every(isArchive)) {
    throw new Error("备份中的档案结构无效或数量超过 20 份。");
  }
  const ids = new Set<string>();
  for (const archive of backup.archives) {
    if (ids.has(archive.id)) throw new Error("备份中包含重复档案。");
    ids.add(archive.id);
    try {
      parseAnalysisResponse(archive.workspace.result);
    } catch {
      throw new Error(`档案“${archive.title}”的分析结果无效。`);
    }
    if (!workspaceResultMatches(archive.workspace)) throw new Error(`档案“${archive.title}”的输入与分析结果不一致。`);
    if (!archiveIdentityMatches(archive)) throw new Error(`档案“${archive.title}”的身份无效。`);
  }
  return backup.archives.map(normalizeArchive);
}

function isEnvelope(value: unknown): value is ArchiveEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<ArchiveEnvelope>;
  return envelope.version === 1 && isArchiveList(envelope.archives);
}

function isArchiveList(value: unknown): value is AnalysisArchive[] {
  return Array.isArray(value) && value.length <= MAX_ARCHIVES && value.every((archive) => isArchive(archive) && archiveIdentityMatches(archive))
    && new Set(value.map((archive) => archive.id)).size === value.length;
}

function archiveIdentityMatches(archive: AnalysisArchive): boolean { return archive.id === `archive-${archive.workspace.result.requestId}`; }

function isArchive(value: unknown): value is AnalysisArchive {
  if (!value || typeof value !== "object") return false;
  const archive = value as Partial<AnalysisArchive>;
  return typeof archive.id === "string" && archive.id.length > 0 && typeof archive.title === "string" && archive.title.length > 0 && archive.title.length <= 300
    && (archive.titleCustomized === undefined || archive.titleCustomized === true)
    && typeof archive.savedAt === "string" && Number.isFinite(Date.parse(archive.savedAt))
    && typeof archive.rulesetDigest === "string" && archive.rulesetDigest === archive.workspace?.result?.rulesetDigest
    && isWorkspace(archive.workspace);
}

function isWorkspace(value: unknown): value is AnalysisWorkspaceSnapshot {
  if (!value || typeof value !== "object") return false;
  const workspace = value as Partial<AnalysisWorkspaceSnapshot>;
  return (workspace.analysisMode === "profile" || workspace.analysisMode === "evaluate")
    && ["female_traditional", "male_traditional", "unspecified"].includes(String(workspace.roleBasis))
    && isSubject(workspace.primarySubject) && isSubject(workspace.secondarySubject)
    && typeof workspace.hasSecondarySubject === "boolean"
    && isGateList(workspace.gates) && isObservationList(workspace.observations)
    && isCrossState(workspace.crossState)
    && Boolean(workspace.result && typeof workspace.result === "object");
}

function isSubject(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const subject = value as Record<string, unknown>;
  return typeof subject.subjectId === "string" && subject.subjectId.length <= 120
    && ["year", "month", "day", "hour"].every((key) => typeof subject[key] === "string" && JIAZI.includes(String(subject[key])))
    && ["exact", "approximate", "unknown"].includes(String(subject.birthTimeStatus))
    && ["high", "medium", "low", "unknown"].includes(String(subject.dataQuality))
    && (subject.birthInput === undefined || isBirthInput(subject.birthInput));
}

function isBirthInput(value: unknown): boolean {
  const input = record(value);
  if (!input) return false;
  if (input.method === "manual_four_pillars") return true;
  if (input.method !== "solar_utc8_assist") return false;
  const adapter = record(input.adapter);
  return typeof input.solarLocalDateTime === "string" && input.solarLocalDateTime.length <= 32
    && ["not_calculated", "resolved", "boundary_unresolved", "invalid", "unsupported"].includes(String(input.resolutionStatus))
    && (input.resolvedPillars === null || isPillarSummary(input.resolvedPillars))
    && Boolean(adapter && typeof adapter.id === "string" && typeof adapter.version === "string"
      && adapter.civilTimeBasis === "UTC+08:00" && adapter.trueSolarTimeApplied === false);
}

function isPillarSummary(value: unknown): boolean {
  return typeof value === "string" && value.split(" ").length === 4 && value.split(" ").every((pillar) => JIAZI.includes(pillar));
}

function normalizeArchive(archive: AnalysisArchive): AnalysisArchive {
  const value = structuredClone(archive);
  value.workspace.primarySubject = normalizeSubject(value.workspace.primarySubject);
  value.workspace.secondarySubject = normalizeSubject(value.workspace.secondarySubject);
  for (const state of ["steady", "pressure", "repair", "turningPoint", "counterevidenceReviewed"] as const) {
    if (!value.workspace.crossState[state]) value.workspace.crossState.evidence[state] = "";
  }
  value.workspace.resultInputFingerprint = analysisInputFingerprint(value.workspace);
  return value;
}

function workspaceResultMatches(workspace: AnalysisWorkspaceSnapshot): boolean {
  return workspace.roleBasis === workspace.result.relationship.roleBasis
    && (workspace.resultInputFingerprint === undefined || workspace.resultInputFingerprint === analysisInputFingerprint(workspace))
    && workspaceObservationsMatch(workspace);
}

function workspaceObservationsMatch(workspace: AnalysisWorkspaceSnapshot): boolean {
  if (workspace.analysisMode === "profile") return workspace.observations.length === 0;
  const basisFingerprint = workspace.resultInputFingerprint ?? analysisInputFingerprint(workspace);
  const candidates = new Map(workspace.result.relationship.m4.riskChains.map((chain) => [chain.id, riskCandidateFingerprint(chain)]));
  const slots = new Set<string>();
  return workspace.observations.every((observation) => {
    const slot = `${observation.chainId}:${observation.slot}`;
    if (slots.has(slot)) return false;
    slots.add(slot);
    return observation.basisFingerprint === basisFingerprint
      && observation.basisRequestId === workspace.result.requestId
      && observation.candidateFingerprint === candidates.get(observation.chainId);
  });
}

function normalizeSubject(subject: SubjectDraft): SubjectDraft {
  return { ...subject, birthInput: subject.birthInput ?? { method: "manual_four_pillars" } };
}

function isGateList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 8) return false;
  const ids = new Set(value.map((gate) => record(gate)?.id));
  return ids.size === 8 && value.every((gate) => {
    const item = record(gate);
    return item && /^RG0[1-8]$/u.test(String(item.id)) && typeof item.label === "string" && typeof item.note === "string"
      && ["pass", "conditional", "fail", "unknown", "not_assessed"].includes(String(item.status));
  });
}

function isCrossState(value: unknown): boolean {
  const item = record(value);
  const evidence = item && record(item.evidence);
  const keys = ["steady", "pressure", "repair", "turningPoint", "counterevidenceReviewed"];
  return Boolean(item && evidence && keys.every((key) => typeof item[key] === "boolean" && typeof evidence[key] === "string"));
}

function isObservationList(value: unknown): boolean {
  return Array.isArray(value) && value.every((observation) => {
    const item = record(observation);
    return item && typeof item.chainId === "string" && (item.slot === 0 || item.slot === 1)
      && ["self_report", "partner_report", "joint_record", "third_party_record"].includes(String(item.source))
      && typeof item.context === "string" && ["supports", "contradicts"].includes(String(item.direction))
      && ["basisFingerprint", "candidateFingerprint", "basisRequestId"].every((key) => typeof item[key] === "string");
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
