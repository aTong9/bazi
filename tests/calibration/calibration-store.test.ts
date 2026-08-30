import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { openCalibrationStore, readCalibrationReadiness } from "../../packages/calibration/src/store.js";
import { CURRENT_RULE_HIT_HEADERS, parseCurrentRuleHitCsv, serializeCurrentRuleHitCsv } from "../../packages/calibration/src/template-adapter.js";

test("calibration requires consent, freeze-before-feedback, independent review, and separate readiness", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bazi-calibration-")); const store = openCalibrationStore({ databasePath: path.join(root, "calibration.sqlite"), anonymizationSalt: "test-only-long-random-salt" });
  try {
    store.registerCase({ caseId: "C-1", anonymousCode: "person@example.test", model: "M5", split: "development", consent: true, actor: "operator" });
    assert.throws(() => store.recordFeedback({ caseId: "C-1", gold: {}, safetyMiss: false, actor: "reviewer" }), /frozen/u);
    store.freezePrediction({ caseId: "C-1", snapshotDigest: "a".repeat(64), codeCommit: "abc", prediction: { AF: "AF02", FG: "FG2" }, actor: "analyst" });
    store.recordFeedback({ caseId: "C-1", gold: { AF: "AF03", FG: "FG2" }, safetyMiss: false, actor: "reviewer-a" });
    store.recordReview({ caseId: "C-1", reviewer: "reviewer-a", round: 1, decision: "modify_candidate" });
    assert.throws(() => store.recordReview({ caseId: "C-1", reviewer: "reviewer-a", round: 2, decision: "modify_candidate" }), /independent/u);
    store.recordReview({ caseId: "C-1", reviewer: "reviewer-b", round: 2, decision: "modify_candidate" });
    store.registerCase({ caseId: "C-2", anonymousCode: "counterexample", model: "M5", split: "holdout", consent: true, actor: "operator" });
    store.freezePrediction({ caseId: "C-2", snapshotDigest: "a".repeat(64), codeCommit: "abc", prediction: { AF: "AF02" }, actor: "analyst" });
    store.recordFeedback({ caseId: "C-2", gold: { AF: "AF08" }, safetyMiss: false, actor: "reviewer-a" });
    store.recordReview({ caseId: "C-2", reviewer: "reviewer-a", round: 1, decision: "modify_candidate" });
    store.recordReview({ caseId: "C-2", reviewer: "reviewer-b", round: 2, decision: "modify_candidate" });
    store.proposeRuleChange({ changeId: "CH-1", ruleId: "M5-SYNTH-001", supportingCaseIds: ["C-1"], counterexampleCaseIds: ["C-2"], reviewer: "reviewer-c", candidateSnapshotDigest: "b".repeat(64), disposition: "modify_candidate" });
    const readiness = store.readiness("M5"); assert.equal(readiness.currentCycle, "C0"); assert.equal(readiness.releaseCandidateReady, false);
    assert.equal(readiness.totalCases, 2); assert.ok(readiness.blockers.includes("REAL_CASES_2_OF_120")); assert.equal(readiness.doubleReviewedCases, 2);
    assert.deepEqual(store.auditEvents().map((event) => event.action), ["case_registered", "prediction_frozen", "feedback_recorded", "review_1", "review_2", "case_registered", "prediction_frozen", "feedback_recorded", "review_1", "review_2", "rule_change_proposed"]);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
});

test("current 15-column rule-hit template round-trips and legacy 17-column input is rejected", () => {
  const row = Object.fromEntries(CURRENT_RULE_HIT_HEADERS.map((header) => [header, header === "备注" ? "含,逗号" : `${header}-value`]));
  const csv = serializeCurrentRuleHitCsv([row]); const parsed = parseCurrentRuleHitCsv(csv); assert.equal(parsed.length, 1); assert.deepEqual(parsed[0], row);
  assert.throws(() => parseCurrentRuleHitCsv(`${Array.from({ length: 17 }, (_, index) => `h${index}`).join(",")}\n${Array(17).fill("v").join(",")}\n`), /legacy 17-column/u);
});

test("release readiness can be inspected without opening the calibration database for writes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bazi-calibration-readiness-"));
  const databasePath = path.join(root, "calibration.sqlite");
  const store = openCalibrationStore({ databasePath, anonymizationSalt: "test-only-salt-value" });
  store.close();
  try {
    const readiness = readCalibrationReadiness(databasePath);
    assert.equal(readiness.M4.releaseCandidateReady, false);
    assert.deepEqual(readiness.M4.blockers, ["REAL_CASES_0_OF_80", "HOLDOUT_SET_EMPTY"]);
    assert.equal(readiness.M5.releaseCandidateReady, false);
    assert.deepEqual(readiness.M5.blockers, ["REAL_CASES_0_OF_120", "HOLDOUT_SET_EMPTY"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
