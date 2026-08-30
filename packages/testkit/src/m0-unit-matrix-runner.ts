import { performance } from "node:perf_hooks";

import { analyzeM0, type AnalyzeM0Command, type M0AnalysisResponse } from "../../application/src/analyze-m0.js";
import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import type { DevelopmentTestDefinition } from "./read-development-test-matrix.js";
import type { MatrixAssertionExecution } from "./report-language-runner.js";

export function executeM0UnitMatrix(definitions: readonly DevelopmentTestDefinition[], catalog: CatalogSnapshot): readonly MatrixAssertionExecution[] {
  const exact = requireSuccess(analyzeM0(command("exact"), catalog));
  const unknown = requireSuccess(analyzeM0(command("unknown"), catalog));
  return Object.freeze(definitions.filter((item) => item.suite === "02_M0单元测试").map((definition) => execute(definition.testId, exact, unknown, catalog)));
}

function execute(testId: string, exact: M0AnalysisResponse, unknown: M0AnalysisResponse, catalog: CatalogSnapshot): MatrixAssertionExecution {
  const startedAt = performance.now();
  try {
    if (/^M0-(?:POS|BND)-M(?:0[2-9]|1[0-8])$/u.test(testId)) {
      const moduleNumber = testId.slice(-3);
      const module = exact.m0.modules[`M0.${moduleNumber}`] as Record<string, unknown>;
      check(module?.moduleId === `M0.${moduleNumber}`, "module identity mismatch");
      check(Array.isArray(module.matchedRuleIds) && module.matchedRuleIds.length > 0, "rule trace is empty");
      if (testId.includes("-BND-")) assertBoundary(moduleNumber, module);
    } else {
      assertCrossLayer(testId, exact, unknown, catalog);
    }
    return record(testId, true, "real M0 chain satisfied module and layer contract", startedAt);
  } catch (error) {
    return record(testId, false, error instanceof Error ? error.message : String(error), startedAt);
  }
}

function assertBoundary(id: string, value: Record<string, unknown>): void {
  const checks: Record<string, () => boolean> = {
    M02: () => includes(value.forbiddenConclusions, "strength") && includes(value.forbiddenConclusions, "favorability"),
    M03: () => includes(value.forbiddenConclusions, "day_master_strength") && Array.isArray(value.dayMasterRoots),
    M04: () => Array.isArray(value.relations) && !hasKey(value, "effects"),
    M05: () => Array.isArray(value.relations) && !hasKey(value, "strengthChange"),
    M06: () => includes(value.forbiddenConclusions, "final_strength") && Array.isArray(value.effects),
    M07: () => hasKey(value, "elements") && !hasKey(value, "finalStrength"),
    M08: () => hasKey(value, "elements") && !hasKey(value, "fixedPercentage"),
    M09: () => typeof value.strengthCandidate === "string" && Array.isArray(value.supportEvidence) && Array.isArray(value.burdenEvidence),
    M10: () => hasKey(value, "tenGods") && !hasKey(value, "goodOrBad"),
    M11: () => value.patternDeclared === false,
    M12: () => value.usefulGodDeclared === false,
    M13: () => hasKey(value, "temperature") && hasKey(value, "humidity"),
    M14: () => value.finalPatternDeclared === false,
    M15: () => Array.isArray(value.evaluations) && (value.evaluations as Record<string, unknown>[]).every((x) => hasKey(x, "formation") && hasKey(x, "damage") && hasKey(x, "rescue")),
    M16: () => Array.isArray(value.problems) && (value.problems as Record<string, unknown>[]).every((x) => hasKey(x, "rootCause") && hasKey(x, "surfaceSymptom")),
    M17: () => value.finalUsefulGodDeclared === false && Object.keys(value.matrix as object).length === 5,
    M18: () => Object.values(value.decisions as Record<string, Record<string, unknown>>).every((x) => Array.isArray(x.hardConstraints) && Array.isArray(x.doseBoundary)),
  };
  check(checks[id]?.() === true, `${id} boundary contract failed`);
}

function assertCrossLayer(testId: string, exact: M0AnalysisResponse, unknown: M0AnalysisResponse, catalog: CatalogSnapshot): void {
  const m = exact.m0.modules as Record<string, Record<string, unknown>>;
  switch (testId) {
    case "M0-X-001": check(Array.isArray(m["M0.M04"]?.relations) && Array.isArray(m["M0.M05"]?.relations) && Array.isArray(m["M0.M06"]?.effects), "relation/effect layers collapsed"); break;
    case "M0-X-002": check(m["M0.M07"]?.elements !== m["M0.M08"]?.elements, "raw/effective strength layers collapsed"); break;
    case "M0-X-003": check(hasKey(m["M0.M10"]!, "tenGods") && hasKey(m["M0.M17"]!, "matrix"), "function/classification layers missing"); break;
    case "M0-X-004": check(Array.isArray(m["M0.M14"]?.candidates) && Array.isArray(m["M0.M15"]?.evaluations), "candidate/evaluation layers missing"); break;
    case "M0-X-005": check(Array.isArray(m["M0.M16"]?.problems) && Object.values(m["M0.M18"]?.decisions as object).every((x) => Array.isArray((x as Record<string, unknown>).hardConstraints)), "problem/decision layers missing"); break;
    case "M0-X-006": check(Object.keys(exact.m0.fields).length === 45 && Object.keys(unknown.m0.fields).length === 45 && unknown.m0.dependencyFlags.includes("HOUR_UNKNOWN"), "45-field degradation contract failed"); break;
    case "M0-X-007": check(catalog.getRecord("M20") === null && catalog.getRecord("M21") === null, "test/governance records leaked into runtime"); break;
    case "M0-X-008": { const result = analyzeM0({ ...command("exact"), requestedSections: ["m0", "dynamic_timing"] }, catalog); check(!result.ok && result.issues[0]?.code === "E_DYNAMIC_MODEL_REQUIRED", "dynamic model boundary missing"); break; }
    default: throw new Error(`unmapped M0 matrix test ${testId}`);
  }
}

function command(status: "exact" | "unknown"): AnalyzeM0Command {
  return { analysisMode: "test", subject: { inputMode: "four_pillars_provided", subjectId: `M0-MATRIX-${status}`, fourPillars: { year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: status === "exact" ? { stem: "丙", branch: "午" } : null }, birthTimeStatus: status, timezone: "Asia/Shanghai", dataQuality: "high", syntheticFixture: true }, requestedSections: ["m0"] };
}
function requireSuccess(result: ReturnType<typeof analyzeM0>): M0AnalysisResponse { if (!result.ok) throw new Error(result.issues.map((x) => x.code).join(",")); return result.response; }
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function hasKey(value: Record<string, unknown>, key: string): boolean { return Object.prototype.hasOwnProperty.call(value, key); }
function includes(value: unknown, item: string): boolean { return Array.isArray(value) && value.includes(item); }
function record(testId: string, passed: boolean, actualSummary: string, startedAt: number): MatrixAssertionExecution { return Object.freeze({ testId, passed, actualSummary, durationMs: performance.now() - startedAt }); }
