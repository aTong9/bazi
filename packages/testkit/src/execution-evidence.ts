import { createHash } from "node:crypto";
import type { M20ExecutionRecord } from "./s3-m20-runner.js";
import type { DevelopmentTestDefinition } from "./read-development-test-matrix.js";
import type { MatrixAssertionExecution } from "./report-language-runner.js";

export type EvidenceStatus = "passed" | "failed" | "review_required" | "not_run";
export interface TestExecutionEvidence {
  readonly test_id: string;
  readonly suite: string;
  readonly code_commit: string;
  readonly ruleset_digest: string;
  readonly fixture_hash: string;
  readonly expected_summary: string;
  readonly actual_summary: string;
  readonly status: EvidenceStatus;
  readonly severity: "P0" | "P1" | "P2";
  readonly environment: string;
  readonly duration_ms: number | null;
  readonly retest_status: "not_retested" | "retested_pass" | "retested_fail";
}

export function buildCurrentExecutionEvidence(input: {
  readonly definitions: readonly DevelopmentTestDefinition[];
  readonly m20Records: readonly M20ExecutionRecord[];
  readonly matrixRecords?: readonly MatrixAssertionExecution[];
  readonly codeCommit: string;
  readonly rulesetDigest: string;
  readonly environment: string;
}): readonly TestExecutionEvidence[] {
  const m20ById = new Map(input.m20Records.map((record) => [record.testId, record]));
  const matrixById = new Map((input.matrixRecords ?? []).map((record) => [record.testId, record]));
  return Object.freeze(input.definitions.map((definition): TestExecutionEvidence => {
    const m20 = m20ById.get(definition.testId);
    const matrix = matrixById.get(definition.testId);
    const status: EvidenceStatus = matrix ? matrix.passed ? "passed" : "failed" : !m20 ? "not_run" : m20.executionStatus === "failed" ? "failed" : ["quality_gate", "review_required"].includes(m20.executionStatus) ? "review_required" : "passed";
    const expected = expectedSummary(definition.fields);
    const actual = matrix?.actualSummary ?? (!m20 ? "No executable assertion is registered for this matrix definition." : JSON.stringify({ executionStatus: m20.executionStatus, targetRulesExist: m20.targetRulesExist, targetRulesMatched: m20.targetRulesMatched, issues: m20.issues }));
    return Object.freeze({
      test_id: definition.testId, suite: definition.suite, code_commit: input.codeCommit, ruleset_digest: input.rulesetDigest,
      fixture_hash: sha256(JSON.stringify({ testId: definition.testId, suite: definition.suite, ordinal: definition.ordinal, fields: definition.fields })),
      expected_summary: expected, actual_summary: actual, status,
      severity: normalizeSeverity(definition.fields["优先级"]), environment: input.environment,
      duration_ms: matrix?.durationMs ?? m20?.durationMs ?? null, retest_status: "not_retested",
    });
  }));
}

export function summarizeExecutionEvidence(records: readonly TestExecutionEvidence[]) {
  const byStatus = { passed: 0, failed: 0, review_required: 0, not_run: 0 };
  const bySuite: Record<string, { total: number; passed: number; failed: number; review_required: number; not_run: number }> = {};
  for (const record of records) {
    byStatus[record.status] += 1;
    const suite = bySuite[record.suite] ?? { total: 0, passed: 0, failed: 0, review_required: 0, not_run: 0 };
    suite.total += 1; suite[record.status] += 1; bySuite[record.suite] = suite;
  }
  return Object.freeze({ total: records.length, byStatus: Object.freeze(byStatus), bySuite: Object.freeze(bySuite), releaseReady: byStatus.failed === 0 && byStatus.review_required === 0 && byStatus.not_run === 0 });
}

export function renderExecutionEvidenceJUnit(records: readonly TestExecutionEvidence[]): string {
  const failures = records.filter((record) => record.status !== "passed");
  const durationSeconds = records.reduce((sum, record) => sum + (record.duration_ms ?? 0), 0) / 1000;
  const cases = records.map((record) => {
    const body = record.status === "passed" ? "" : `<failure message="${xml(`${record.status}: ${record.actual_summary}`)}">${xml(JSON.stringify(record))}</failure>`;
    return `<testcase classname="${xml(record.suite)}" name="${xml(record.test_id)}" time="${((record.duration_ms ?? 0) / 1000).toFixed(6)}">${body}</testcase>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="development-matrix" tests="${records.length}" failures="${failures.length}" errors="0" skipped="0" time="${durationSeconds.toFixed(6)}">${cases}</testsuite>\n`;
}

function expectedSummary(fields: Readonly<Record<string, string>>): string { return fields["预期综合"] || fields["预期结果"] || fields["预期裁决"] || fields["期望关键输出"] || fields["预期"] || "See authoritative matrix definition."; }
function normalizeSeverity(value: string | undefined): "P0" | "P1" | "P2" { return value === "P0" || value === "P2" ? value : "P1"; }
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function xml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&apos;"); }
