import { performance } from "node:perf_hooks";

import { EvidenceLedger } from "../../engine-core/src/index.js";
import { adjudicateM5, type M5AdjudicationProfile } from "../../relationship-engine/src/m5-adjudication.js";
import { normalizeRealityGates, type RealityGateAssessment } from "../../relationship-engine/src/reality-gates.js";
import type { DevelopmentTestDefinition } from "./read-development-test-matrix.js";
import type { MatrixAssertionExecution } from "./report-language-runner.js";

export function executeM5RegressionMatrix(definitions: readonly DevelopmentTestDefinition[]): readonly MatrixAssertionExecution[] {
  return Object.freeze(definitions.filter((item) => item.suite === "09_32项回归").map((definition) => execute(definition)));
}

function execute(definition: DevelopmentTestDefinition): MatrixAssertionExecution {
  const startedAt = performance.now();
  try {
    const fixture = fixtureFor(definition.testId);
    const actual = adjudicateM5({ mode: fixture.mode, gates: normalizeRealityGates(fixture.gates, fixture.mode === "single_chart_relationship_profile" ? "not_assessed" : "unknown"), profile: fixture.profile });
    check(actual.reportStatus === definition.fields["期望status"], `status ${actual.reportStatus}`);
    check(actual.assessment === definition.fields["期望AF"], `assessment ${actual.assessment}`);
    check(actual.grade === definition.fields["期望FG"], `grade ${actual.grade}`);
    assertSpecial(definition.testId, actual.decisionCodes, actual.residualRisks, actual.repairStatus);
    return record(definition.testId, true, JSON.stringify({ status: actual.reportStatus, assessment: actual.assessment, grade: actual.grade, decisionCodes: actual.decisionCodes, residualRisks: actual.residualRisks }), startedAt);
  } catch (error) { return record(definition.testId, false, error instanceof Error ? error.message : String(error), startedAt); }
}

function fixtureFor(id: string): { mode: "single_chart_relationship_profile" | "specific_partner_with_reality_data"; gates: readonly RealityGateAssessment[] | undefined; profile: M5AdjudicationProfile } {
  const single = ["T01", "T02", "T16", "T18", "T19", "T20", "T21"].includes(id);
  let profile = baseProfile(); let gateOverrides: Partial<Record<RealityGateAssessment["id"], RealityGateAssessment["status"]>> = {};
  switch (id) {
    case "T03": profile = withProfile({ attraction: "high", evidenceLevels: levels(1, 1, 1, 1, 1) }); break;
    case "T04": profile = withProfile({ attraction: "low" }); break;
    case "T05": profile = withProfile({ admissionVerified: true, evidenceLevels: levels(1, 1, 1, 0, 1) }); break;
    case "T06": profile = withProfile({ evidenceLevels: levels(5, 1, 5, 5, 5) }); break;
    case "T07": profile = withProfile({ evidenceLevels: levels(5, 4, 1, 5, 5) }); break;
    case "T08": gateOverrides = { RG01: "fail" }; break;
    case "T09": gateOverrides = { RG03: "fail" }; break;
    case "T10": gateOverrides = { RG05: "conditional" }; break;
    case "T11": gateOverrides = { RG04: "conditional", RG05: "conditional" }; break;
    case "T12": gateOverrides = { RG03: "unknown" }; break;
    case "T13": profile = withProfile({ evidenceLevels: levels(5, 5, 5, 0, 5) }); break;
    case "T14": profile = withProfile({ evidenceLevels: levels(5, 5, 5, 3, 5) }); break;
    case "T15": profile = withProfile({ crossStateValidated: true }); break;
    case "T17": profile = withProfile({ singlePartyEvidence: true }); break;
    case "T18": profile = withProfile({ transformationStatus: "true_transformation" }); break;
    case "T19": profile = withProfile({ transformationStatus: "combined_not_transformed" }); break;
    case "T20": profile = withProfile({ functionalFamily: "FAM04" }); break;
    case "T21": profile = withProfile({ independentNeeds: 2 }); break;
    case "T22": profile = withProfile({ independentGaps: 2 }); break;
    case "T23": profile = withProfile({ bridgeLevel: "FB0" }); break;
    case "T24": profile = withProfile({ bridgeLevel: "FB1" }); break;
    case "T25": profile = withProfile({ bridgeLevel: "FB3" }); break;
    case "T26": profile = withProfile({ bridgeLevel: "FB4" }); break;
    case "T27": profile = withProfile({ evidenceLevels: levels(5, 5, 5, 5, 5) }); gateOverrides = { RG03: "fail" }; break;
    case "T28": profile = withProfile({ evidenceLevels: levels(5, 5, 5, 5, 1) }); break;
    case "T29": profile = withProfile({ historicalCurrentConflict: true }); break;
    case "T30": profile = withProfile({ singlePartyEvidence: true }); break;
    case "T31": profile = withProfile({ dependencyPending: true }); break;
    case "T32": profile = withProfile({ historicalSafetyFailure: true, currentSafetyImprovement: true }); break;
  }
  return { mode: single ? "single_chart_relationship_profile" : "specific_partner_with_reality_data", gates: single ? undefined : gates(gateOverrides), profile };
}

