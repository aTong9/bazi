import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { readDevelopmentTestMatrix } from "../../packages/testkit/src/read-development-test-matrix.js";
import { executeReportLanguageMatrix } from "../../packages/testkit/src/report-language-runner.js";

test("all 20 authoritative report-language risks are rejected with explicit violation codes", async () => {
  const definitions = await readDevelopmentTestMatrix(path.resolve("."));
  const records = executeReportLanguageMatrix(definitions);
  assert.equal(records.length, 20);
  assert.deepEqual(records.filter((record) => !record.passed), []);
  assert.ok(records.every((record) => /violationCodes/u.test(record.actualSummary)));
});
