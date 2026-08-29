import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import { validateRelationshipResponse } from "../../contracts/src/relationship-response-contract.js";
import type { M02Result } from "../../m0-engine/src/m02.js";
import type { M09Result } from "../../m0-engine/src/m09.js";
import type { M10Result } from "../../m0-engine/src/m10.js";
import { analyzeM1, type TraditionalRoleBasis } from "../../relationship-engine/src/m1.js";
import { analyzeM2 } from "../../relationship-engine/src/m2.js";
import { analyzeM3 } from "../../relationship-engine/src/m3.js";
import { analyzeM4, type M4Observation } from "../../relationship-engine/src/m4.js";
import { analyzeM5 } from "../../relationship-engine/src/m5.js";
import type { RealityGateAssessment } from "../../relationship-engine/src/reality-gates.js";
import { buildAnalysisReport } from "../../reporting/src/build-report.js";
import { analyzeM0, type AnalyzeM0Command } from "./analyze-m0.js";

export type AnalyzeProfileCommand = AnalyzeM0Command & {
  readonly roleBasis: TraditionalRoleBasis;
  readonly relationshipMode?: "single_chart_relationship_profile" | "specific_partner_with_reality_data";
  readonly observations?: readonly M4Observation[];
  readonly gateAssessments?: readonly RealityGateAssessment[];
  readonly crossStateValidation?: { readonly steady: boolean; readonly pressure: boolean; readonly repair: boolean; readonly turningPoint: boolean; readonly counterevidenceReviewed: boolean };
};
export function analyzeProfile(command: AnalyzeProfileCommand, catalog: CatalogSnapshot) {
  const m0 = analyzeM0(command, catalog);
  if (!m0.ok) return m0;
  const modules = m0.response.m0.modules;
  const m02 = modules["M0.M02"] as M02Result; const m09 = modules["M0.M09"] as M09Result; const m10 = modules["M0.M10"] as M10Result;
  const m1 = analyzeM1({ roleBasis: command.roleBasis, m10, rules: catalog });
  const m2 = analyzeM2({ m02, m09, m10, m1, rules: catalog });
  const m3 = analyzeM3({ m02, m09, m10, rules: catalog });
  const m4 = analyzeM4({ m3, rules: catalog, ...(command.observations ? { observations: command.observations } : {}) });
  const m5 = analyzeM5({ mode: command.relationshipMode ?? "single_chart_relationship_profile", m4, rules: catalog, ...(command.gateAssessments ? { gateAssessments: command.gateAssessments } : {}), ...(command.crossStateValidation ? { crossStateValidation: command.crossStateValidation } : {}) });
  const relationshipRuleTrace = Object.freeze([...new Set([...m1.ruleTrace, ...m2.ruleTrace, ...m3.ruleTrace, ...m4.ruleTrace, ...m5.ruleTrace])].sort());
  const eventIds = Object.freeze([...new Set(m5.realityGates.flatMap((gate) => gate.evidenceIds))]);
  const report = buildAnalysisReport({
    analysisRunId: m0.response.requestId, rulesetDigest: m0.response.rulesetDigest, reportStatus: m5.reportStatus, safetyStatus: m5.safetyStatus,
    fit: m5.fit, m0Fields: m0.response.m0.fields, profileStatements: m3.synthesis.statements,
    riskChains: m4.riskChains.map((chain) => ({ id: chain.id, candidate: chain.structuralCandidate, realityStatus: chain.realityStatus })),
    realityGates: m5.realityGates, ruleIds: [...m0.response.ruleTrace, ...relationshipRuleTrace], sourceIds: [...m0.response.sourceIds, ...relationshipRuleTrace], eventIds,
    dedupLog: eventIds.map((id) => `${id} counted once`), conflictLog: m5.fit.assessment === "AF08" ? ["CORE_REALITY_GATE_CAP_FG2"] : m5.fit.assessment === "AF09" ? ["SAFETY_STOP_OVERRIDES_ORDINARY_FIT"] : [],
    discardedCandidates: m4.riskChains.filter((chain) => chain.realityStatus === "unconfirmed").map((chain) => `${chain.id}:unconfirmed_harm`),
    decisions: m5.fit.assessment === "AF08" ? [{ decisionId: `${m0.response.requestId}:core-gate`, code: "CORE_REALITY_GATE_CAP_FG2", outcome: "CAP_FG2", ruleIds: m5.ruleTrace }] : m5.fit.assessment === "AF09" ? [{ decisionId: `${m0.response.requestId}:safety-stop`, code: "SAFETY_STOP_OVERRIDES_ORDINARY_FIT", outcome: "STOP", ruleIds: m5.ruleTrace }] : [],
    ...(m5.safetyStatus === "safety_stop" ? { safetyReason: "现实资料触发安全停止；请优先关注安全、同意与现实支持。" } : {}),
  });
  const response = { ...m0.response, relationship: { status: m1.status === "dependency_pending" || m2.status === "dependency_pending" ? "dependency_pending" as const : "provisional" as const, roleBasis: command.roleBasis, m1, m2, m3, m4, m5, dependencyFlags: Object.freeze([...new Set([...m1.dependencyFlags, ...m2.dependencyFlags, ...m3.dependencyFlags])]), ruleTrace: relationshipRuleTrace }, report };
  const publicationErrors = validateRelationshipResponse(response, { rulesetDigest: catalog.manifest.rulesetDigest, integrationVersion: catalog.manifest.integrationVersion });
  if (publicationErrors.length) return { ok: false as const, httpStatus: 500 as const, issues: Object.freeze(publicationErrors.map((message) => ({ code: "E_REPORT_PUBLICATION", severity: "error" as const, stage: "publication" as const, message, retryable: false }))) };
  return { ok: true as const, httpStatus: 200 as const, response };
}
