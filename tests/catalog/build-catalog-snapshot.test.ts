import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { openCatalogSnapshot } from "../../packages/catalog/src/open-catalog-snapshot.js";

test("catalog snapshot rebuild is deterministic and runtime data reopens read-only", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "bazi-rulesets-"));
  try {
    const first = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot });
    const second = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot });
    assert.equal(second.rulesetDigest, first.rulesetDigest);
    assert.equal(first.manifest.sourceRecordCount, 11_118);
    assert.equal(first.manifest.loadedRecordCount, 10_918);
    assert.equal(first.manifest.silentDrops, 0);
    assert.equal(first.manifest.compiledRecordCount, 10_873);

    const database = new DatabaseSync(path.join(first.snapshotPath, "runtime.sqlite"), { readOnly: true });
    const row = database.prepare("SELECT COUNT(*) AS count FROM catalog_records").get() as { count: number };
    database.close();
    assert.equal(row.count, 10_918);

    const snapshot = openCatalogSnapshot(first.snapshotPath);
    try {
      assert.equal(snapshot.diagnostics.loadedRecords, 10_918);
      assert.equal(snapshot.getRecord("M20-BASE-0001-V1.0"), null);
      assert.equal(snapshot.getModuleRecords("M1.CORE").length, 94);
      assert.equal(snapshot.getModuleRecords("M4.SYNTH").length, 240);
      assert.equal(snapshot.getModuleRecords("M5.SYNTH").length, 320);
    } finally {
      snapshot.close();
    }
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
