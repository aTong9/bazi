import type { M4Result } from "./m4.js";
import { normalizeRealityGates, type RealityGateAssessment } from "./reality-gates.js";
import type { RelationshipRuleCatalog } from "./rule-catalog.js";

export type FitGrade = "FG0" | "FG1" | "FG2" | "FG3" | "FG4";
export type AssessmentFlag = "AF01" | "AF02" | "AF03" | "AF04" | "AF05" | "AF06" | "AF07" | "AF08" | "AF09";
export type RealityEvidenceScheme = "PV" | "XV" | "BV" | "FV" | "HV";
export interface RealityEvidenceDimension {
  readonly scheme: RealityEvidenceScheme;
  readonly level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly status: "not_assessed" | "available" | "blocked";
  readonly gateIds: readonly string[];
  readonly eventIds: readonly string[];
}
export interface M5Input {
  readonly mode: "single_chart_relationship_profile" | "specific_partner_with_reality_data";
  readonly m4: M4Result;
  readonly gateAssessments?: readonly RealityGateAssessment[];
  readonly crossStateValidation?: { readonly steady: boolean; readonly pressure: boolean; readonly repair: boolean; readonly turningPoint: boolean; readonly counterevidenceReviewed: boolean };
  readonly rules?: RelationshipRuleCatalog;
}

export function analyzeM5(input: M5Input) {
  const single = input.mode === "single_chart_relationship_profile";
  const realityGates = normalizeRealityGates(single ? undefined : input.gateAssessments, single ? "not_assessed" : "unknown");
  const safetyFailure = realityGates.some((gate) => (gate.id === "RG01" || gate.id === "RG07") && gate.status === "fail");
  const core = realityGates.filter((gate) => ["RG02", "RG03", "RG06", "RG07"].includes(gate.id));
  const coreFailure = core.some((gate) => gate.status === "fail");
  const coreUnresolved = core.some((gate) => gate.status === "unknown" || gate.status === "not_assessed");
  const allPass = realityGates.every((gate) => gate.status === "pass");
  const dimensionGates: Readonly<Record<RealityEvidenceScheme, readonly string[]>> = {
    PV: ["RG02"], XV: ["RG04"], BV: ["RG01", "RG07"], FV: ["RG06"], HV: ["RG03", "RG05"],
  };
  const evidenceDimensions = Object.freeze(Object.fromEntries(Object.entries(dimensionGates).map(([scheme, gateIds]) => {
    const gates = realityGates.filter((gate) => gateIds.includes(gate.id));
    const eventIds = [...new Set(gates.flatMap((gate) => gate.evidenceIds))];
    const blocked = gates.some((gate) => gate.status === "fail");
    const level = Math.min(7, eventIds.length) as RealityEvidenceDimension["level"];
    return [scheme, Object.freeze({ scheme, level, status: blocked ? "blocked" : eventIds.length ? "available" : "not_assessed", gateIds: Object.freeze([...gateIds]), eventIds: Object.freeze(eventIds) })];
  })) as Record<RealityEvidenceScheme, RealityEvidenceDimension>);
  const crossState = input.crossStateValidation;
  let grade: FitGrade = "FG2";
  let assessment: AssessmentFlag = "AF02";
  if (single) { grade = "FG1"; assessment = "AF01"; }
  else if (safetyFailure) { grade = "FG0"; assessment = "AF09"; }
  else if (coreFailure) { grade = "FG2"; assessment = "AF08"; }
  else if (coreUnresolved) { grade = "FG2"; assessment = "AF07"; }
  else if (allPass && crossState && Object.values(crossState).every(Boolean)) { grade = "FG4"; assessment = "AF05"; }
  else if (allPass) { grade = "FG3"; assessment = "AF04"; }
  const ordinaryFindings = safetyFailure ? [] : input.m4.riskChains.map((chain) => ({ chainId: chain.id, realityStatus: chain.realityStatus }));
  const stageStatus = (dimension: RealityEvidenceDimension) => dimension.status === "not_assessed" ? "not_assessed" as const : dimension.status === "blocked" ? "blocked" as const : "provisional" as const;
  const gapCodes = Object.values(evidenceDimensions).filter((dimension) => dimension.status !== "available").map((dimension) => `${dimension.scheme}:${dimension.status}`);
  const stages = Object.freeze({
    base: Object.freeze({ status: single ? "provisional" as const : coreUnresolved ? "limited" as const : "provisional" as const, needs: Object.freeze(["现实尊重", "双向交换", "边界与同意", "修复闭环", "生活节奏"]) }),
    partner: Object.freeze({ status: stageStatus(evidenceDimensions.PV), evidence: evidenceDimensions.PV, scope: "observable_partner_behavior_only" as const }),
    exchange: Object.freeze({ status: stageStatus(evidenceDimensions.XV), evidence: evidenceDimensions.XV, scope: "bidirectional_exchange_only" as const }),
    bound: Object.freeze({ status: stageStatus(evidenceDimensions.BV), evidence: evidenceDimensions.BV, consentPriority: true as const }),
    repair: Object.freeze({ status: stageStatus(evidenceDimensions.FV), evidence: evidenceDimensions.FV, requiresReceiverFeedback: true as const }),
    rhythm: Object.freeze({ status: stageStatus(evidenceDimensions.HV), evidence: evidenceDimensions.HV, separateFromEntryTempo: true as const }),
    gap: Object.freeze({ status: gapCodes.length ? "limited" as const : "clear" as const, codes: Object.freeze(gapCodes), attractionDoesNotRaiseFit: true as const }),
    synth: Object.freeze({ status: safetyFailure ? "stopped" as const : coreUnresolved ? "limited" as const : "provisional" as const, grade, assessment }),
  });
  const ruleTrace = ["BASE", "PARTNER", "EXCHANGE", "BOUND", "REPAIR", "RHYTHM", "GAP", "SYNTH"].flatMap((stage) => input.rules?.getModuleRecords(`M5.${stage}`).slice(0, 8).map((record) => record.id) ?? []);
  return Object.freeze({
    moduleId: "M5.SYNTH" as const,
    stageOrder: Object.freeze(["BASE", "PARTNER", "EXCHANGE", "BOUND", "REPAIR", "RHYTHM", "GAP", "SYNTH"] as const),
    mode: input.mode,
    reportStatus: safetyFailure ? "stop" as const : single || coreUnresolved ? "limited" as const : "complete" as const,
    safetyStatus: safetyFailure ? "safety_stop" as const : coreFailure ? "core_gate_stop" as const : coreUnresolved ? "insufficient_data" as const : "standard" as const,
    realityGates,
    evidenceDimensions,
    stages,
    observationPlan: Object.freeze(realityGates.filter((gate) => gate.status !== "pass").slice(0, 3).map((gate) => Object.freeze({ gateId: gate.id, observe: gate.label, directive: false as const }))),
    partnerFacts: single ? null : Object.freeze({ scope: "submitted_reality_evidence_only" as const }),
    fit: Object.freeze({ grade, assessment, ordinaryFindings: Object.freeze(ordinaryFindings), isSuccessProbability: false as const }),
    boundaries: Object.freeze(["适配是结构交集加现实闸门，不是总分", "FG 是发布证据等级，不是成功概率", "AF 是当前评估状态，不是命运"]),
    ruleTrace: Object.freeze([...new Set(ruleTrace)]),
    notADirective: true as const,
  });
}
