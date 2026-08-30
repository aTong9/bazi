import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";

import { verifyDocumentPackage } from "../../packages/catalog/src/verify-document-package.js";

const packageRoot = path.resolve(
  "docs/八字关系分析系统_M0-M5开发整合包_V1.0",
);

test("the Integration V1.0 document package matches its manifest", async () => {
  const report = await verifyDocumentPackage({ packageRoot });

  assert.equal(report.manifestEntries, 160);
  assert.equal(report.packageFiles, 161);
  assert.deepEqual(report.missingFiles, []);
  assert.deepEqual(report.unexpectedFiles, []);
  assert.deepEqual(report.sizeMismatches, []);
  assert.deepEqual(report.hashMismatches, []);
  assert.deepEqual(report.jsonErrors, []);
  assert.deepEqual(report.csvErrors, []);
  assert.deepEqual(report.zipErrors, []);
});
