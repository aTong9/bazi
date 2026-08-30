import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { openCatalogSnapshot } from "../../packages/catalog/src/open-catalog-snapshot.js";
import { executeJsonDataMatrix } from "../../packages/testkit/src/json-data-runner.js";
import { readDevelopmentTestMatrix } from "../../packages/testkit/src/read-development-test-matrix.js";

test("all 25 authoritative JSON and data contracts execute against the real relationship response", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "bazi-json-matrix-"));
  try {
    const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot: temporary }); const catalog = openCatalogSnapshot(built.snapshotPath);
    try { const records = executeJsonDataMatrix(await readDevelopmentTestMatrix(path.resolve(".")), catalog); assert.equal(records.length, 25); assert.deepEqual(records.filter((record) => !record.passed), []); }
    finally { catalog.close(); }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
