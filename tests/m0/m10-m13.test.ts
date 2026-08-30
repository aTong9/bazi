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

const m02 = analyzeM02({ year: { stem: "壬", branch: "子" }, month: { stem: "丙", branch: "午" }, day: { stem: "庚", branch: "申" }, hour: { stem: "甲", branch: "寅" } });
const m03 = analyzeM03(m02);
const m08 = analyzeM08(analyzeM07(m02, m03), { moduleId: "M0.M06", status: "partial", effects: [], matchedRuleIds: [], decisionLog: [], forbiddenConclusions: ["final_strength", "pattern", "favorability", "useful_god"] });
const m09 = analyzeM09(m02, m03, m08);

test("M10 separates ten-god presence, effective power, purity, and favorability", () => {
  const result = analyzeM10(m02, m08, m09);
  assert.ok(result.tenGods.食神.visiblePositions.includes("year"));
  assert.equal(result.tenGods.食神.favorability, "pending");
  assert.notEqual(result.tenGods.食神.presence, "absent");
});

test("M11 emits combination candidates only when each participant exists", () => {
  const result = analyzeM11(analyzeM10(m02, m08, m09), m09);
  assert.ok(result.combinations.some((item) => item.name === "食伤生财"));
  assert.ok(result.combinations.every((item) => item.status === "candidate"));
  assert.equal(result.patternDeclared, false);
});

test("M12 records source-bridge-end paths and explicit block points", () => {
  const result = analyzeM12(m08);
  assert.equal(result.paths.length, 5);
  assert.ok(result.paths.every((path) => path.source && path.bridge && path.end));
  assert.ok(result.paths.some((path) => path.status === "open" || path.blockPoint === "bridge"));
});

test("M13 keeps temperature and humidity as independent axes", () => {
  const result = analyzeM13(m02, m08);
  assert.equal(result.temperature.baseline, "hot");
  assert.ok(["dry", "balanced", "humid"].includes(result.humidity.state));
  assert.notStrictEqual(result.temperature, result.humidity);
  assert.equal(result.finalUsefulGodDeclared, false);
});
