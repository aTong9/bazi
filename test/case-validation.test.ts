import { describe, expect, it } from "vitest";
import { evaluateCaseRuns, replayHumanCases, summarizeConclusionFeedback } from "../src/index.js";

describe("anonymous case replay metrics", () => {
  it("reports precision, recall and topic conflict rate from human labels", () => {
    const result = evaluateCaseRuns([{ caseId: "anon-1", analystId: "reviewer-1", expectedRuleIds: ["r1", "r2"], expectedTopics: ["spouse_star"], notes: "" }], [{ caseId: "anon-1", matchedRuleIds: ["r1", "r3"], conclusionTopics: ["spouse_star", "peach_blossom"] }]);
    expect(result).toEqual({ caseCount: 1, rulePrecision: 0.5, ruleRecall: 0.5, topicConflictRate: 1 });
  });

  it("replays labelled cases from deterministic birth inputs", () => {
    const runs = replayHumanCases([{ caseId: "anon-2", analystId: "reviewer-1", expectedRuleIds: [], expectedTopics: [], notes: "", birthInput: { calendarType: "gregorian", gender: "female", localDate: "1990-06-15", localTime: "10:30", timeZone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737 } }]);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.matchedRuleIds.length).toBeGreaterThan(0);
  });

  it("keeps cannot-judge feedback outside the agreement denominator", () => {
    const common = { reportSchemaVersion: "relationship-report-v1", ruleSetVersion: "rules-v1", conclusionId: "c", evidenceRuleIds: ["r"], recordedAt: "2026-08-09T00:00:00Z" };
    expect(summarizeConclusionFeedback([
      { ...common, rating: "matches" },
      { ...common, rating: "does_not_match" },
      { ...common, rating: "cannot_judge" },
    ])).toEqual({ total: 3, judged: 2, matches: 1, doesNotMatch: 1, cannotJudge: 1, agreementRate: 0.5 });
  });
});
