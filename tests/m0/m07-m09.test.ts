import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeM02 } from "../../packages/m0-engine/src/m02.js";
import { analyzeM03 } from "../../packages/m0-engine/src/m03.js";
import { analyzeM07 } from "../../packages/m0-engine/src/m07.js";
import { analyzeM08 } from "../../packages/m0-engine/src/m08.js";
import { analyzeM09 } from "../../packages/m0-engine/src/m09.js";

const chart = analyzeM02({
  year: { stem: "甲", branch: "寅" }, month: { stem: "丙", branch: "寅" },
  day: { stem: "庚", branch: "申" }, hour: { stem: "壬", branch: "子" },
});

test("M07 preserves seasonal, root, exposure, source, and ally evidence per element", () => {
  const result = analyzeM07(chart, analyzeM03(chart));
  assert.equal(result.elements.木.seasonalState, "prosperous");
  assert.ok(result.elements.木.visibleStemPositions.includes("year"));
  assert.ok(result.elements.金.rootPositions.includes("day"));
  assert.ok(result.elements.水.sourceElements.includes("金"));
  assert.equal(result.finalStrengthDeclared, false);
});

test("M08 applies only supported object effects and keeps unresolved effects pending", () => {
  const m07 = analyzeM07(chart, analyzeM03(chart));
  const result = analyzeM08(m07, {
    moduleId: "M0.M06", status: "partial", matchedRuleIds: [], decisionLog: [],
    forbiddenConclusions: ["final_strength", "pattern", "favorability", "useful_god"],
    effects: [
      { id: "supported", relationId: "r1", objectRef: "day", effect: "root_damage_candidate", status: "supported", ruleIds: [], conditions: [], counterevidence: [] },
      { id: "pending", relationId: "r2", objectRef: "year", effect: "combination_pull", status: "conditional", ruleIds: [], conditions: [], counterevidence: [] },
    ],
  });
  assert.ok(result.elements.金.appliedEffects.includes("supported"));
  assert.ok(result.pendingEffectIds.includes("pending"));
  assert.equal(result.elements.木.appliedEffects.length, 0);
});

test("M09 synthesizes both support and burden evidence without a single-factor verdict", () => {
  const m03 = analyzeM03(chart);
  const result = analyzeM09(chart, m03, analyzeM08(analyzeM07(chart, m03), emptyM06()));
  assert.ok(result.supportEvidence.length > 0);
  assert.ok(result.burdenEvidence.length > 0);
  assert.ok(["weak_candidate", "balanced_candidate", "strong_candidate"].includes(result.strengthCandidate));
  assert.equal(result.finalVerdict, false);
});

function emptyM06() {
  return {
    moduleId: "M0.M06" as const, status: "partial" as const, effects: [], matchedRuleIds: [], decisionLog: [],
    forbiddenConclusions: ["final_strength", "pattern", "favorability", "useful_god"] as const,
  };
}
