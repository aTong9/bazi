import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { openCatalogSnapshot } from "../../packages/catalog/src/open-catalog-snapshot.js";
import { executeM0UnitMatrix } from "../../packages/testkit/src/m0-unit-matrix-runner.js";
import { readDevelopmentTestMatrix } from "../../packages/testkit/src/read-development-test-matrix.js";

test("executes all 42 M0 unit and layer matrix definitions", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "bazi-m0-matrix-"));
  try {
    const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot });
    const catalog = openCatalogSnapshot(built.snapshotPath);
    try {
      const records = executeM0UnitMatrix(await readDevelopmentTestMatrix(path.resolve(".")), catalog);
      assert.equal(records.length, 42);
      assert.deepEqual(records.filter((record) => !record.passed), []);
    } finally { catalog.close(); }
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});
