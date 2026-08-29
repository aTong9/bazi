import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type CalibrationModel = "M4" | "M5";
export type CalibrationSplit = "development" | "holdout";

export interface CalibrationReadiness {
  readonly model: CalibrationModel;
  readonly totalCases: number;
  readonly developmentCases: number;
  readonly holdoutCases: number;
  readonly frozenPredictions: number;
  readonly completedFeedback: number;
  readonly doubleReviewedCases: number;
  readonly safetyMisses: number;
  readonly currentCycle: "C0" | "C1" | "C2" | "C3" | "C4" | "C5";
  readonly releaseCandidateReady: boolean;
  readonly blockers: readonly string[];
}

export interface CalibrationStore {
  registerCase(input: { caseId: string; anonymousCode: string; model: CalibrationModel; split: CalibrationSplit; consent: true; actor: string }): void;
  freezePrediction(input: { caseId: string; snapshotDigest: string; codeCommit: string; prediction: unknown; actor: string }): void;
  recordFeedback(input: { caseId: string; gold: unknown; safetyMiss: boolean; actor: string }): void;
  recordReview(input: { caseId: string; reviewer: string; round: 1 | 2; decision: "keep" | "modify_candidate" | "deprecate_candidate" | "needs_more_evidence" }): void;
  proposeRuleChange(input: { changeId: string; ruleId: string; supportingCaseIds: readonly string[]; counterexampleCaseIds: readonly string[]; reviewer: string; candidateSnapshotDigest: string; disposition: "modify_candidate" | "deprecate_candidate" }): void;
  readiness(model: CalibrationModel): CalibrationReadiness;
  auditEvents(): readonly { action: string; caseId: string; actor: string }[];
  close(): void;
}

