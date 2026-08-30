import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeM05 } from "../../packages/m0-engine/src/m05.js";

test("M05 keeps 巳申 harmony, punishment, and break as independent relation instances", () => {
  const result = analyzeM05([
    { position: "year", branch: "巳" },
    { position: "month", branch: "申" },
  ]);
  assert.deepEqual(result.relations.map((relation) => relation.type).sort(), [
    "break", "local_punishment", "six_harmony",
  ]);
  assert.equal("strengthChange" in result, false);

  const incomplete = analyzeM05([
    { position: "year", branch: "寅" },
    { position: "month", branch: "寅" },
    { position: "day", branch: "巳" },
  ]);
  assert.equal(incomplete.relations.some((relation) => relation.type === "three_punishment"), false);
});
