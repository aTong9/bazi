import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAnalysisReport, validateReportLanguage } from "../../packages/reporting/src/build-report.js";
import { validateAnalysisReport } from "../../packages/contracts/src/analysis-report-contract.js";

const base = {
  analysisRunId: "run-1", rulesetDigest: "a".repeat(64), reportStatus: "limited" as const, safetyStatus: "insufficient_data" as const,
  fit: { grade: "FG1" as const, assessment: "AF01" as const },
  m0Fields: { day_master: { status: "supported", value: "甲木", confidence: "high", rule_ids: ["M02-001"], evidence_ids: ["SRC-1"] } },
  profileStatements: ["在关系中可能需要明确表达边界。"], riskChains: [{ id: "M4-C01", candidate: "压力下表达可能收缩", realityStatus: "unconfirmed" }],
  realityGates: (["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"] as const).map((id) => ({ id, label: `现实闸门 ${id}`, status: "not_assessed", evidenceIds: [] })),
  ruleIds: ["M02-001", "M4-BASE-001"], sourceIds: ["SRC-1"], eventIds: [], dedupLog: ["SRC-1 counted once"], conflictLog: [], discardedCandidates: ["未确认的现实伤害"],
};

test("ReportBuilder projects adjudicated data without changing status, confidence, FG, or facts", () => {
  const report = buildAnalysisReport(base);
  assert.equal(report.reportStatus, "limited");
  assert.equal(report.evidenceGrade, "FG1");
  assert.equal(report.assessment, "AF01");
  assert.deepEqual(report.fields, base.m0Fields);
  assert.deepEqual(report.trace.ruleIds, base.ruleIds);
  assert.ok(report.boundaries.every((boundary) => boundary.hard === true));
  assert.equal(report.observationPlan[0]?.directive, false);
  assert.deepEqual(validateAnalysisReport(report), []);
});

test("safety stop publishes only the necessary safety section and no ordinary fit narrative", () => {
  const report = buildAnalysisReport({ ...base, reportStatus: "stop", safetyStatus: "safety_stop", fit: { grade: "FG0", assessment: "AF09" }, safetyReason: "现实资料触发安全停止" });
  assert.deepEqual(report.sections.map((section) => section.id), ["safety"]);
  assert.equal(report.evidenceGrade, "FG0");
  assert.equal(report.assessment, "AF09");
  assert.equal(report.sections[0]?.body.includes("具体敏感细节"), false);
  assert.deepEqual(validateAnalysisReport(report), []);
});

test("report contract rejects semantic safety mismatches after structural validation", () => {
  const report = buildAnalysisReport(base);
  assert.ok(validateAnalysisReport({ ...report, safetyStatus: "safety_stop" }).some((error) => error.includes("stop/FG0/AF09")));
  assert.ok(validateAnalysisReport({ ...report, realityGates: [...report.realityGates.slice(0, 7), report.realityGates[0]] }).some((error) => error.includes("exactly once")));
});

test("report language rejects deterministic, medical, coercive, and success-probability claims", () => {
  for (const text of ["这是你唯一的正缘", "你们必然结婚", "你患有抑郁症", "你必须马上分手", "婚姻成功率为90%"])
    assert.ok(validateReportLanguage(text).length > 0, text);
  assert.deepEqual(validateReportLanguage("这是一项待现实核验的结构候选，不构成行动指令。"), []);
});
