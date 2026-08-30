import assert from "node:assert/strict";
import { test } from "node:test";

import { createResultItem } from "../../packages/domain/src/index.js";

test("ResultItem rejects a fabricated value for an unknown result", () => {
  assert.throws(
    () =>
      createResultItem({
        applicability: "applicable",
        status: "unknown",
        value: "身旺",
        confidence: "unknown",
        evidence: null,
        ruleIds: [],
        sourceIds: [],
        eventIds: [],
        conditions: ["BIRTH_TIME_UNKNOWN"],
        counterevidence: [],
      }),
    /unknown result must have value=null/u,
  );
});
