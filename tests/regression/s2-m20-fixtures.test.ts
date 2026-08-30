import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { importCatalog } from "../../packages/catalog/src/import-catalog.js";
import { runS2M20Fixtures } from "../../packages/testkit/src/s2-m20-fixtures.js";

test("all 44 M20 fixtures assigned to M02-M06 execute successfully", async () => {
  const executions = runS2M20Fixtures();
  assert.equal(executions.length, 44);
  assert.equal(new Set(executions.map((execution) => execution.testId)).size, 44);
  const catalog = await importCatalog({ repositoryRoot: path.resolve(".") });
  const fixtureIds = new Set(catalog.fixtures.map((fixture) => fixture.id));
  for (const execution of executions) assert.ok(fixtureIds.has(execution.testId), `missing source fixture ${execution.testId}`);
  assert.deepEqual(executions.filter((execution) => !execution.passed), []);
});
