import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeM02 } from "../../packages/m0-engine/src/m02.js";
import { analyzeM03 } from "../../packages/m0-engine/src/m03.js";
import { analyzeM07 } from "../../packages/m0-engine/src/m07.js";
import { analyzeM08 } from "../../packages/m0-engine/src/m08.js";
import { analyzeM09 } from "../../packages/m0-engine/src/m09.js";
import { analyzeM10 } from "../../packages/m0-engine/src/m10.js";
import { analyzeM11 } from "../../packages/m0-engine/src/m11.js";
import { analyzeM13 } from "../../packages/m0-engine/src/m13.js";
import { analyzeM18 } from "../../packages/m0-engine/src/m18.js";
import type { M15Result } from "../../packages/m0-engine/src/m15.js";
import type { M16Result } from "../../packages/m0-engine/src/m16.js";
import type { M17Result } from "../../packages/m0-engine/src/m17.js";

const emptyM06 = { moduleId: "M0.M06" as const, status: "partial" as const, effects: [], matchedRuleIds: [], decisionLog: [], forbiddenConclusions: ["final_strength", "pattern", "favorability", "useful_god"] as const };

test("M07 does not turn multiple exposed peers into an automatic strong verdict when season and roots oppose", () => {
  const m02 = analyzeM02({ year: { stem: "甲", branch: "申" }, month: { stem: "乙", branch: "酉" }, day: { stem: "甲", branch: "午" }, hour: { stem: "乙", branch: "丑" } });
  assert.notEqual(analyzeM07(m02, analyzeM03(m02)).elements.木.rawStrengthCandidate, "strong_candidate");
});

test("M08 never exposes a fixed-percentage strength adjustment", () => {
  const m02 = analyzeM02({ year: { stem: "甲", branch: "子" }, month: { stem: "丙", branch: "寅" }, day: { stem: "庚", branch: "午" }, hour: { stem: "壬", branch: "申" } });
  assert.equal(analyzeM08(analyzeM07(m02, analyzeM03(m02)), emptyM06).fixedPercentageAdjustmentUsed, false);
});

test("M09 keeps a rooted day master at a candidate grade when burden evidence remains", () => {
  const m02 = analyzeM02({ year: { stem: "丙", branch: "午" }, month: { stem: "庚", branch: "申" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "戊", branch: "辰" } });
  const m03 = analyzeM03(m02); const result = analyzeM09(m02, m03, analyzeM08(analyzeM07(m02, m03), emptyM06));
  assert.equal(result.finalVerdict, false); assert.ok(result.supportEvidence.some((item) => item.startsWith("ROOT:")));
});

test("M10 records a hidden ten god without claiming it is visible", () => {
  const m02 = analyzeM02({ year: { stem: "甲", branch: "子" }, month: { stem: "己", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } });
  const m03 = analyzeM03(m02); const m08 = analyzeM08(analyzeM07(m02, m03), emptyM06); const state = analyzeM10(m02, m08, analyzeM09(m02, m03, m08)).tenGods.正官;
  assert.equal(state.presence, "hidden"); assert.equal(state.visiblePositions.length, 0);
});

test("M11 combination candidates cannot declare a final pattern", () => {
  const m02 = analyzeM02({ year: { stem: "丙", branch: "午" }, month: { stem: "庚", branch: "申" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "壬", branch: "子" } });
  const m03 = analyzeM03(m02); const m08 = analyzeM08(analyzeM07(m02, m03), emptyM06); const m09 = analyzeM09(m02, m03, m08);
  assert.equal(analyzeM11(analyzeM10(m02, m08, m09), m09).patternDeclared, false);
});

test("M13 corrects a winter baseline with effective fire instead of freezing the month label", () => {
  const m02 = analyzeM02({ year: { stem: "丙", branch: "午" }, month: { stem: "壬", branch: "子" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丁", branch: "巳" } });
  const m03 = analyzeM03(m02); const result = analyzeM13(m02, analyzeM08(analyzeM07(m02, m03), emptyM06));
  assert.equal(result.temperature.baseline, "cold"); assert.notEqual(result.temperature.state, "cold");
});

test("M18 hard pattern constraints beat multiple soft benefits", () => {
  const dimensions = { balance: "benefit", pattern: "conflict", flow: "benefit", climate: "benefit", medicine: "benefit" } as const;
  const row = (element: "木" | "火" | "土" | "金" | "水", conflict = false) => ({ element, dimensions: conflict ? dimensions : { ...dimensions, pattern: "neutral" as const }, benefits: ["A", "B"], conflicts: conflict ? ["DAMAGES_FORMED_PATTERN"] : [], sideEffects: ["DOSE_DEPENDENT"] });
  const m17: M17Result = { moduleId: "M0.M17", status: "complete", matrix: { 木: row("木", true), 火: row("火"), 土: row("土"), 金: row("金"), 水: row("水") }, matchedRuleIds: [], finalUsefulGodDeclared: false };
  const m15: M15Result = { moduleId: "M0.M15", status: "complete", evaluations: [], matchedRuleIds: [] };
  const m16: M16Result = { moduleId: "M0.M16", status: "complete", problems: [], medicines: [], matchedRuleIds: [] };
  assert.equal(analyzeM18(m17, m15, m16).decisions.木.classification, "avoid");
});

test("M18 always emits minimum-effective and stop boundaries for every element", () => {
  const neutral = (element: "木" | "火" | "土" | "金" | "水") => ({ element, dimensions: { balance: "neutral", pattern: "unknown", flow: "neutral", climate: "neutral", medicine: "neutral" } as const, benefits: [], conflicts: [], sideEffects: [] });
  const m17: M17Result = { moduleId: "M0.M17", status: "limited", matrix: { 木: neutral("木"), 火: neutral("火"), 土: neutral("土"), 金: neutral("金"), 水: neutral("水") }, matchedRuleIds: [], finalUsefulGodDeclared: false };
  const result = analyzeM18(m17, { moduleId: "M0.M15", status: "limited", evaluations: [], matchedRuleIds: [] }, { moduleId: "M0.M16", status: "limited", problems: [], medicines: [], matchedRuleIds: [] });
  assert.ok(Object.values(result.decisions).every((decision) => decision.doseBoundary.includes("MINIMUM_EFFECTIVE_DOSE") && decision.doseBoundary.includes("STOP_IF_SECONDARY_IMBALANCE")));
});
