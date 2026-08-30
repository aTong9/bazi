import { performance } from "node:perf_hooks";

import { analyzeProfile, type AnalyzeProfileCommand } from "../../application/src/analyze-profile.js";
import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import { createResultItem } from "../../domain/src/index.js";
import { classifyCalibrationFinding, EvidenceLedger, FieldAuthorityRegistry } from "../../engine-core/src/index.js";
import type { RealityGateAssessment } from "../../relationship-engine/src/reality-gates.js";
import type { DevelopmentTestDefinition } from "./read-development-test-matrix.js";
import type { MatrixAssertionExecution } from "./report-language-runner.js";

type ProfileResponse = Extract<ReturnType<typeof analyzeProfile>, { ok: true }>["response"];
interface InterfaceContext { readonly single: ProfileResponse; readonly unresolved: ProfileResponse; readonly allPass: ProfileResponse; readonly safety: ProfileResponse; readonly coreFail: ProfileResponse; readonly legacy: ProfileResponse }

export function executeInterfaceContractMatrix(definitions: readonly DevelopmentTestDefinition[], catalog: CatalogSnapshot): readonly MatrixAssertionExecution[] {
  const single = success(analyzeProfile(command(), catalog));
  const unresolved = success(analyzeProfile(command({ relationshipMode: "specific_partner_with_reality_data" }), catalog));
  const allPass = success(analyzeProfile(command({ relationshipMode: "specific_partner_with_reality_data", gateAssessments: gates("pass") }), catalog));
  const safety = success(analyzeProfile(command({ relationshipMode: "specific_partner_with_reality_data", gateAssessments: gates("pass", { RG01: "fail" }) }), catalog));
  const coreFail = success(analyzeProfile(command({ relationshipMode: "specific_partner_with_reality_data", gateAssessments: gates("pass", { RG03: "fail" }) }), catalog));
  const legacy = success(analyzeProfile(command({ subjectB: subject("B"), legacyPayloads: { m5_v0_9: { status: "legacy" } } }), catalog));
  const context = { single, unresolved, allPass, safety, coreFail, legacy };
  return Object.freeze(definitions.filter((item) => item.suite === "03_接口契约测试").map((definition) => execute(definition.testId, context)));
}

