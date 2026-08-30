import assert from "node:assert/strict";
import { test } from "node:test";
import { assessM0InputQuality } from "../../packages/application/src/assess-m0-input-quality.js";

test("unresolved calendar boundary and missing timezone stop unique M0 publication", () => {
  const boundary = assessM0InputQuality({ timezoneKnown: true, calendarBoundaryCandidates: 2 });
  assert.equal(boundary.status, "stopped"); assert.equal(boundary.candidateMode, "dual");
  assert.equal(boundary.issues[0]?.code, "E_CALENDAR_BOUNDARY_UNRESOLVED"); assert.ok(boundary.ruleTrace.includes("M03-PROC-0019-V1.0"));
  const incomplete = assessM0InputQuality({ timezoneKnown: false, calendarBoundaryCandidates: 2 });
  assert.ok(incomplete.issues.some((issue) => issue.code === "E_TIMEZONE_REQUIRED")); assert.ok(incomplete.ruleTrace.includes("M19-META-0001-V1.0"));
});