export function openCalibrationStore(input: { databasePath: string; anonymizationSalt: string }): CalibrationStore {
  if (input.anonymizationSalt.length < 16) throw new Error("anonymization salt must contain at least 16 characters");
  const db = new DatabaseSync(input.databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS calibration_cases (
      case_id TEXT PRIMARY KEY, anonymous_hash TEXT NOT NULL UNIQUE, model TEXT NOT NULL CHECK(model IN ('M4','M5')),
      set_split TEXT NOT NULL CHECK(set_split IN ('development','holdout')), consent INTEGER NOT NULL CHECK(consent = 1),
      prediction_frozen INTEGER NOT NULL DEFAULT 0, feedback_complete INTEGER NOT NULL DEFAULT 0, safety_miss INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE TABLE IF NOT EXISTS frozen_predictions (
      case_id TEXT PRIMARY KEY REFERENCES calibration_cases(case_id), snapshot_digest TEXT NOT NULL, code_commit TEXT NOT NULL,
      prediction_json TEXT NOT NULL, frozen_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS gold_feedback (
      case_id TEXT PRIMARY KEY REFERENCES calibration_cases(case_id), gold_json TEXT NOT NULL, recorded_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS reviews (
      case_id TEXT NOT NULL REFERENCES calibration_cases(case_id), round INTEGER NOT NULL CHECK(round IN (1,2)), reviewer TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('keep','modify_candidate','deprecate_candidate','needs_more_evidence')),
      reviewed_at TEXT NOT NULL, PRIMARY KEY(case_id, round)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS access_audit (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, case_id TEXT NOT NULL, actor TEXT NOT NULL, occurred_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS rule_change_candidates (
      change_id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, supporting_cases_json TEXT NOT NULL, counterexample_cases_json TEXT NOT NULL,
      reviewer TEXT NOT NULL, candidate_snapshot_digest TEXT NOT NULL,
      disposition TEXT NOT NULL CHECK(disposition IN ('modify_candidate','deprecate_candidate')), created_at TEXT NOT NULL
    ) STRICT;
  `);
  const audit = db.prepare("INSERT INTO access_audit(action, case_id, actor, occurred_at) VALUES (?, ?, ?, ?)");
  const caseRow = db.prepare("SELECT * FROM calibration_cases WHERE case_id = ?");
  return {
    registerCase(value): void {
      if (!value.caseId || !value.anonymousCode || !value.actor) throw new Error("case, anonymous code, and actor are required");
      const anonymousHash = createHash("sha256").update(`${input.anonymizationSalt}\u0000${value.anonymousCode}`).digest("hex");
      db.prepare("INSERT INTO calibration_cases(case_id, anonymous_hash, model, set_split, consent) VALUES (?, ?, ?, ?, 1)").run(value.caseId, anonymousHash, value.model, value.split);
      audit.run("case_registered", value.caseId, value.actor, now());
    },
    freezePrediction(value): void {
      requireCase(caseRow, value.caseId);
      db.prepare("INSERT INTO frozen_predictions(case_id, snapshot_digest, code_commit, prediction_json, frozen_at) VALUES (?, ?, ?, ?, ?)").run(value.caseId, value.snapshotDigest, value.codeCommit, JSON.stringify(value.prediction), now());
      db.prepare("UPDATE calibration_cases SET prediction_frozen = 1 WHERE case_id = ?").run(value.caseId);
      audit.run("prediction_frozen", value.caseId, value.actor, now());
    },
    recordFeedback(value): void {
      const row = requireCase(caseRow, value.caseId) as { prediction_frozen: number };
      if (row.prediction_frozen !== 1) throw new Error("prediction must be frozen before feedback is recorded");
      db.prepare("INSERT INTO gold_feedback(case_id, gold_json, recorded_at) VALUES (?, ?, ?)").run(value.caseId, JSON.stringify(value.gold), now());
      db.prepare("UPDATE calibration_cases SET feedback_complete = 1, safety_miss = ? WHERE case_id = ?").run(value.safetyMiss ? 1 : 0, value.caseId);
      audit.run("feedback_recorded", value.caseId, value.actor, now());
    },
    recordReview(value): void {
      const row = requireCase(caseRow, value.caseId) as { feedback_complete: number };
      if (row.feedback_complete !== 1) throw new Error("feedback must be complete before review");
      if (value.round === 2) {
        const first = db.prepare("SELECT reviewer FROM reviews WHERE case_id = ? AND round = 1").get(value.caseId) as { reviewer: string } | undefined;
        if (!first) throw new Error("first review is required before second review");
        if (first.reviewer === value.reviewer) throw new Error("second review must be independent");
      }
      db.prepare("INSERT INTO reviews(case_id, round, reviewer, decision, reviewed_at) VALUES (?, ?, ?, ?, ?)").run(value.caseId, value.round, value.reviewer, value.decision, now());
      audit.run(`review_${value.round}`, value.caseId, value.reviewer, now());
    },
    proposeRuleChange(value): void {
      if (value.supportingCaseIds.length === 0 || value.counterexampleCaseIds.length === 0) throw new Error("rule change requires supporting cases and counterexamples");
      for (const caseId of [...value.supportingCaseIds, ...value.counterexampleCaseIds]) {
        requireCase(caseRow, caseId);
        const review = db.prepare("SELECT reviewer FROM reviews WHERE case_id = ? AND round = 2").get(caseId);
        if (!review) throw new Error(`case ${caseId} requires independent second review`);
      }
      db.prepare("INSERT INTO rule_change_candidates VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(value.changeId, value.ruleId, JSON.stringify([...new Set(value.supportingCaseIds)]), JSON.stringify([...new Set(value.counterexampleCaseIds)]), value.reviewer, value.candidateSnapshotDigest, value.disposition, now());
      audit.run("rule_change_proposed", value.changeId, value.reviewer, now());
    },
    readiness(model): CalibrationReadiness {
      const counts = db.prepare(`SELECT COUNT(*) total, SUM(set_split='development') development, SUM(set_split='holdout') holdout, SUM(prediction_frozen) frozen, SUM(feedback_complete) feedback, SUM(safety_miss) safety FROM calibration_cases WHERE model = ?`).get(model) as { total: number; development: number | null; holdout: number | null; frozen: number | null; feedback: number | null; safety: number | null };
      const reviewed = db.prepare("SELECT COUNT(*) count FROM calibration_cases c WHERE c.model = ? AND EXISTS (SELECT 1 FROM reviews r WHERE r.case_id=c.case_id AND r.round=2)").get(model) as { count: number };
      const total = counts.total; const development = counts.development ?? 0; const holdout = counts.holdout ?? 0; const frozen = counts.frozen ?? 0; const feedback = counts.feedback ?? 0; const safety = counts.safety ?? 0;
      const cycle = total >= 120 ? "C5" : total >= 80 ? "C4" : total >= 40 ? "C3" : total >= 20 && development >= 14 && holdout >= 6 ? "C2" : total >= 5 ? "C1" : "C0";
      const requiredTotal = model === "M4" ? 80 : 120;
      const blockers = [...(total < requiredTotal ? [`REAL_CASES_${total}_OF_${requiredTotal}`] : []), ...(frozen !== total ? ["PREDICTIONS_NOT_ALL_FROZEN"] : []), ...(feedback !== total ? ["FEEDBACK_INCOMPLETE"] : []), ...(reviewed.count !== total ? ["DOUBLE_REVIEW_INCOMPLETE"] : []), ...(safety > 0 ? [`SAFETY_MISSES_${safety}`] : []), ...(holdout === 0 ? ["HOLDOUT_SET_EMPTY"] : [])];
      return Object.freeze({ model, totalCases: total, developmentCases: development, holdoutCases: holdout, frozenPredictions: frozen, completedFeedback: feedback, doubleReviewedCases: reviewed.count, safetyMisses: safety, currentCycle: cycle, releaseCandidateReady: blockers.length === 0, blockers: Object.freeze(blockers) });
    },
    auditEvents(): readonly { action: string; caseId: string; actor: string }[] { return Object.freeze((db.prepare("SELECT action, case_id, actor FROM access_audit ORDER BY audit_id").all() as Array<{ action: string; case_id: string; actor: string }>).map((row) => Object.freeze({ action: row.action, caseId: row.case_id, actor: row.actor }))); },
    close(): void { db.close(); },
  };
}

function requireCase(statement: ReturnType<DatabaseSync["prepare"]>, caseId: string): unknown { const row = statement.get(caseId); if (!row) throw new Error(`unknown calibration case ${caseId}`); return row; }
function now(): string { return new Date().toISOString(); }
