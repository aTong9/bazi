import assert from "node:assert/strict";
import { test } from "node:test";

import { validateResultItemContract } from "../../packages/contracts/src/result-item-contract.js";

test("ResultItem JSON contract rejects an unknown external status token", () => {
  const result = validateResultItemContract({
    applicability: "applicable",
    status: "maybe",
    value: null,
    confidence: "unknown",
    evidence: null,
    ruleIds: [], sourceIds: [], eventIds: [], conditions: [], counterevidence: [],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("status")));
});
