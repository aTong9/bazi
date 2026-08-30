import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { executeM5RegressionMatrix } from "../../packages/testkit/src/m5-regression-runner.js";
import { readDevelopmentTestMatrix } from "../../packages/testkit/src/read-development-test-matrix.js";

test("executes all 32 M5 synthesis regressions", async () => {
  const records = executeM5RegressionMatrix(await readDevelopmentTestMatrix(path.resolve(".")));
  assert.equal(records.length, 32);
  assert.deepEqual(records.filter((record) => !record.passed), []);
});
