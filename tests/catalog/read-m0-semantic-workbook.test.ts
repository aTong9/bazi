import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { readM0SemanticWorkbook } from "../../packages/catalog/src/verify-m0-enrichment.js";

test("the locked V1.9 workbook exposes semantic fields for every M07-M18 rule", async () => {
  const rows = await readM0SemanticWorkbook({ repositoryRoot: path.resolve(".") });
  const target = rows.filter((row) => /^M0\.M(?:0[7-9]|1[0-8])$/u.test(row.moduleId));
  assert.equal(target.length, 1_140);
  assert.equal(new Set(target.map((row) => row.id)).size, 1_140);
  for (const row of target) {
    assert.ok(Object.keys(row.fields).length >= 10, `${row.id} has no usable semantic payload`);
    assert.equal(row.fields.Record_ID, row.id);
  }
});
