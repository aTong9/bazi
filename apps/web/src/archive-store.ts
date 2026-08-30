import { parseAnalysisResponse } from "./api";
import type { AnalysisArchive, AnalysisWorkspaceSnapshot } from "./types";

const STORAGE_KEY = "bazi.relationship.archives.v1";
const MAX_ARCHIVES = 20;

interface ArchiveEnvelope { version: 1; archives: AnalysisArchive[] }

export function loadArchives(storage: Pick<Storage, "getItem"> = localStorage): AnalysisArchive[] {
  let raw: string | null;
  try {
    if (typeof storage?.getItem !== "function") return [];
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const envelope = JSON.parse(raw) as unknown;
    if (!isEnvelope(envelope)) return [];
    return envelope.archives.flatMap((archive) => {
      try {
        parseAnalysisResponse(archive.workspace.result);
        return [structuredClone(archive)];
      } catch {
        return [];
      }
    }).slice(0, MAX_ARCHIVES);
  } catch {
    return [];
  }
}

export function saveArchive(
  workspace: AnalysisWorkspaceSnapshot,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  now = new Date(),
): AnalysisArchive[] {
  const archive: AnalysisArchive = {
    id: `archive-${workspace.result.requestId}`,
    title: archiveTitle(workspace),
    savedAt: now.toISOString(),
    rulesetDigest: workspace.result.rulesetDigest,
    workspace: structuredClone(workspace),
  };
  const archives = [archive, ...loadArchives(storage).filter((item) => item.id !== archive.id)].slice(0, MAX_ARCHIVES);
  persist(archives, storage);
  return archives;
}

export function deleteArchive(id: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): AnalysisArchive[] {
  const archives = loadArchives(storage).filter((archive) => archive.id !== id);
  persist(archives, storage);
  return archives;
}

export function archiveTitle(workspace: AnalysisWorkspaceSnapshot): string {
  const day = workspace.primarySubject.day;
  const mode = workspace.analysisMode === "evaluate" ? "现实评估" : "关系画像";
  const pair = workspace.hasSecondarySubject ? ` × ${workspace.secondarySubject.day}日` : "";
  return `${workspace.primarySubject.subjectId || "主命盘"} · ${day}日${pair} · ${mode}`;
}

function persist(archives: AnalysisArchive[], storage: Pick<Storage, "setItem">): void {
  const envelope: ArchiveEnvelope = { version: 1, archives };
  storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

function isEnvelope(value: unknown): value is ArchiveEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<ArchiveEnvelope>;
  return envelope.version === 1 && Array.isArray(envelope.archives) && envelope.archives.every(isArchive);
}

function isArchive(value: unknown): value is AnalysisArchive {
  if (!value || typeof value !== "object") return false;
  const archive = value as Partial<AnalysisArchive>;
  return typeof archive.id === "string" && archive.id.length > 0 && typeof archive.title === "string" && archive.title.length > 0
    && typeof archive.savedAt === "string" && Number.isFinite(Date.parse(archive.savedAt))
    && typeof archive.rulesetDigest === "string" && isWorkspace(archive.workspace);
}

function isWorkspace(value: unknown): value is AnalysisWorkspaceSnapshot {
  if (!value || typeof value !== "object") return false;
  const workspace = value as Partial<AnalysisWorkspaceSnapshot>;
  return (workspace.analysisMode === "profile" || workspace.analysisMode === "evaluate")
    && ["female_traditional", "male_traditional", "unspecified"].includes(String(workspace.roleBasis))
    && isSubject(workspace.primarySubject) && isSubject(workspace.secondarySubject)
    && typeof workspace.hasSecondarySubject === "boolean"
    && Array.isArray(workspace.gates) && Array.isArray(workspace.observations)
    && Boolean(workspace.crossState && typeof workspace.crossState === "object")
    && Boolean(workspace.result && typeof workspace.result === "object");
}

function isSubject(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const subject = value as Record<string, unknown>;
  return ["subjectId", "year", "month", "day", "hour"].every((key) => typeof subject[key] === "string")
    && ["exact", "approximate", "unknown"].includes(String(subject.birthTimeStatus))
    && ["high", "medium", "low", "unknown"].includes(String(subject.dataQuality));
}
