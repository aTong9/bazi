import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeM02 } from "../../packages/m0-engine/src/m02.js";
import { analyzeM03 } from "../../packages/m0-engine/src/m03.js";
import { analyzeM04 } from "../../packages/m0-engine/src/m04.js";
import { analyzeM05 } from "../../packages/m0-engine/src/m05.js";
import { analyzeM06 } from "../../packages/m0-engine/src/m06.js";

test("M06 emits per-object clash activation candidates without fixed strength loss or favorability", () => {
  const chart = {
    year: { stem: "庚", branch: "申" }, month: { stem: "戊", branch: "寅" },
    day: { stem: "甲", branch: "午" }, hour: { stem: "壬", branch: "辰" },
  } as const;
  const m02 = analyzeM02(chart);
  const m05 = analyzeM05([
    { position: "year", branch: "申" }, { position: "month", branch: "寅" },
    { position: "day", branch: "午" }, { position: "hour", branch: "辰" },
  ]);
  const clash = m05.relations.find((relation) => relation.type === "clash");
  assert.ok(clash);
  const result = analyzeM06(analyzeM03(m02), analyzeM04(chart), m05);
  const effects = result.effects.filter((effect) => effect.relationId === clash.id);
  assert.equal(effects.length, 2);
  assert.ok(effects.every((effect) => effect.effect === "activation_candidate"));
  assert.equal("strengthChange" in result, false);
  assert.equal("favorability" in result, false);
});
