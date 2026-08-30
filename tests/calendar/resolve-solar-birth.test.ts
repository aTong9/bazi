import assert from "node:assert/strict";
import test from "node:test";

import { CALENDAR_ADAPTER, formatFourPillars, resolveSolarBirth } from "../../packages/calendar/src/resolve-solar-birth.js";

test("resolves the official library example without depending on the host timezone", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    const result = resolveSolarBirth("1986-05-29T12:00");
    assert.equal(result.status, "resolved");
    if (result.status !== "resolved") return;
    assert.equal(formatFourPillars(result.fourPillars), "丙寅 癸巳 癸酉 戊午");
    assert.equal(result.provenance.civilTimeBasis, "UTC+08:00");
    assert.equal(result.provenance.trueSolarTimeApplied, false);
  } finally {
    process.env.TZ = previous;
  }
});

test("stops unique publication inside the solar-term safety window", () => {
  const result = resolveSolarBirth("2024-02-04T16:26");
  assert.equal(result.status, "boundary_unresolved");
  if (result.status !== "boundary_unresolved") return;
  assert.equal(result.reason, "solar_term");
  assert.deepEqual(result.candidates.map(formatFourPillars), ["癸卯 乙丑 戊戌 庚申", "甲辰 丙寅 戊戌 庚申"]);
});

test("resolves after the solar-term safety window", () => {
  const result = resolveSolarBirth("2024-02-04T17:03");
  assert.equal(result.status, "resolved");
  if (result.status === "resolved") assert.equal(formatFourPillars(result.fourPillars), "甲辰 丙寅 戊戌 辛酉");
});

test("stops at disputed Zi-hour and narrow hour boundaries", () => {
  assert.equal(resolveSolarBirth("2024-06-01T23:30").status, "boundary_unresolved");
  const boundary = resolveSolarBirth("2024-06-01T01:01");
  assert.equal(boundary.status, "boundary_unresolved");
  if (boundary.status === "boundary_unresolved") assert.equal(boundary.reason, "hour_boundary");
});

test("rejects malformed and unsupported dates", () => {
  assert.equal(resolveSolarBirth("2024-02-30T12:00").status, "invalid");
  assert.equal(resolveSolarBirth("1900-01-01T12:00").status, "unsupported");
  assert.equal(CALENDAR_ADAPTER.version, "1.8.6");
});
