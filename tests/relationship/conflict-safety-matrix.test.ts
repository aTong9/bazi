import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { openCatalogSnapshot } from "../../packages/catalog/src/open-catalog-snapshot.js";
import { executeConflictSafetyMatrix } from "../../packages/testkit/src/conflict-safety-runner.js";
import { readDevelopmentTestMatrix } from "../../packages/testkit/src/read-development-test-matrix.js";

test("all 35 authoritative conflict and safety rulings execute against runtime state", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "bazi-conflict-matrix-"));
  try { const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot: temporary }); const catalog = openCatalogSnapshot(built.snapshotPath);
    try { const records = executeConflictSafetyMatrix(await readDevelopmentTestMatrix(path.resolve(".")), catalog, path.resolve(".")); assert.equal(records.length, 35); assert.deepEqual(records.filter((record) => !record.passed), []); }
    finally { catalog.close(); }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
