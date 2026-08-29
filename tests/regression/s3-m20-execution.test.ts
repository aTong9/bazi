import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { openCatalogSnapshot } from "../../packages/catalog/src/open-catalog-snapshot.js";
import { executeAllM20Fixtures } from "../../packages/testkit/src/s3-m20-runner.js";

test("all 150 V1.9 M20 fixtures produce explicit execution or governance records", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "bazi-s3-m20-"));
  try {
    const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot });
    const catalog = openCatalogSnapshot(built.snapshotPath);
    try {
      const records = await executeAllM20Fixtures({ repositoryRoot: path.resolve("."), catalog });
      assert.equal(records.length, 150);
      assert.equal(new Set(records.map((record) => record.testId)).size, 150);
      assert.deepEqual(records.filter((record) => record.executionStatus === "failed"), []);
      assert.equal(records.filter((record) => record.executionStatus === "review_required").length, 2);
      assert.equal(records.filter((record) => record.executionStatus === "quality_gate").length, 2);
      assert.ok(records.every((record) => record.targetRulesExist));
    } finally { catalog.close(); }
  } finally { await rm(outputRoot, { recursive: true, force: true }); }
});
