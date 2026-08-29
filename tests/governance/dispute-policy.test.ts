import assert from "node:assert/strict";
import { test } from "node:test";

import { IMPLEMENTED_DISPUTE_POLICIES, validateImplementedDisputePolicy } from "../../packages/governance/src/dispute-policy.js";

test("the two source disputes resolve to conservative implemented policies", () => {
  assert.equal(IMPLEMENTED_DISPUTE_POLICIES["M20-DISPUTE-0149-V1.0"]?.disposition, "parameterized_only");
  assert.equal(IMPLEMENTED_DISPUTE_POLICIES["M20-DISPUTE-0150-V1.0"]?.disposition, "conditional_no_fixed_weight");
  assert.deepEqual(validateImplementedDisputePolicy("M20-DISPUTE-0149-V1.0", ["M14-JIANREN-0048-V1.0"]), []);
  assert.deepEqual(validateImplementedDisputePolicy("M20-DISPUTE-0150-V1.0", ["M13-BOUND-0068-V1.0"]), []);
  assert.deepEqual(validateImplementedDisputePolicy("M20-DISPUTE-0149-V1.0", ["wrong-rule"]), ["DISPUTE_POLICY_TARGET_MISMATCH"]);
  assert.deepEqual(validateImplementedDisputePolicy("unknown", []), ["DISPUTE_POLICY_NOT_IMPLEMENTED"]);
});
