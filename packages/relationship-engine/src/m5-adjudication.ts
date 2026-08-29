import type { NormalizedRealityGate } from "./reality-gates.js";
import type { AssessmentFlag, FitGrade, RealityEvidenceScheme } from "./m5.js";

export type BridgeLevel = "FB0" | "FB1" | "FB2" | "FB3" | "FB4" | "FB5";
export interface M5AdjudicationProfile {
  readonly explicitEvidenceProfile: boolean;
  readonly attraction: "high" | "low" | "unknown";
  readonly admissionVerified: boolean;
  readonly evidenceLevels: Readonly<Record<RealityEvidenceScheme, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>>;
  readonly bridgeLevel: BridgeLevel | null;
  readonly crossStateValidated: boolean;
  readonly dependencyPending: boolean;
  readonly singlePartyEvidence: boolean;
  readonly historicalSafetyFailure: boolean;
  readonly currentSafetyImprovement: boolean;
  readonly independentNeeds: number;
  readonly independentGaps: number;
  readonly transformationStatus: "none" | "true_transformation" | "combined_not_transformed";
  readonly functionalFamily: string | null;
  readonly historicalCurrentConflict: boolean;
}
export interface M5Adjudication {
  readonly reportStatus: "complete" | "limited" | "stop";
  readonly safetyStatus: "standard" | "safety_stop" | "insufficient_data" | "core_gate_stop";
  readonly grade: FitGrade;
  readonly assessment: AssessmentFlag;
  readonly bridgeLevel: BridgeLevel | null;
  readonly residualRisks: readonly string[];
  readonly decisionCodes: readonly string[];
  readonly repairStatus: "not_assessed" | "single_event" | "repeated";
}

