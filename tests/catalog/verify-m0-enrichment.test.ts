import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { verifyM0Enrichment } from "../../packages/catalog/src/verify-m0-enrichment.js";

test("all M0 integration rows close-match the locked V1.9 semantic workbook", async () => {
  const report = await verifyM0Enrichment({ repositoryRoot: path.resolve(".") });
  assert.equal(report.integrationRows, 1_745);
  assert.equal(report.matchedRows, 1_745);
  assert.deepEqual(report.conflicts, []);
});
