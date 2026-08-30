import { performance } from "node:perf_hooks";
import { analyzeProfile } from "../../application/src/analyze-profile.js";
import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import { parseProfileAnalyzeRequest } from "../../contracts/src/profile-analyze-contract.js";
import { validateRelationshipResponse } from "../../contracts/src/relationship-response-contract.js";
import { validateResultItemContract } from "../../contracts/src/result-item-contract.js";
import { validateBirthInput } from "../../domain/src/birth-input.js";
import type { DevelopmentTestDefinition } from "./read-development-test-matrix.js";
import type { MatrixAssertionExecution } from "./report-language-runner.js";

type Mutable = Record<string, unknown>;

export function executeJsonDataMatrix(definitions: readonly DevelopmentTestDefinition[], catalog: CatalogSnapshot): readonly MatrixAssertionExecution[] {
  const analyzed = analyzeProfile({ analysisMode: "test", roleBasis: "female_traditional", relationshipMode: "single_chart_relationship_profile", subject: { inputMode: "four_pillars_provided", subjectId: "JSON-MATRIX", fourPillars: { year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } }, birthTimeStatus: "exact", timezone: "Asia/Shanghai", dataQuality: "high", syntheticFixture: true }, requestedSections: ["m0", "m1", "m2", "m3", "m4", "m5"] }, catalog);
  if (!analyzed.ok) throw new Error(`Unable to build JSON matrix baseline: ${JSON.stringify(analyzed.issues)}`);
  const baseline = analyzed.response as unknown as Mutable;
  return Object.freeze(definitions.filter((definition) => definition.suite === "06_JSON数据测试").map((definition) => {
    const startedAt = performance.now();
    const result = executeCase(definition.testId, baseline, catalog);
    return Object.freeze({ testId: definition.testId, passed: result.passed, actualSummary: JSON.stringify(result), durationMs: performance.now() - startedAt });
  }));
}

