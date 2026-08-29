import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { importCatalog } from "../../packages/catalog/src/import-catalog.js";

test("catalog import accounts for every source record and preserves native provenance", async () => {
  const catalog = await importCatalog({ repositoryRoot: path.resolve(".") });

  assert.equal(catalog.records.length, 11_118);
  assert.equal(catalog.runtimeRecords.length, 10_918);
  assert.equal(catalog.fixtures.length, 150);
  assert.equal(catalog.governance.length, 50);
  assert.equal(catalog.coverage.total, 11_118);
  assert.equal(catalog.coverage.silentDrops, 0);
  assert.equal(catalog.coverage.byDisposition.compiled, 360);
  assert.equal(catalog.coverage.byDisposition.test_only, 150);
  assert.equal(catalog.coverage.byDisposition.governance, 50);

  const first = catalog.records[0];
  assert.ok(first);
  assert.equal(first.source.nativePayload.global_id, first.id);
  assert.match(first.source.sourceHash, /^[a-f0-9]{64}$/u);
  assert.ok(first.source.sourceRow >= 2);
  assert.equal(catalog.records.filter((record) => record.jsonKey).length, 45);
});