export function adjudicateM5(input: { readonly mode: "single_chart_relationship_profile" | "specific_partner_with_reality_data"; readonly gates: readonly NormalizedRealityGate[]; readonly profile: M5AdjudicationProfile }): M5Adjudication {
  const safetyGateFail = input.gates.some((gate) => ["RG01", "RG07"].includes(gate.id) && gate.status === "fail");
  const core = input.gates.filter((gate) => ["RG02", "RG03", "RG06", "RG07"].includes(gate.id));
  const coreFail = core.some((gate) => gate.status === "fail");
  const coreUnknown = core.some((gate) => ["unknown", "not_assessed"].includes(gate.status));
  const conditionalCount = input.gates.filter((gate) => gate.status === "conditional").length;
  const p = input.profile;
  const risks: string[] = [];
  const codes: string[] = [];
  const repairStatus = p.evidenceLevels.FV === 0 ? "not_assessed" : p.evidenceLevels.FV <= 4 ? "single_event" : "repeated";
  if (input.mode === "single_chart_relationship_profile") return result("limited", "insufficient_data", "FG1", "AF01", p, ["NO_CONCRETE_PARTNER_EVIDENCE"], ["SINGLE_CHART_CAP_FG1"], repairStatus);
  if (safetyGateFail || p.bridgeLevel === "FB0" || p.historicalSafetyFailure) return result("stop", "safety_stop", "FG0", "AF09", p, [p.historicalSafetyFailure && p.currentSafetyImprovement ? "HISTORICAL_SAFETY_NOT_CLEARED_BY_SHORT_IMPROVEMENT" : "SAFETY_STOP"], ["SAFETY_OVERRIDES_ALL"], repairStatus);
  if (coreFail) return result("limited", "core_gate_stop", "FG2", "AF08", p, ["CORE_REALITY_GATE_FAILED"], ["CORE_GATE_CAP_FG2"], repairStatus);
  if (p.dependencyPending) return result("limited", "insufficient_data", "FG2", "AF03", p, ["UPSTREAM_DEPENDENCY_PENDING"], ["PROVISIONAL_ONLY"], repairStatus);
  if (coreUnknown || p.singlePartyEvidence) return result("limited", "insufficient_data", "FG2", "AF02", p, [p.singlePartyEvidence ? "SINGLE_PARTY_EVIDENCE" : "CORE_REALITY_GATE_UNKNOWN"], ["EVIDENCE_CAP_FG2"], repairStatus);
  if (p.bridgeLevel === "FB1") return result("limited", "standard", "FG2", "AF04", p, ["BRIDGE_NOT_STARTED"], ["BRIDGE_PLAN_ONLY"], repairStatus);
  if (p.bridgeLevel === "FB3") return result("limited", "standard", "FG3", "AF04", p, ["BRIDGE_SINGLE_EVENT"], ["BRIDGE_REQUIRES_REPETITION"], repairStatus);
  if (p.explicitEvidenceProfile && p.independentGaps >= 2) return result("limited", "standard", "FG2", "AF03", p, ["MULTIPLE_INDEPENDENT_GAPS"], ["PRESERVE_PRIMARY_SECONDARY_GAPS"], repairStatus);
  if (p.explicitEvidenceProfile && p.attraction === "high" && Math.min(p.evidenceLevels.XV, p.evidenceLevels.BV, p.evidenceLevels.HV) <= 1) return result("limited", "standard", "FG2", "AF02", p, ["ATTRACTION_WITH_WEAK_REALITY_STRUCTURE"], ["ATTRACTION_DOES_NOT_RAISE_FIT"], repairStatus);
  if (p.explicitEvidenceProfile && p.admissionVerified && Math.min(p.evidenceLevels.PV, p.evidenceLevels.XV, p.evidenceLevels.BV, p.evidenceLevels.HV) <= 1) return result("limited", "standard", "FG2", "AF02", p, ["ADMISSION_WITHOUT_LONG_TERM_EVIDENCE"], ["ADMISSION_IS_NOT_FIT"], repairStatus);
  if (p.explicitEvidenceProfile && p.evidenceLevels.PV >= 5 && p.evidenceLevels.XV <= 1) return result("limited", "standard", "FG2", "AF03", p, ["PARTNER_CAPACITY_WITHOUT_RECIPROCITY"], ["PV_XV_SEPARATE"], repairStatus);
  if (p.explicitEvidenceProfile && p.evidenceLevels.XV >= 4 && p.evidenceLevels.BV <= 1) return result("limited", "standard", "FG3", "AF03", p, ["BOUNDARY_RISK_REMAINS"], ["BOUNDARY_PRECEDES_EXCHANGE"], repairStatus);
  if (conditionalCount >= 2) return result("limited", "standard", "FG3", "AF04", p, ["MULTIPLE_CONDITIONAL_GATES"], ["CONDITIONAL_CAP_FG3"], repairStatus);
  if (conditionalCount === 1) return result("complete", "standard", "FG3", "AF04", p, ["CONDITION_FAILURE_POINT_MUST_BE_PUBLISHED"], ["SINGLE_CONDITIONAL_GATE"], repairStatus);
  if (p.explicitEvidenceProfile && p.evidenceLevels.FV > 0 && p.evidenceLevels.FV <= 4) return result("complete", "standard", "FG3", "AF06", p, ["REPAIR_NOT_YET_CROSS_STATE"], ["REPAIR_EVENT_CAP_FG3"], repairStatus);
  if (p.explicitEvidenceProfile && p.evidenceLevels.FV >= 5 && p.evidenceLevels.HV <= 1) return result("complete", "standard", "FG3", "AF06", p, ["RHYTHM_RESIDUAL_RISK"], ["REPAIR_DOES_NOT_ERASE_RHYTHM"], repairStatus);
  if (p.crossStateValidated) return result("complete", "standard", "FG4", "AF07", p, [], ["CROSS_STATE_STABLE"], repairStatus);
  if (p.bridgeLevel === "FB4") return result("complete", "standard", "FG3", "AF05", p, [], ["BRIDGE_REPEATED_EFFECTIVE"], repairStatus);
  if (p.explicitEvidenceProfile && (p.attraction === "low" || p.historicalCurrentConflict || p.evidenceLevels.FV === 0)) return result("complete", "standard", "FG3", "AF05", p, p.evidenceLevels.FV === 0 ? ["REPAIR_NOT_ASSESSED"] : [], [p.historicalCurrentConflict ? "CURRENT_EVIDENCE_CONTROLS_CURRENT_ASSESSMENT" : "REALITY_STRUCTURE_INDEPENDENT_OF_ATTRACTION"], repairStatus);
  return result("complete", "standard", "FG3", "AF04", p, risks, codes.length ? codes : ["STANDARD_REALITY_SYNTHESIS"], repairStatus);
}

function result(reportStatus: M5Adjudication["reportStatus"], safetyStatus: M5Adjudication["safetyStatus"], grade: FitGrade, assessment: AssessmentFlag, profile: M5AdjudicationProfile, residualRisks: readonly string[], decisionCodes: readonly string[], repairStatus: M5Adjudication["repairStatus"]): M5Adjudication {
  const profileCodes = [
    ...(profile.transformationStatus === "true_transformation" ? ["TRUE_TRANSFORMATION_REPLACES_ORIGINAL_FUNCTION"] : profile.transformationStatus === "combined_not_transformed" ? ["COMBINED_NOT_TRANSFORMED_PRESERVES_ORIGINAL_FUNCTION"] : []),
    ...(profile.functionalFamily ? [`FUNCTIONAL_FAMILY:${profile.functionalFamily}`] : []),
    ...(profile.independentNeeds >= 2 ? ["PRESERVE_PRIMARY_SECONDARY_NEEDS"] : []),
    ...(profile.independentGaps >= 2 ? ["PRESERVE_PRIMARY_SECONDARY_GAPS"] : []),
  ];
  return Object.freeze({ reportStatus, safetyStatus, grade, assessment, bridgeLevel: profile.bridgeLevel, residualRisks: Object.freeze([...residualRisks]), decisionCodes: Object.freeze([...new Set([...decisionCodes, ...profileCodes])]), repairStatus });
}