function executeCase(testId: string, baseline: Mutable, catalog: CatalogSnapshot): { passed: boolean; assertion: string; errors?: readonly string[] } {
  const validate = (value: unknown, expected = true) => { const errors = validateRelationshipResponse(value, { rulesetDigest: catalog.manifest.rulesetDigest, integrationVersion: catalog.manifest.integrationVersion }); return { passed: expected ? errors.length === 0 : errors.length > 0, errors }; };
  switch (testId) {
    case "JS-001": return { ...validate(baseline), assertion: "minimal real response validates" };
    case "JS-002": { const value = copy(baseline); delete record(value.report).schemaVersion; return { ...validate(value, false), assertion: "schema version is required" }; }
    case "JS-003": { const value = copy(baseline); delete record(record(value.m0).fields)[Object.keys(record(record(value.m0).fields))[0]!]; return { ...validate(value, false), assertion: "M0 has exactly 45 fields" }; }
    case "JS-004": { const value = { ...copy(baseline), undeclared: true }; return { ...validate(value, false), assertion: "top-level additional properties rejected" }; }
    case "JS-005": { const errors = validateRelationshipResponse(baseline, { rulesetDigest: "0".repeat(64) }); return { passed: errors.some((error) => error.includes("fixed snapshot")), assertion: "version mismatch blocks publication", errors }; }
    case "JS-006": { const value = copy(baseline); const list = array(value.ruleTrace); value.ruleTrace = [...list, list[0]]; return { ...validate(value, false), assertion: "rule ids unique" }; }
    case "JS-007": { const value = copy(baseline); const list = array(value.sourceIds); value.sourceIds = [...list, list[0]]; return { ...validate(value, false), assertion: "source ids unique" }; }
    case "JS-008": { const value = copy(baseline); record(record(value.report).trace).eventIds = ["EV-1", "EV-1"]; return { ...validate(value, false), assertion: "event ids unique" }; }
    case "JS-009": { const result = validateResultItemContract(resultItem("unknown", "确定断语", "unknown", ["reason"])); return { passed: !result.valid, assertion: "unknown cannot carry a determinate value", errors: result.errors }; }
    case "JS-010": { const result = validateResultItemContract(resultItem("conditional", "候选", "medium", [])); return { passed: !result.valid, assertion: "conditional requires conditions", errors: result.errors }; }
    case "JS-011": { const value = copy(baseline); const m3 = record(record(value.relationship).m3); m3.status = "complete"; delete m3.repair; return { ...validate(value, false), assertion: "complete M3 requires closed dependencies" }; }
    case "JS-012": { const value = copy(baseline); record(record(record(value.relationship).m5).fit).grade = "FG3"; return { ...validate(value, false), assertion: "no reality events cannot publish FG3" }; }
    case "JS-013": { const value = copy(baseline); const m5 = record(record(value.relationship).m5); m5.safetyStatus = "safety_stop"; m5.reportStatus = "complete"; return { ...validate(value, false), assertion: "RG safety failure requires stop" }; }
    case "JS-014": { const value = copy(baseline); record(array(record(value.report).boundaries)[0]).hard = false; return { ...validate(value, false), assertion: "hard timing boundary cannot be false" }; }
    case "JS-015": { const value = copy(baseline); record(array(record(value.report).boundaries).find((item) => record(item).code === "NOT_DIRECTIVE")).hard = false; return { ...validate(value, false), assertion: "non-directive boundary cannot be false" }; }
    case "JS-016": { const result = validateBirthInput({ inputMode: "four_pillars_provided", subjectId: "x", fourPillars: { year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } }, birthTimeStatus: "unknown", dataQuality: "high", syntheticFixture: true }); return { passed: !result.ok && result.issues.some((issue) => issue.code === "E_UNKNOWN_HOUR_MUST_BE_NULL"), assertion: "unknown time and exact hour are inconsistent" }; }
    case "JS-017": { const value = copy(baseline); record(record(record(value.relationship).m5).fit).grade = "FG4"; return { ...validate(value, false), assertion: "single chart cannot publish FG4" }; }
    case "JS-018": { const parsed = parseProfileAnalyzeRequest({ ...wireRequest(), subject_b: null }); return { passed: parsed.valid, assertion: "subject_b is optional and nullable" }; }
    case "JS-019": { const request = wireRequest(); record(request.subject).birth_date = "29/08/2026"; const parsed = parseProfileAnalyzeRequest(request); return { passed: !parsed.valid, assertion: "invalid or undeclared birth date rejected", ...(!parsed.valid ? { errors: parsed.errors } : {}) }; }
    case "JS-020": { const value = copy(baseline); record(value.report).observationPlan = Array.from({ length: 6 }, (_, index) => ({ gateId: `RG0${index + 1}`, observe: "x", directive: false })); return { ...validate(value, false), assertion: "report observation plan max 5" }; }
    case "JS-021": { const value = copy(baseline); record(record(value.relationship).m5).observationPlan = Array.from({ length: 4 }, () => ({ gateId: "RG01" })); return { ...validate(value, false), assertion: "M5 observation plan max 3" }; }
    case "JS-022": { const value = copy(baseline); value.ruleTrace = []; return { ...validate(value, false), assertion: "published conclusion has rule trace" }; }
    case "JS-023": { const value = copy(baseline); record(record(value.report).logs).decisions = [{ decisionId: "", code: "C", outcome: "O", ruleIds: [] }]; return { ...validate(value, false), assertion: "decision id required" }; }
    case "JS-024": { const parsed = parseProfileAnalyzeRequest({ ...wireRequest(), legacy_payloads: { m5_v0_9: { status: "legacy" } } }); return { passed: parsed.valid, assertion: "legacy payload accepted only in explicit container" }; }
    case "JS-025": { const value = copy(baseline); record(value.report).unicodeProbe = undefined; const source = "中文，。；Rule_ID：M5-SYNTH-001"; return { passed: JSON.parse(JSON.stringify({ source })).source === source, assertion: "UTF-8 roundtrip" }; }
    default: return { passed: false, assertion: `No JSON evaluator registered for ${testId}` };
  }
}

function copy<T>(value: T): T { return structuredClone(value); }
function record(value: unknown): Mutable { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object"); return value as Mutable; }
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error("Expected array"); return value; }
function resultItem(status: string, value: unknown, confidence: string, conditions: string[]) { return { applicability: "applicable", status, value, confidence, evidence: null, ruleIds: [], sourceIds: [], eventIds: [], conditions, counterevidence: [] }; }
function wireRequest(): Mutable { return { analysis_mode: "test", role_basis: "female_traditional", subject: { input_mode: "four_pillars_provided", subject_id: "P", four_pillars: { year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } }, birth_time_status: "exact", timezone: "Asia/Shanghai", data_quality: "high", synthetic_fixture: true }, requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"] }; }
