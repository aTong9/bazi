import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { openCatalogSnapshot } from "../../packages/catalog/src/open-catalog-snapshot.js";
import { executeUpstreamModuleMatrix } from "../../packages/testkit/src/upstream-module-matrix-runner.js";
import { readDevelopmentTestMatrix } from "../../packages/testkit/src/read-development-test-matrix.js";

test("executes all 58 M1-M5 positive and boundary definitions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bazi-upstream-matrix-"));
  try { const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot: root }); const catalog = openCatalogSnapshot(built.snapshotPath); try { const records = executeUpstreamModuleMatrix(await readDevelopmentTestMatrix(path.resolve(".")), catalog); assert.equal(records.length, 58); assert.deepEqual(records.filter((x) => !x.passed), []); } finally { catalog.close(); } } finally { await rm(root, { recursive: true, force: true }); }
});
