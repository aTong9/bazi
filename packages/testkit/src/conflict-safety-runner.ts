import { readFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { analyzeProfile, type AnalyzeProfileCommand } from "../../application/src/analyze-profile.js";
import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import { validateRelationshipResponse } from "../../contracts/src/relationship-response-contract.js";
import { analyzeM5 } from "../../relationship-engine/src/m5.js";
import type { M4Result } from "../../relationship-engine/src/m4.js";
import { validateReportLanguage } from "../../reporting/src/build-report.js";
import type { DevelopmentTestDefinition } from "./read-development-test-matrix.js";
import type { MatrixAssertionExecution } from "./report-language-runner.js";

type Mutable = Record<string, unknown>;
const MODULES = ["M1.CORE", "M2.GATE", "M2.CORE", "M2.SELF", "M2.FLOW", "M2.DUAL", "M2.TEMPO", "M2.SYNTH", "M3.BASE", "M3.EXPR", "M3.CARE", "M3.BOUND", "M3.CONFLICT", "M4.BASE", "M4.MISREAD", "M4.OVERUSE", "M4.TRIGGER", "M4.LOOP", "M4.REPAIR", "M4.BUFFER", "M4.SYNTH", "M5.BASE", "M5.PARTNER", "M5.EXCHANGE", "M5.BOUND", "M5.REPAIR", "M5.RHYTHM", "M5.GAP", "M5.SYNTH"] as const;

export function executeConflictSafetyMatrix(definitions: readonly DevelopmentTestDefinition[], catalog: CatalogSnapshot, repositoryRoot: string): readonly MatrixAssertionExecution[] {
  const baseline = success(analyzeProfile(command(), catalog));
  const safety = success(analyzeProfile(command({ relationshipMode: "specific_partner_with_reality_data", gateAssessments: [{ id: "RG01", status: "fail", evidenceIds: ["EV-SAFE"] }] }), catalog));
  const coreFail = success(analyzeProfile(command({ relationshipMode: "specific_partner_with_reality_data", gateAssessments: [{ id: "RG03", status: "fail", evidenceIds: ["EV-GOAL"] }] }), catalog));
  const unspecified = success(analyzeProfile(command({ roleBasis: "unspecified" }), catalog));
  return Object.freeze(definitions.filter((definition) => definition.suite === "05_冲突安全测试").map((definition) => {
    const startedAt = performance.now();
    try {
      const result = check(definition.testId, baseline, safety, coreFail, unspecified, catalog, repositoryRoot);
      return Object.freeze({ testId: definition.testId, passed: result.passed, actualSummary: JSON.stringify(result), durationMs: performance.now() - startedAt });
    } catch (error) {
      return Object.freeze({ testId: definition.testId, passed: false, actualSummary: JSON.stringify({ assertion: "runner threw", error: error instanceof Error ? error.message : String(error) }), durationMs: performance.now() - startedAt });
    }
  }));
}

function check(testId: string, baseline: Mutable, safety: Mutable, coreFail: Mutable, unspecified: Mutable, catalog: CatalogSnapshot, root: string): { passed: boolean; assertion: string } {
  const relationship = record(baseline.relationship); const m0 = record(baseline.m0); const modules = record(m0.modules);
  const m1 = record(relationship.m1); const m2 = record(relationship.m2); const m3 = record(relationship.m3); const m4 = record(relationship.m4); const m5 = record(relationship.m5);
  const sourceLock = JSON.parse(readFileSync(path.join(root, "data/source-package.lock.json"), "utf8")) as Mutable;
  const mappings = JSON.parse(readFileSync(path.join(root, "data/migrations/integration-v1.0-canonical-mappings.json"), "utf8")) as Mutable;
  const allLockedPaths = [...array(sourceLock.integrationCore), ...array(record(sourceLock.semanticSources).m0), ...array(record(sourceLock.semanticSources).m1M5), ...array(sourceLock.overlays)].map((item) => String(record(item).path));
  const relationshipRecords = MODULES.flatMap((moduleId) => catalog.getModuleRecords(moduleId));
  switch (testId) {
    case "CF-T-001": return verdict(!("strengthScore" in m1) && !("strengthScore" in m2) && "M0.M09" in modules, "M0 alone owns strength synthesis");
    case "CF-T-002": return verdict(!("effects" in record(modules["M0.M04"])) && array(record(modules["M0.M06"]).effects).length >= 0, "relation recognition and effects remain separate");
    case "CF-T-003": return verdict(!/favorability/u.test(JSON.stringify({ m1, m2, m3, m4, m5 })), "upper models do not recompute favorability");
    case "CF-T-004": return verdict(!/transformationStatus/u.test(JSON.stringify({ m1, m2, m3, m4, m5 })), "upper models do not rejudge transformation");
    case "CF-T-005": return verdict(array(m1.forbiddenInferences).includes("relationship_outcome") && record(m5.fit).grade === "FG1", "attraction does not increase fit grade");
    case "CF-T-006": return verdict(array(record(m2.synthesis).scopeBoundary).some((item) => String(item).includes("不判断对象好坏或关系结果")) && record(m5.fit).grade === "FG1", "admission does not prove mature fit");
    case "CF-T-007": return verdict(record(m2.tempo).calendarDuration === null && array(m5.stageOrder).includes("RHYTHM"), "entry tempo and relationship rhythm remain separate");
    case "CF-T-008": return verdict(record(m5.fit).grade === "FG1" && m5.partnerFacts === null, "personal pattern does not become dyadic fact");
    case "CF-T-009": return verdict(array(m4.riskChains).every((chain) => record(chain).realityStatus === "unconfirmed"), "M4 candidates are not actual harm");
    case "CF-T-010": return verdict(array(m4.riskChains).every((chain) => record(record(chain).buffer).chainId === record(chain).id), "buffer addresses same chain without erasing it");
    case "CF-T-011": return verdict(record(record(record(safety.relationship).m5).fit).grade === "FG0" && record(record(safety.relationship).m5).reportStatus === "stop" && array(record(record(record(safety.relationship).m5).fit).ordinaryFindings).length === 0, "safety failure stops ordinary fit");
    case "CF-T-012": return verdict(record(record(record(coreFail.relationship).m5).fit).grade === "FG2" && record(record(record(coreFail.relationship).m5).fit).assessment === "AF08", "core reality mismatch caps FG2");
    case "CF-T-013": return verdict(unique(array(record(baseline.report).trace ? record(record(baseline.report).trace).sourceIds : []).map(String)), "source ids are deduplicated");
    case "CF-T-014": { const result = analyzeM5({ mode: "specific_partner_with_reality_data", m4: m4 as unknown as M4Result, gateAssessments: [{ id: "RG02", status: "pass", evidenceIds: ["EV-1", "EV-1"] }] }); return verdict(array(record(array(result.realityGates).find((gate) => record(gate).id === "RG02")).evidenceIds).length === 1, "event ids count once per gate"); }
    case "CF-T-015": return verdict(Object.keys(record(m1.compatibilityFields)).sort().join() === ["distance_level", "flow_path", "palace_signal", "self_strength_status", "spouse_star_status"].join(), "M1 compatibility fields are explicit nulls");
    case "CF-T-016": return verdict(relationshipRecords.every((item) => ["active", "provisional", "example", "deprecated"].includes(item.lifecycleStatus)), "native lifecycle maps to canonical vocabulary");
    case "CF-T-017": return verdict(relationshipRecords.every((item) => ["high", "medium_high", "medium", "medium_low", "low", "unknown", "gated", "stopped", "not_applicable", "inherited"].includes(item.confidence)), "confidence maps conservatively");
    case "CF-T-018": return verdict(record(mappings.excelDate).output === "ISO-8601-date" && record(mappings.excelDate).preserveSerialAs === "nativeSerial", "Excel dates have an explicit lossless mapping");
    case "CF-T-019": return verdict(catalog.getRecord("M20-BASE-0001-V1.0") === null && catalog.getRecord("M21-GOV-0001-V1.0") === null, "M20 and M21 are absent from runtime catalog");
    case "CF-T-020": return verdict(Object.keys(record(m0.fields)).length === 45 && JSON.stringify(record(baseline.report).fields) === JSON.stringify(m0.fields), "upper report projects M19 without recomputation");
    case "CF-T-021": return verdict(array(m1.forbiddenInferences).includes("event_timing") && record(m2.tempo).calendarDuration === null, "static analysis does not predict dates");
    case "CF-T-022": return verdict(Boolean(m3.repair && m3.state && m3.synthesis) && array(m3.dependencyFlags).length === 0, "M3 repair state and synthesis are closed");
    case "CF-T-023": return verdict(m1.moduleId === "M1.SYNTH" && record(m1.synthesis).boundary === "ATTRACTION_ENTRY_ONLY", "M1 has a formal synthesis boundary");
    case "CF-T-024": return verdict(catalog.getModuleRecords("M2.GATE").every((item) => item.source.sourceFile.endsWith(".csv")), "M2 CSV is machine truth");
    case "CF-T-025": return verdict(allLockedPaths.every((item) => !/真实伴侣/u.test(item)), "obsolete duplicate calibration workbook is not locked runtime input");
    case "CF-T-026": return verdict(allLockedPaths.every((item) => !item.includes("06_历史归档") && !/设计文档/u.test(item)), "historical design documents are excluded from runtime");
    case "CF-T-027": return verdict(relationshipRecords.every((item) => item.source.sourceFile.endsWith(".csv")), "M1-M5 CSV records are canonical machine sources");
    case "CF-T-028": return verdict(validateRelationshipResponse(baseline).length === 0, "module payloads are wrapped by explicit unified response schema");
    case "CF-T-029": return verdict(record(m5.fit).grade === "FG1" && m5.partnerFacts === null, "chart structure never substitutes for partner reality data");
    case "CF-T-030": return verdict(record(unspecified.relationship).status === "dependency_pending" && record(mappings.traditionalSpouseStarPolicy).identityBinding === "never_inferred", "traditional role policy is explicit and never identity-inferred");
    case "CF-T-031": return verdict(array(m1.forbiddenInferences).includes("event_timing") && array(record(m2.synthesis).scopeBoundary).some((item) => String(item).includes("不预测具体时间")), "specific relationship dates are outside static scope");
    case "CF-T-032": return verdict(validateReportLanguage("病药说明某疾病").includes("MEDICAL_DIAGNOSIS"), "disease metaphor cannot become medical advice");
    case "CF-T-033": return verdict(array(m5.boundaries).some((item) => String(item).includes("不是成功概率")) && array(m5.boundaries).some((item) => String(item).includes("不是命运")), "FG and AF language boundaries are explicit");
    case "CF-T-034": return verdict(new Set(relationshipRecords.map((item) => item.id)).size === relationshipRecords.length && relationshipRecords.every((item) => item.source.sourceVersion.trim().length > 0), "stable rule ids are unique and every rule retains an explicit source-version mapping");
    case "CF-T-035": return verdict(allLockedPaths.every((item) => !/(?:^|\/)(?:_stage|preview)|\.(?:png|tmp)$/iu.test(item)), "preview and stage files are excluded from source lock");
    default: return verdict(false, `No conflict evaluator registered for ${testId}`);
  }
}

function command(overrides: Partial<AnalyzeProfileCommand> = {}): AnalyzeProfileCommand { return { analysisMode: "test", roleBasis: "female_traditional", relationshipMode: "single_chart_relationship_profile", subject: { inputMode: "four_pillars_provided", subjectId: "CF-MATRIX", fourPillars: { year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } }, birthTimeStatus: "exact", timezone: "Asia/Shanghai", dataQuality: "high", syntheticFixture: true }, requestedSections: ["m0", "m1", "m2", "m3", "m4", "m5"], ...overrides }; }
function success(result: ReturnType<typeof analyzeProfile>): Mutable { if (!result.ok) throw new Error(JSON.stringify(result.issues)); return result.response as unknown as Mutable; }
function record(value: unknown): Mutable { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object"); return value as Mutable; }
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error("Expected array"); return value; }
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length; }
function verdict(passed: boolean, assertion: string) { return { passed, assertion }; }
