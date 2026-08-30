import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { openCatalogSnapshot } from "../../packages/catalog/src/open-catalog-snapshot.js";
import { executePerformanceStabilityMatrix } from "../../packages/testkit/src/performance-stability-runner.js";
import { readDevelopmentTestMatrix } from "../../packages/testkit/src/read-development-test-matrix.js";

test("executes all 15 performance and stability definitions", async () => {
  const repositoryRoot = path.resolve("."); const root = await mkdtemp(path.join(os.tmpdir(), "bazi-perf-matrix-"));
  try { const built = await buildCatalogSnapshot({ repositoryRoot, outputRoot: root }); const catalog = openCatalogSnapshot(built.snapshotPath); try { const records = await executePerformanceStabilityMatrix({ definitions: await readDevelopmentTestMatrix(repositoryRoot), catalog, snapshotPath: built.snapshotPath, repositoryRoot }); assert.equal(records.length, 15); assert.deepEqual(records.filter((record) => !record.passed), []); } finally { catalog.close(); } } finally { await rm(root, { recursive: true, force: true }); }
});
