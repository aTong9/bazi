import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { readDevelopmentTestMatrix, TEST_MATRIX_SUITES } from "../../packages/testkit/src/read-development-test-matrix.js";

test("the authoritative development matrix exposes 407 unique tests without the 200-row evidence template limit", async () => {
  const definitions = await readDevelopmentTestMatrix(path.resolve("."));
  assert.equal(definitions.length, 407);
  assert.equal(new Set(definitions.map((item) => item.testId)).size, 407);
  for (const [suite, expected] of TEST_MATRIX_SUITES) assert.equal(definitions.filter((item) => item.suite === suite).length, expected);
  assert.ok(definitions.some((item) => item.testId === "CF-T-011"));
  assert.ok(definitions.some((item) => item.testId === "IF-030"));
});
