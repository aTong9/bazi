import { describe, expect, it } from "vitest";
import { createWenzhenCandidates, evaluateWenzhenCandidates } from "../src/index.js";

describe("Wenzhen compatibility candidate matrix", () => {
  it("defines and executes at least 100 unique, deterministic boundary candidates", () => {
    const first = createWenzhenCandidates();
    const second = createWenzhenCandidates();
    expect(first.length).toBeGreaterThanOrEqual(100);
    expect(first.filter(item => item.boundary).length).toBeGreaterThanOrEqual(100);
    expect(first.filter(item => !item.boundary).length).toBeGreaterThanOrEqual(20);
    expect(new Set(first.map(item => item.caseId)).size).toBe(first.length);
    expect(first.map(item => item.localEngineOutput)).toEqual(second.map(item => item.localEngineOutput));
    expect(first.every(item => item.wenzhenObserved === null && item.match === null)).toBe(true);
  });

  it("computes compatibility metrics only from actual observations", () => {
    const candidates = createWenzhenCandidates();
    candidates[0]!.wenzhenObserved = { adjustedTime: candidates[0]!.localEngineOutput.selectedTime, fourPillars: candidates[0]!.localEngineOutput.fourPillars, qiyunAge: "人工记录", dayun: candidates[0]!.localEngineOutput.dayun, screenshotReference: "review/screenshots/example.png" };
    expect(evaluateWenzhenCandidates(candidates)).toMatchObject({
      total: 150, observed: 1, matched: 1, matchRate: 1,
      fourPillarsMatched: 1, fourPillarsMatchRate: 1,
      dayunMatched: 1, dayunMatchRate: 1,
      qiyunMatched: 0, qiyunMatchRate: 0,
      nonBoundary: { total: 30, observed: 0, matched: 0, matchRate: null },
      boundary: { total: 120, observed: 1, matched: 1, explainedDifferences: 0, unexplainedDifferences: 0 },
      screenshotsPresent: 1,
      apiEvidencePresent: 0,
    });
  });
});
