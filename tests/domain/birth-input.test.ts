import assert from "node:assert/strict";
import { test } from "node:test";

import { birthInputDependencyFlags, validateBirthInput } from "../../packages/domain/src/birth-input.js";

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

test("synthetic fixtures bypass calendar-cycle consistency but production input does not", () => {
  const subject = {
    inputMode: "four_pillars_provided" as const, subjectId: "fixture",
    fourPillars: { year: { stem: "甲" as const, branch: "子" as const }, month: { stem: "乙" as const, branch: "卯" as const }, day: { stem: "丙" as const, branch: "子" as const }, hour: { stem: "丁" as const, branch: "卯" as const } },
    birthTimeStatus: "exact" as const, dataQuality: "high" as const,
  };
  assert.equal(validateBirthInput(subject).ok, false);
  assert.equal(validateBirthInput({ ...subject, syntheticFixture: true }).ok, true);
});

test("non-high data quality limits publication even when the hour is exact", () => {
  const input = {
    inputMode: "four_pillars_provided" as const, subjectId: "A",
    fourPillars: { year: { stem: "甲" as const, branch: "子" as const }, month: { stem: "丙" as const, branch: "寅" as const }, day: { stem: "庚" as const, branch: "午" as const }, hour: { stem: "壬" as const, branch: "午" as const } },
    birthTimeStatus: "exact" as const, dataQuality: "low" as const,
  };
  const result = validateBirthInput(input);
  assert.equal(result.ok && result.limited, true);
  assert.deepEqual(birthInputDependencyFlags(input), ["DATA_QUALITY_LOW"]);
});
