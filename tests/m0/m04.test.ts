import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeM04 } from "../../packages/m0-engine/src/m04.js";

test("M04 preserves position-level combine, control, and contention relations without applying effects", () => {
  const result = analyzeM04({
    year: { stem: "甲", branch: "子" }, month: { stem: "己", branch: "巳" },
    day: { stem: "甲", branch: "午" }, hour: { stem: "丙", branch: "寅" },
  });
  assert.equal(result.relations.filter((relation) => relation.type === "stem_combine").length, 2);
  assert.equal(result.relations.filter((relation) => relation.type === "stem_control").length, 2);
  assert.equal(result.contentions.length, 1);
  assert.deepEqual(result.relations.filter((relation) => relation.type === "stem_combine").map((relation) => relation.positions), [
    ["year", "month"], ["month", "day"],
  ]);
  assert.equal("strengthChange" in result, false);
});
