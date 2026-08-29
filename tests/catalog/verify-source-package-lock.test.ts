import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { verifySourcePackageLock } from "../../packages/catalog/src/verify-source-package-lock.js";

test("the source package lock pins every authoritative source and overlay", async () => {
  const report = await verifySourcePackageLock({
    repositoryRoot: path.resolve("."),
    lockFile: path.resolve("data/source-package.lock.json"),
  });

  assert.equal(report.integrationCoreFiles, 6);
  assert.equal(report.m0SemanticSources, 1);
  assert.equal(report.m1M5SemanticSources, 29);
  assert.equal(report.overlays, 1);
  assert.deepEqual(report.missingFiles, []);
  assert.deepEqual(report.hashMismatches, []);
  assert.deepEqual(report.roleErrors, []);
  assert.deepEqual(report.deniedPrefixErrors, []);
});
