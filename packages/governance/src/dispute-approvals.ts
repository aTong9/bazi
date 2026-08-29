import { readFile } from "node:fs/promises";

export const REQUIRED_DISPUTE_DECISIONS = Object.freeze({
  "M20-DISPUTE-0149-V1.0": "parameterized_only",
  "M20-DISPUTE-0150-V1.0": "conditional_no_fixed_weight",
} as const);

export type DisputeTestId = keyof typeof REQUIRED_DISPUTE_DECISIONS;

export interface DisputeApproval {
  readonly testId: DisputeTestId;
  readonly decision: (typeof REQUIRED_DISPUTE_DECISIONS)[DisputeTestId];
  readonly rationale: string;
  readonly evidenceRefs: readonly string[];
  readonly primaryReviewer: string;
  readonly independentReviewer: string;
  readonly reviewedAt: string;
  readonly rulesetDigest: string;
}

export async function loadDisputeApprovals(filePath: string): Promise<ReadonlyMap<string, DisputeApproval>> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (!isObject(parsed) || parsed.version !== 1 || !Array.isArray(parsed.approvals)) throw new Error("governance approval file must be version 1 with an approvals array");
  const approvals = new Map<string, DisputeApproval>();
  for (const candidate of parsed.approvals) {
    const approval = validateApproval(candidate);
    if (approvals.has(approval.testId)) throw new Error(`duplicate governance approval ${approval.testId}`);
    approvals.set(approval.testId, Object.freeze({ ...approval, evidenceRefs: Object.freeze([...approval.evidenceRefs]) }));
  }
  return approvals;
}

export function validateDisputeApprovalForSnapshot(approval: DisputeApproval | undefined, testId: string, rulesetDigest: string): readonly string[] {
  if (!approval) return Object.freeze(["GOVERNANCE_APPROVAL_MISSING"]);
  const issues = [
    ...(approval.rulesetDigest !== rulesetDigest ? ["GOVERNANCE_RULESET_DIGEST_MISMATCH"] : []),
    ...(approval.decision !== REQUIRED_DISPUTE_DECISIONS[testId as DisputeTestId] ? ["GOVERNANCE_DECISION_NOT_IMPLEMENTED"] : []),
  ];
  return Object.freeze(issues);
}

function validateApproval(value: unknown): DisputeApproval {
  if (!isObject(value)) throw new Error("governance approval must be an object");
  const testId = value.testId;
  if (typeof testId !== "string" || !(testId in REQUIRED_DISPUTE_DECISIONS)) throw new Error(`unknown dispute test ${String(testId)}`);
  const expected = REQUIRED_DISPUTE_DECISIONS[testId as DisputeTestId];
  if (value.decision !== expected) throw new Error(`${testId} decision ${String(value.decision)} is not implemented; expected ${expected}`);
  if (typeof value.rationale !== "string" || value.rationale.trim().length < 20) throw new Error(`${testId} requires a substantive rationale`);
  if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length < 2 || value.evidenceRefs.some((item) => typeof item !== "string" || item.trim().length === 0)) throw new Error(`${testId} requires at least two evidence references`);
  if (typeof value.primaryReviewer !== "string" || typeof value.independentReviewer !== "string" || !value.primaryReviewer.trim() || !value.independentReviewer.trim()) throw new Error(`${testId} requires two named reviewers`);
  if (value.primaryReviewer === value.independentReviewer) throw new Error(`${testId} independent reviewer must differ from primary reviewer`);
  if (typeof value.reviewedAt !== "string" || Number.isNaN(Date.parse(value.reviewedAt))) throw new Error(`${testId} requires an ISO review timestamp`);
  if (typeof value.rulesetDigest !== "string" || !/^[a-f0-9]{64}$/u.test(value.rulesetDigest)) throw new Error(`${testId} requires a 64-character ruleset digest`);
  return value as unknown as DisputeApproval;
}

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
