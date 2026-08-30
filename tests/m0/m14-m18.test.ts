import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeM02 } from "../../packages/m0-engine/src/m02.js";
import { analyzeM03 } from "../../packages/m0-engine/src/m03.js";
import { analyzeM07 } from "../../packages/m0-engine/src/m07.js";
import { analyzeM08 } from "../../packages/m0-engine/src/m08.js";
import { analyzeM09 } from "../../packages/m0-engine/src/m09.js";
import { analyzeM10 } from "../../packages/m0-engine/src/m10.js";
import { analyzeM11 } from "../../packages/m0-engine/src/m11.js";
import { analyzeM12 } from "../../packages/m0-engine/src/m12.js";
import { analyzeM13 } from "../../packages/m0-engine/src/m13.js";
import { analyzeM14 } from "../../packages/m0-engine/src/m14.js";
import { analyzeM15 } from "../../packages/m0-engine/src/m15.js";
import { analyzeM16 } from "../../packages/m0-engine/src/m16.js";
import { analyzeM17 } from "../../packages/m0-engine/src/m17.js";
import { analyzeM18 } from "../../packages/m0-engine/src/m18.js";

const m02 = analyzeM02({ year: { stem: "壬", branch: "子" }, month: { stem: "丙", branch: "午" }, day: { stem: "庚", branch: "申" }, hour: { stem: "甲", branch: "寅" } });
const m03 = analyzeM03(m02);
const m08 = analyzeM08(analyzeM07(m02, m03), { moduleId: "M0.M06", status: "partial", effects: [], matchedRuleIds: [], decisionLog: [], forbiddenConclusions: ["final_strength", "pattern", "favorability", "useful_god"] });
const m09 = analyzeM09(m02, m03, m08); const m10 = analyzeM10(m02, m08, m09); const m11 = analyzeM11(m10, m09);
const m12 = analyzeM12(m08); const m13 = analyzeM13(m02, m08); const m14 = analyzeM14(m02, m09, m10, m11);
const m15 = analyzeM15(m14, m10, m11); const m16 = analyzeM16(m09, m12, m13, m15);
const m17 = analyzeM17(m09, m12, m13, m15, m16);

test("M14 generates candidates before elimination and does not declare a pattern", () => {
  assert.ok(m14.candidates.length > 0);
  assert.ok(m14.candidates.every((candidate) => candidate.status === "candidate"));
  assert.equal(m14.finalPatternDeclared, false);
});

test("M15 keeps formation, damage, and rescue as separate fields", () => {
  assert.ok(m15.evaluations.length > 0);
  assert.ok(m15.evaluations.every((item) => "damage" in item && "rescue" in item));
});

test("M16 distinguishes root illness from surface symptoms and checks medicine reachability", () => {
  assert.ok(m16.problems.length > 0);
  assert.ok(m16.problems.every((problem) => problem.rootCause && problem.surfaceSymptom));
  assert.ok(m16.medicines.every((medicine) => medicine.routeStatus !== undefined));
});

test("M17 evaluates every element across five dimensions without choosing a final useful god", () => {
  assert.equal(Object.keys(m17.matrix).length, 5);
  assert.ok(Object.values(m17.matrix).every((row) => Object.keys(row.dimensions).length === 5));
  assert.equal(m17.finalUsefulGodDeclared, false);
});

test("M18 applies explicit hard constraints and returns dose-bounded classifications", () => {
  const result = analyzeM18(m17, m15, m16);
  assert.equal(Object.keys(result.decisions).length, 5);
  assert.ok(Object.values(result.decisions).every((decision) => decision.doseBoundary.length > 0));
  assert.ok(result.decisionLog.length > 0);
});
