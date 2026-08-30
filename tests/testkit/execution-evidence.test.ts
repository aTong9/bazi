import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { buildCurrentExecutionEvidence, renderExecutionEvidenceJUnit, summarizeExecutionEvidence } from "../../packages/testkit/src/execution-evidence.js";
import { readDevelopmentTestMatrix } from "../../packages/testkit/src/read-development-test-matrix.js";

test("execution evidence is unbounded, reproducible, and never reports an unbound matrix case as passed", async () => {
  const definitions = await readDevelopmentTestMatrix(path.resolve("."));
  const records = buildCurrentExecutionEvidence({ definitions, m20Records: [{ testId: definitions[0]!.testId, sourceStatus: "通过", targetModule: "M02", targetRuleIds: [], executionStatus: "executed", targetRulesExist: true, targetRulesMatched: [], issues: [], durationMs: 1 }], codeCommit: "abc123", rulesetDigest: "a".repeat(64), environment: "test" });
  assert.equal(records.length, 407);
  assert.equal(records[0]?.status, "passed");
  assert.equal(records[1]?.status, "not_run");
  assert.match(records[0]?.fixture_hash ?? "", /^[a-f0-9]{64}$/u);
  assert.equal(records[1]?.duration_ms, null);
  const summary = summarizeExecutionEvidence(records);
  assert.deepEqual(summary.byStatus, { passed: 1, failed: 0, review_required: 0, not_run: 406 });
  assert.equal(summary.releaseReady, false);
  const junit = renderExecutionEvidenceJUnit(records);
  assert.match(junit, /tests="407" failures="406"/u);
  assert.match(junit, /<testcase classname=/u);
  assert.match(junit, /<failure message="not_run:/u);
});
