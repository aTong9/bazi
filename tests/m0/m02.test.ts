import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeM02, tenGodFor } from "../../packages/m0-engine/src/m02.js";

test("M02 keeps branch and hidden-stem polarity separate and maps ten gods relative to day master", () => {
  const result = analyzeM02({
    year: { stem: "庚", branch: "子" },
    month: { stem: "丙", branch: "丑" },
    day: { stem: "甲", branch: "午" },
    hour: { stem: "壬", branch: "申" },
  });

  assert.equal(result.pillars.year.branch.yinYang, "yang");
  assert.equal(result.pillars.year.branch.hiddenStems[0]?.stem, "癸");
  assert.equal(result.pillars.year.branch.hiddenStems[0]?.yinYang, "yin");
  assert.equal(result.pillars.year.branch.hiddenStems[0]?.exposed, false);
  assert.equal(result.pillars.year.stem.tenGod, "七杀");
  assert.equal(tenGodFor("乙", "庚"), "正官");
  assert.ok(result.matchedRuleIds.includes("M02-META-0039-V1.0"));
});
