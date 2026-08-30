import { describe, expect, it } from "vitest";

import { deleteArchive, loadArchives, saveArchive } from "./archive-store";
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
    expect(archives[0]?.workspace).toEqual(workspace);
    expect(archives[0]?.workspace).not.toBe(workspace);
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

  it("deletes only the selected archive", () => {
    const storage = memoryStorage();
    const first = makeWorkspace();
    const second = { ...makeWorkspace(), result: { ...makeAnalysisResponse(), requestId: "request-second" } };
    saveArchive(first, storage);
    const two = saveArchive(second, storage);
    const remaining = deleteArchive(two[1]!.id, storage);
    expect(remaining.map((item) => item.id)).toEqual(["archive-request-second"]);
  });
});

function makeWorkspace(): AnalysisWorkspaceSnapshot {
  return {
    analysisMode: "profile",
    roleBasis: "female_traditional",
    primarySubject: { subjectId: "主命盘", year: "庚申", month: "己丑", day: "甲寅", hour: "庚午", birthTimeStatus: "exact", dataQuality: "high" },
    secondarySubject: { subjectId: "另一方", year: "己巳", month: "丙寅", day: "乙卯", hour: "丙子", birthTimeStatus: "exact", dataQuality: "high" },
    hasSecondarySubject: false,
    gates: [],
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
  };
}
