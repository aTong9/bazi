import type { BirthInput, ChartConfig } from "./domain.js";
import { createFourPillarsChart } from "./four-pillars.js";
import { analyzeRelationship } from "./relationship-analysis.js";

export interface HumanCaseLabel {
  caseId: string;
  analystId: string;
  expectedRuleIds: string[];
  expectedTopics: string[];
  notes: string;
  birthInput?: BirthInput;
  chartConfig?: Partial<ChartConfig>;
}

export interface CaseRun { caseId: string; matchedRuleIds: string[]; conclusionTopics: string[] }
export interface CaseMetrics { caseCount: number; rulePrecision: number; ruleRecall: number; topicConflictRate: number }

export type FeedbackRating = "matches" | "does_not_match" | "cannot_judge";
export interface ConclusionFeedback {
  reportSchemaVersion: string;
  ruleSetVersion: string;
  conclusionId: string;
  evidenceRuleIds: string[];
  rating: FeedbackRating;
  recordedAt: string;
}
export interface FeedbackSummary {
  total: number;
  judged: number;
  matches: number;
  doesNotMatch: number;
  cannotJudge: number;
  agreementRate: number | null;
}

export function summarizeConclusionFeedback(items: ConclusionFeedback[]): FeedbackSummary {
  const matches = items.filter(item => item.rating === "matches").length;
  const doesNotMatch = items.filter(item => item.rating === "does_not_match").length;
  const cannotJudge = items.filter(item => item.rating === "cannot_judge").length;
  const judged = matches + doesNotMatch;
  return {
    total: items.length,
    judged,
    matches,
    doesNotMatch,
    cannotJudge,
    agreementRate: judged ? matches / judged : null,
  };
}

export function replayHumanCases(labels: HumanCaseLabel[]): CaseRun[] {
  return labels.filter(label => label.birthInput).map(label => {
    const analysis = analyzeRelationship(createFourPillarsChart(label.birthInput!, label.chartConfig));
    return { caseId: label.caseId, matchedRuleIds: analysis.trace.filter(item => item.status === "matched").map(item => item.ruleId), conclusionTopics: analysis.conclusions.map(item => item.topic) };
  });
}

export function evaluateCaseRuns(labels: HumanCaseLabel[], runs: CaseRun[]): CaseMetrics {
  const runById = new Map(runs.map(run => [run.caseId, run]));
  let truePositive = 0; let predicted = 0; let expected = 0; let conflicts = 0;
  for (const label of labels) {
    const run = runById.get(label.caseId);
    if (!run) continue;
    const expectedRules = new Set(label.expectedRuleIds);
    truePositive += run.matchedRuleIds.filter(id => expectedRules.has(id)).length;
    predicted += run.matchedRuleIds.length;
    expected += expectedRules.size;
    const expectedTopics = new Set(label.expectedTopics);
    if (run.conclusionTopics.some(topic => !expectedTopics.has(topic))) conflicts += 1;
  }
  return { caseCount: labels.filter(label => runById.has(label.caseId)).length, rulePrecision: predicted ? truePositive / predicted : 0, ruleRecall: expected ? truePositive / expected : 0, topicConflictRate: labels.length ? conflicts / labels.length : 0 };
}
