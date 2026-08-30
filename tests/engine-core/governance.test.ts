import assert from "node:assert/strict";
import { test } from "node:test";

import { EvidenceLedger, FieldAuthorityRegistry } from "../../packages/engine-core/src/index.js";

test("field authority blocks an upper module overwrite and evidence IDs count once", () => {
  const registry = new FieldAuthorityRegistry([
    { fieldFamily: "chart_mapping", authorityModuleId: "M0.M02", definition: "基础映射", conflictPolicy: "上层不得重算" },
  ]);
  assert.equal(registry.decideWrite("M0.M02", "chart_mapping").outcome, "accepted");
  assert.equal(registry.decideWrite("M1.CORE", "chart_mapping").outcome, "rejected");

  const ledger = new EvidenceLedger();
  ledger.addSource("SRC-1", "field-a");
  ledger.addSource("SRC-1", "field-b");
  ledger.addEvent("EVT-1", "field-a");
  ledger.addEvent("EVT-1", "field-b");
  assert.equal(ledger.uniqueSourceCount, 1);
  assert.equal(ledger.uniqueEventCount, 1);
  assert.deepEqual(ledger.fieldsForEvent("EVT-1"), ["field-a", "field-b"]);
});
