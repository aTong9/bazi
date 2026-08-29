import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { importCatalog } from "../../packages/catalog/src/import-catalog.js";
import { analyzeM02 } from "../../packages/m0-engine/src/m02.js";
import { analyzeM03 } from "../../packages/m0-engine/src/m03.js";
import { analyzeM07 } from "../../packages/m0-engine/src/m07.js";
import { analyzeM08 } from "../../packages/m0-engine/src/m08.js";
import { analyzeM09 } from "../../packages/m0-engine/src/m09.js";
import { analyzeM10 } from "../../packages/m0-engine/src/m10.js";
import { analyzeM3 } from "../../packages/relationship-engine/src/m3.js";

test("M3 closes BASE, EXPR, CARE, BOUND, CONFLICT, STATE, REPAIR, and SYNTH without personality diagnosis", async () => {
  const catalog = await importCatalog({ repositoryRoot: path.resolve(".") });
  const rules = { getModuleRecords: (moduleId: string) => catalog.records.filter((record) => record.moduleId === moduleId) };
  const m02 = analyzeM02({ year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } });
  const m03 = analyzeM03(m02); const m08 = analyzeM08(analyzeM07(m02, m03), { moduleId: "M0.M06", status: "partial", effects: [], matchedRuleIds: [], decisionLog: [], forbiddenConclusions: ["final_strength", "pattern", "favorability", "useful_god"] });
  const m09 = analyzeM09(m02, m03, m08); const result = analyzeM3({ m02, m09, m10: analyzeM10(m02, m08, m09), rules });
  assert.deepEqual(Object.keys(result.channels), ["base", "expression", "care", "boundary", "conflict"]);
  assert.ok(result.state.activeState === "steady" || result.state.activeState === "pressure");
  assert.ok(result.repair.steps.length >= 4);
  assert.ok(result.synthesis.primaryChannels.length > 0);
  assert.deepEqual(result.dependencyFlags, []);
  assert.ok(result.boundaries.includes("不推断人格或依恋类型"));
  assert.ok(result.ruleTrace.every((id) => /^M3-/u.test(id)));
});

test("M3 STATE changes expression conditions under pressure without replacing the baseline", async () => {
  const catalog = await importCatalog({ repositoryRoot: path.resolve(".") });
  const rules = { getModuleRecords: (moduleId: string) => catalog.records.filter((record) => record.moduleId === moduleId) };
  const m02 = analyzeM02({ year: { stem: "庚", branch: "申" }, month: { stem: "辛", branch: "酉" }, day: { stem: "甲", branch: "午" }, hour: { stem: "戊", branch: "戌" } });
  const m03 = analyzeM03(m02); const m08 = analyzeM08(analyzeM07(m02, m03), { moduleId: "M0.M06", status: "partial", effects: [], matchedRuleIds: [], decisionLog: [], forbiddenConclusions: ["final_strength", "pattern", "favorability", "useful_god"] });
  const m09 = analyzeM09(m02, m03, m08); const result = analyzeM3({ m02, m09, m10: analyzeM10(m02, m08, m09), rules });
  assert.equal(result.state.activeState, "pressure");
  assert.ok(result.state.modifiers.includes("REDUCE_CHANNEL_FLUENCY"));
  assert.ok(result.channels.base.statements.length > 0);
});