function assertSpecial(id: string, codes: readonly string[], risks: readonly string[], repairStatus: string): void {
  const expectedCode: Partial<Record<string, string>> = { T03: "ATTRACTION_DOES_NOT_RAISE_FIT", T05: "ADMISSION_IS_NOT_FIT", T06: "PV_XV_SEPARATE", T07: "BOUNDARY_PRECEDES_EXCHANGE", T18: "TRUE_TRANSFORMATION_REPLACES_ORIGINAL_FUNCTION", T19: "COMBINED_NOT_TRANSFORMED_PRESERVES_ORIGINAL_FUNCTION", T20: "FUNCTIONAL_FAMILY:FAM04", T21: "PRESERVE_PRIMARY_SECONDARY_NEEDS", T22: "PRESERVE_PRIMARY_SECONDARY_GAPS", T23: "SAFETY_OVERRIDES_ALL", T24: "BRIDGE_PLAN_ONLY", T25: "BRIDGE_REQUIRES_REPETITION", T26: "BRIDGE_REPEATED_EFFECTIVE", T27: "CORE_GATE_CAP_FG2", T29: "CURRENT_EVIDENCE_CONTROLS_CURRENT_ASSESSMENT", T32: "SAFETY_OVERRIDES_ALL" };
  const code = expectedCode[id]; if (code) check(codes.includes(code), `${id} missing ${code}`);
  if (id === "T13") check(repairStatus === "not_assessed" && risks.includes("REPAIR_NOT_ASSESSED"), "T13 repair was fabricated");
  if (id === "T14") check(repairStatus === "single_event", "T14 repair depth wrong");
  if (id === "T17") { const ledger = new EvidenceLedger(); for (const field of ["PV", "XV", "BV", "FV", "HV"]) ledger.addEvent("shared-event", field); check(ledger.uniqueEventCount === 1, "T17 event counted more than once"); }
  if (id === "T16") { const ledger = new EvidenceLedger(); ledger.addSource("shared-source", "M1"); ledger.addSource("shared-source", "M4"); check(ledger.uniqueSourceCount === 1, "T16 source counted more than once"); }
}

function baseProfile(): M5AdjudicationProfile { return { explicitEvidenceProfile: true, attraction: "unknown", admissionVerified: false, evidenceLevels: levels(5, 5, 5, 5, 5), bridgeLevel: null, crossStateValidated: false, dependencyPending: false, singlePartyEvidence: false, historicalSafetyFailure: false, currentSafetyImprovement: false, independentNeeds: 0, independentGaps: 0, transformationStatus: "none", functionalFamily: null, historicalCurrentConflict: false }; }
function withProfile(overrides: Partial<M5AdjudicationProfile>): M5AdjudicationProfile { return { ...baseProfile(), ...overrides }; }
function levels(PV: M5AdjudicationProfile["evidenceLevels"]["PV"], XV: M5AdjudicationProfile["evidenceLevels"]["XV"], BV: M5AdjudicationProfile["evidenceLevels"]["BV"], FV: M5AdjudicationProfile["evidenceLevels"]["FV"], HV: M5AdjudicationProfile["evidenceLevels"]["HV"]): M5AdjudicationProfile["evidenceLevels"] { return Object.freeze({ PV, XV, BV, FV, HV }); }
function gates(overrides: Partial<Record<RealityGateAssessment["id"], RealityGateAssessment["status"]>>): RealityGateAssessment[] { return (["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"] as const).map((id) => ({ id, status: overrides[id] ?? "pass", evidenceIds: [`reg-${id}`] })); }
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function record(testId: string, passed: boolean, actualSummary: string, startedAt: number): MatrixAssertionExecution { return Object.freeze({ testId, passed, actualSummary, durationMs: performance.now() - startedAt }); }
