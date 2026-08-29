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
import { analyzeM1 } from "../../packages/relationship-engine/src/m1.js";
import { analyzeM2 } from "../../packages/relationship-engine/src/m2.js";

const m02 = analyzeM02({ year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } });
const m03 = analyzeM03(m02); const m08 = analyzeM08(analyzeM07(m02, m03), { moduleId: "M0.M06", status: "partial", effects: [], matchedRuleIds: [], decisionLog: [], forbiddenConclusions: ["final_strength", "pattern", "favorability", "useful_god"] });
const m09 = analyzeM09(m02, m03, m08); const m10 = analyzeM10(m02, m08, m09);

test("M1 requires an explicit traditional spouse-star role and never guesses it", async () => {
  const rules = await rulesForTest();
  const unspecified = analyzeM1({ roleBasis: "unspecified", m10, rules });
  assert.equal(unspecified.status, "dependency_pending");
  assert.deepEqual(unspecified.prototypes, []);
  assert.ok(unspecified.dependencyFlags.includes("M1_TRADITIONAL_ROLE_BASIS_REQUIRED"));

  const explicit = analyzeM1({ roleBasis: "female_traditional", m10, rules });
  assert.ok(explicit.prototypes.some((prototype) => prototype.tenGod === "七杀"));
  assert.ok(explicit.ruleTrace.length > 0);
  assert.equal(explicit.forbiddenInferences.includes("relationship_outcome"), true);
});

test("M2 builds gate, qualification, self-position, flow, dual, tempo, and synthesis without calendar prediction", async () => {
  const rules = await rulesForTest(); const m1 = analyzeM1({ roleBasis: "female_traditional", m10, rules });
  const result = analyzeM2({ m02, m09, m10, m1, rules });
  assert.equal(result.status, "provisional");
  assert.equal(result.gate.dayBranchTenGod, "比肩");
  assert.ok(result.flow.end.length > 0);
  assert.ok(result.tempo.evidenceRounds >= 1);
  assert.equal(result.tempo.calendarDuration, null);
  assert.ok(result.synthesis.scopeBoundary.includes("不预测具体时间"));
  assert.ok(result.ruleTrace.every((id) => /^M2-/u.test(id)));
});

async function rulesForTest() {
  const catalog = await importCatalog({ repositoryRoot: path.resolve(".") });
  return { getModuleRecords: (moduleId: string) => catalog.records.filter((record) => record.moduleId === moduleId) };
}
