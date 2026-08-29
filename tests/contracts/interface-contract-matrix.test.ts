import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { openCatalogSnapshot } from "../../packages/catalog/src/open-catalog-snapshot.js";
import { executeInterfaceContractMatrix } from "../../packages/testkit/src/interface-contract-runner.js";
import { readDevelopmentTestMatrix } from "../../packages/testkit/src/read-development-test-matrix.js";

test("executes all 30 M0-M5 interface contracts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bazi-interface-matrix-"));
  try { const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot: root }); const catalog = openCatalogSnapshot(built.snapshotPath); try { const records = executeInterfaceContractMatrix(await readDevelopmentTestMatrix(path.resolve(".")), catalog); assert.equal(records.length, 30); assert.deepEqual(records.filter((x) => !x.passed), []); } finally { catalog.close(); } } finally { await rm(root, { recursive: true, force: true }); }
});
