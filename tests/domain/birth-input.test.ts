import assert from "node:assert/strict";
import { test } from "node:test";

import { validateBirthInput } from "../../packages/domain/src/birth-input.js";

test("exact four-pillar input is rejected when the hour pillar is missing", () => {
  const result = validateBirthInput({
    inputMode: "four_pillars_provided",
    subjectId: "A",
    fourPillars: {
      year: { stem: "甲", branch: "子" },
      month: { stem: "丙", branch: "寅" },
      day: { stem: "庚", branch: "午" },
      hour: null,
    },
    birthTimeStatus: "exact",
    dataQuality: "high",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.issues[0]?.code, "E_EXACT_HOUR_REQUIRED");
});