function execute(testId: string, c: InterfaceContext): MatrixAssertionExecution {
  const startedAt = performance.now();
  try {
    const r = c.single.relationship; const m5 = r.m5;
    switch (testId) {
      case "IF-001": check(r.m1.synthesis.boundary === "ATTRACTION_ENTRY_ONLY" && r.m1.forbiddenInferences.includes("relationship_outcome"), "M1 exceeded attraction translation authority"); break;
      case "IF-002": check(r.m2.qualification.evidence.length >= 0 && r.m2.synthesis.scopeBoundary.some((x: string) => x.includes("不判断对象好坏或关系结果")), "M2 admission boundary missing"); break;
      case "IF-003": check(Object.values(r.m3.channels).every((x) => x.status === "provisional") && r.m3.boundaries.includes("不判断关系结果或适配"), "M3 personal-pattern projection missing"); break;
      case "IF-004": check(r.m4.riskChains.every((x) => x.realityStatus === "unconfirmed" && x.buffer.chainId === x.id), "potential protection was published as observed"); break;
      case "IF-005": check(m5.mode === "single_chart_relationship_profile" && m5.observationPlan.length > 0 && m5.partnerFacts === null, "single-chart needs/observation contract missing"); break;
      case "IF-006": check(r.m1.status === "provisional" && ["provisional", "dependency_pending"].includes(r.m2.status), "attraction and admission were not retained separately"); break;
      case "IF-007": check(m5.fit.grade === "FG1" && !Object.hasOwn(m5.fit, "attractionScore"), "attraction improperly raised fit"); break;
      case "IF-008": check(r.m2.moduleId === "M2.SYNTH" && r.m3.moduleId === "M3.SYNTH" && r.m3.boundaries.some((x) => x.includes("关系建立后")), "pre/post relationship layers collapsed"); break;
      case "IF-009": check(r.m2.tempo.calendarDuration === null && m5.evidenceDimensions.HV.scheme === "HV", "entry and long-term rhythm collapsed"); break;
      case "IF-010": check(Object.values(r.m3.channels).some((x) => x.statements.length > 0) && r.m4.riskChains.every((x) => x.structuralCandidate.length > 0), "function/risk separation missing"); break;
      case "IF-011": check(m5.fit.grade === "FG1" && m5.realityGates.every((x) => x.status === "not_assessed"), "personal inertia became mature dyadic finding"); break;
      case "IF-012": check(r.m3.calibration?.stateRepairSynthesis === "dependency_pending", "M3 calibration dependency was fabricated away"); break;
      case "IF-013": check(r.m4.riskChains.every((x) => x.repair.chainId === x.id && x.buffer.chainId === x.id), "protection erased risk-chain provenance"); break;
      case "IF-014": check(m5.evidenceDimensions.PV !== m5.evidenceDimensions.XV, "partner and exchange evidence collapsed"); break;
      case "IF-015": check(c.safety.relationship.m5.evidenceDimensions.BV.status === "blocked" && c.safety.relationship.m5.fit.grade === "FG0", "boundary risk did not override exchange"); break;
      case "IF-016": check(m5.evidenceDimensions.BV.status === "not_assessed" && m5.evidenceDimensions.FV.status === "not_assessed", "ordinary boundary was used as repair evidence"); break;
      case "IF-017": check(c.allPass.relationship.m5.evidenceDimensions.FV !== c.allPass.relationship.m5.evidenceDimensions.HV, "repair and rhythm residual risk collapsed"); break;
      case "IF-018": check(c.coreFail.relationship.m5.fit.assessment === "AF08" && c.coreFail.relationship.m5.fit.grade === "FG2", "core reality gate did not cap publication"); break;
      case "IF-019": check(c.legacy.relationship.structuralSupplement.available && !c.legacy.relationship.structuralSupplement.replacesRealityEvidence && !c.legacy.relationship.structuralSupplement.replacesRealityGates, "second chart replaced reality evidence"); break;
      case "IF-020": check(m5.fit.grade === "FG1" && m5.partnerFacts === null && m5.observationPlan.length > 0, "single-chart mode evaluated a concrete partner"); break;
      case "IF-021": check(c.unresolved.relationship.m5.reportStatus === "limited" && c.unresolved.relationship.m5.realityGates.some((x) => x.status === "unknown"), "specific-partner missing data was not limited"); break;
      case "IF-022": check(c.safety.relationship.m5.reportStatus === "stop" && c.safety.relationship.m5.fit.assessment === "AF09" && c.safety.relationship.m5.fit.ordinaryFindings.length === 0, "safety fact did not globally stop report"); break;
      case "IF-023": check(c.unresolved.relationship.m5.fit.grade === "FG2", "unknown core gates exceeded FG2"); break;
      case "IF-024": { const ledger = ledgerWithSharedEvidence(); check(ledger.uniqueSourceCount === 1 && ledger.fieldsForSource("source-1").length === 2, "source was double weighted"); break; }
      case "IF-025": { const ledger = ledgerWithSharedEvidence(); check(ledger.uniqueEventCount === 1 && ledger.fieldsForEvent("event-1").length === 5, "event was split into multiple evidence units"); break; }
      case "IF-026": { const registry = new FieldAuthorityRegistry([{ fieldFamily: "fit", authorityModuleId: "M5.SYNTH", definition: "fit authority", conflictPolicy: "reject_lower_authority" }]); check(registry.decideWrite("M4.SYNTH", "fit").outcome === "rejected" && registry.decideWrite("M5.SYNTH", "fit").outcome === "accepted", "field authority averaged conflicts"); break; }
      case "IF-027": { const item = createResultItem({ applicability: "applicable", status: "conditional", value: "candidate", confidence: "low", evidence: null, ruleIds: [], sourceIds: [], eventIds: [], conditions: ["condition"], counterevidence: ["invalidation point"], notes: "review point" }); check(item.conditions.length > 0 && item.counterevidence.length > 0 && Boolean(item.notes), "conditional output lacks condition/invalidation/review"); break; }
      case "IF-028": { const ledger = new EvidenceLedger(); ledger.addEvent("history", "background"); ledger.addEvent("current", "current_assessment"); check(ledger.fieldsForEvent("history")[0] === "background" && ledger.fieldsForEvent("current")[0] === "current_assessment", "historical and current objects collapsed"); break; }
      case "IF-029": { const finding = classifyCalibrationFinding(true); check(finding.discoveryTiming === "feedback_after" && !finding.countsAsPredictionHit, "post-feedback finding counted as prediction hit"); break; }
      case "IF-030": check(c.legacy.relationship.legacyPayloads?.mode === "wrapped_read_only" && c.legacy.relationship.legacyPayloads.payloads.m5_v0_9 !== undefined, "legacy payload was silently overwritten"); break;
      default: throw new Error(`unmapped interface test ${testId}`);
    }
    return record(testId, true, "interface authority and boundary contract satisfied", startedAt);
  } catch (error) { return record(testId, false, error instanceof Error ? error.message : String(error), startedAt); }
}

function command(overrides: Partial<AnalyzeProfileCommand> = {}): AnalyzeProfileCommand { return { analysisMode: "test", subject: subject("A"), requestedSections: ["m0", "m1", "m2", "m3", "m4", "m5"], roleBasis: "female_traditional", relationshipMode: "single_chart_relationship_profile", ...overrides }; }
function subject(subjectId: string): AnalyzeProfileCommand["subject"] { return { inputMode: "four_pillars_provided", subjectId, fourPillars: { year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } }, birthTimeStatus: "exact", timezone: "Asia/Shanghai", dataQuality: "high", syntheticFixture: true }; }
function gates(defaultStatus: RealityGateAssessment["status"], overrides: Partial<Record<RealityGateAssessment["id"], RealityGateAssessment["status"]>> = {}): RealityGateAssessment[] { return (["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"] as const).map((id) => ({ id, status: overrides[id] ?? defaultStatus, evidenceIds: [`event-${id}`] })); }
function success(result: ReturnType<typeof analyzeProfile>): ProfileResponse { if (!result.ok) throw new Error(result.issues.map((x) => x.code).join(",")); return result.response; }
function ledgerWithSharedEvidence(): EvidenceLedger { const ledger = new EvidenceLedger(); ledger.addSource("source-1", "m1"); ledger.addSource("source-1", "m2"); for (const field of ["PV", "XV", "BV", "FV", "HV"]) ledger.addEvent("event-1", field); return ledger; }
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function record(testId: string, passed: boolean, actualSummary: string, startedAt: number): MatrixAssertionExecution { return Object.freeze({ testId, passed, actualSummary, durationMs: performance.now() - startedAt }); }
