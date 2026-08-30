import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeM02 } from "../../packages/m0-engine/src/m02.js";
import { analyzeM03 } from "../../packages/m0-engine/src/m03.js";

test("M03 distinguishes direct roots from same-element roots without inferring day-master strength", () => {
  const direct = analyzeM03(analyzeM02({
    year: { stem: "庚", branch: "申" }, month: { stem: "戊", branch: "寅" },
    day: { stem: "甲", branch: "午" }, hour: { stem: "壬", branch: "辰" },
  }));
  assert.ok(direct.dayMasterRoots.some((root) => root.branch === "寅" && root.kind === "direct" && root.level === "strong"));
  assert.equal("dayMasterStrength" in direct, false);

  const similar = analyzeM03(analyzeM02({
    year: { stem: "庚", branch: "申" }, month: { stem: "己", branch: "卯" },
    day: { stem: "甲", branch: "午" }, hour: { stem: "壬", branch: "辰" },
  }));
  assert.ok(similar.dayMasterRoots.some((root) => root.branch === "卯" && root.kind === "same_element"));
  assert.equal(similar.calendarVerified, false);
});
