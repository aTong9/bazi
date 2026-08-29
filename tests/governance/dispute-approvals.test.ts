import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadDisputeApprovals, validateDisputeApprovalForSnapshot } from "../../packages/governance/src/dispute-approvals.js";

test("dispute approvals require implemented policy, independent reviewers, evidence, and the current snapshot", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bazi-governance-"));
  const file = path.join(root, "approvals.json");
  const digest = "a".repeat(64);
  try {
    await writeFile(file, JSON.stringify({ version: 1, approvals: [{
      testId: "M20-DISPUTE-0149-V1.0", decision: "parameterized_only",
      rationale: "Independent review preserves the policy as an explicit school parameter only.",
      evidenceRefs: ["M21-PATTERN-0040-V1.0", "paired-case-set"], primaryReviewer: "reviewer-a", independentReviewer: "reviewer-b",
      reviewedAt: "2026-08-29T00:00:00.000Z", rulesetDigest: digest,
    }] }));
    const approvals = await loadDisputeApprovals(file);
    assert.deepEqual(validateDisputeApprovalForSnapshot(approvals.get("M20-DISPUTE-0149-V1.0"), "M20-DISPUTE-0149-V1.0", digest), []);
    assert.deepEqual(validateDisputeApprovalForSnapshot(approvals.get("M20-DISPUTE-0149-V1.0"), "M20-DISPUTE-0149-V1.0", "b".repeat(64)), ["GOVERNANCE_RULESET_DIGEST_MISMATCH"]);
    const invalid = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"))) as { approvals: Array<Record<string, unknown>> };
    invalid.approvals[0]!.independentReviewer = "reviewer-a";
    await writeFile(file, JSON.stringify(invalid));
    await assert.rejects(loadDisputeApprovals(file), /independent reviewer/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
