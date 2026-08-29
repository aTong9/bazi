import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { applyIntegrationOverlay } from "../../packages/catalog/src/apply-integration-overlay.js";

test("the approved overlay closes Integration V1.0 registry gaps without editing source files", async () => {
  const result = await applyIntegrationOverlay({
    repositoryRoot: path.resolve("."),
    overlayFile: path.resolve("data/overlays/integration-v1.0-patch-001.json"),
  });

  const m1Core = result.modulesById.get("M1.CORE");
  const m5Gap = result.modulesById.get("M5.GAP");
  assert.ok(m1Core);
  assert.ok(m5Gap);
  assert.equal(result.modules.length, 51);
  assert.equal(result.modulesById.get("M0.M21")?.runtime_status, "开发/治理");
  assert.equal(m1Core.downstream?.includes("M4.GAP"), false);
  assert.equal(m1Core.downstream?.includes("M4.BASE"), true);
  assert.equal(m5Gap.upstream?.includes("M5.BASE-PHYTHM"), false);
  assert.deepEqual(result.calibrationContract.expectedHeaders, [
    "hit_id", "case_id", "set_split", "rule_id", "模块", "规则名称", "命中时点",
    "预测角色", "核验结果", "匹配分", "反例强度", "安全关键", "event_ids", "纳入", "备注",
  ]);
  assert.equal(result.calibrationContract.legacyAction, "reject");
  assert.deepEqual(result.errors, []);
});
