import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeM4 } from "../../packages/relationship-engine/src/m4.js";
import { analyzeM5 } from "../../packages/relationship-engine/src/m5.js";
import type { M3Result } from "../../packages/relationship-engine/src/m3.js";

const m3 = {
  moduleId: "M3.SYNTH", status: "provisional",
  channels: {
    base: { moduleId: "M3.BASE", anchorTenGod: "比肩", statements: ["需要保留自主空间"], outputSlots: [], ruleIds: ["M3-BASE-001"], status: "provisional" },
    expression: { moduleId: "M3.EXPR", anchorTenGod: "比肩", statements: ["压力下表达收缩"], outputSlots: [], ruleIds: [], status: "provisional" },
    care: { moduleId: "M3.CARE", anchorTenGod: "比肩", statements: [], outputSlots: [], ruleIds: [], status: "provisional" },
    boundary: { moduleId: "M3.BOUND", anchorTenGod: "比肩", statements: ["边界需明确确认"], outputSlots: [], ruleIds: [], status: "provisional" },
    conflict: { moduleId: "M3.CONFLICT", anchorTenGod: "比肩", statements: ["冲突后需要暂停"], outputSlots: [], ruleIds: [], status: "provisional" },
  },
  state: { activeState: "pressure", modifiers: ["REDUCE_CHANNEL_FLUENCY"], preservesBaseline: true },
  repair: { trigger: "PRESSURE_OR_CHANNEL_BREAK", steps: ["暂停", "确认边界"], stopConditions: ["CONSENT_WITHDRAWN"] },
  synthesis: { primaryChannels: ["boundary", "conflict"], statements: ["边界需明确确认"] },
  dependencyFlags: [], boundaries: [], ruleTrace: ["M3-BASE-001"],
} satisfies M3Result;

test("M4 keeps chart-derived risk as an unconfirmed structural candidate", () => {
  const result = analyzeM4({ m3, observations: [] });
  assert.equal(result.status, "provisional");
  assert.ok(result.riskChains.length > 0);
  assert.ok(result.riskChains.every((chain) => chain.realityStatus === "unconfirmed"));
  assert.ok(result.boundaries.includes("结构风险不等于现实伤害"));
  assert.deepEqual(result.stageOrder, ["BASE", "MISREAD", "OVERUSE", "TRIGGER", "LOOP", "REPAIR", "BUFFER", "SYNTH"]);
});

test("M4 only confirms a pattern with repeated independent observations and keeps repair on the same chain", () => {
  const result = analyzeM4({ m3, observations: [
    { id: "o1", chainId: "M4-C01", source: "self_report", context: "conflict", direction: "supports" },
    { id: "o2", chainId: "M4-C01", source: "partner_report", context: "pressure", direction: "supports" },
  ] });
  const chain = result.riskChains.find((item) => item.id === "M4-C01");
  assert.equal(chain?.realityStatus, "observed_pattern");
  assert.equal(chain?.repair.chainId, chain?.id);
  assert.equal(chain?.buffer.chainId, chain?.id);
});

test("single-chart M5 emits every reality gate once and cannot exceed FG1", () => {
  const result = analyzeM5({ mode: "single_chart_relationship_profile", m4: analyzeM4({ m3, observations: [] }) });
  assert.deepEqual(result.realityGates.map((gate) => gate.id), ["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"]);
  assert.ok(result.realityGates.every((gate) => gate.status === "not_assessed"));
  assert.equal(result.fit.grade, "FG1");
  assert.equal(result.fit.assessment, "AF01");
  assert.equal(result.partnerFacts, null);
  assert.equal(result.notADirective, true);
});

test("RG01 safety failure stops ordinary fit reporting with FG0 and AF09", () => {
  const result = analyzeM5({ mode: "specific_partner_with_reality_data", m4: analyzeM4({ m3, observations: [] }), gateAssessments: [
    { id: "RG01", status: "fail", evidenceIds: ["safe-1"], note: "现实中存在强迫或暴力" },
  ] });
  assert.equal(result.reportStatus, "stop");
  assert.equal(result.safetyStatus, "safety_stop");
  assert.equal(result.fit.grade, "FG0");
  assert.equal(result.fit.assessment, "AF09");
  assert.deepEqual(result.fit.ordinaryFindings, []);
});

test("unknown or failed core gates cap publication at FG2", () => {
  const assessments = (["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"] as const).map((id) => ({ id, status: id === "RG03" ? "fail" as const : "pass" as const, evidenceIds: [`e-${id}`] }));
  const result = analyzeM5({ mode: "specific_partner_with_reality_data", m4: analyzeM4({ m3, observations: [] }), gateAssessments: assessments });
  assert.equal(result.fit.grade, "FG2");
  assert.equal(result.fit.assessment, "AF08");
});
