import { performance } from "node:perf_hooks";

import { analyzeProfile, type AnalyzeProfileCommand } from "../../application/src/analyze-profile.js";
import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import type { DevelopmentTestDefinition } from "./read-development-test-matrix.js";
import type { MatrixAssertionExecution } from "./report-language-runner.js";

type Response = Extract<ReturnType<typeof analyzeProfile>, { ok: true }>["response"];

export function executeUpstreamModuleMatrix(definitions: readonly DevelopmentTestDefinition[], catalog: CatalogSnapshot): readonly MatrixAssertionExecution[] {
  const positive = success(analyzeProfile(command({ relationshipMode: "specific_partner_with_reality_data", gateAssessments: gates(), crossStateValidation: { steady: true, pressure: true, repair: true, turningPoint: true, counterevidenceReviewed: true }, observations: repeatedObservations() }), catalog));
  const pending = success(analyzeProfile(command({ roleBasis: "unspecified" }), catalog));
  const limited = success(analyzeProfile(command({}, true), catalog));
  const unconfirmed = success(analyzeProfile(command(), catalog));
  const context = { positive, pending, limited, unconfirmed };
  return Object.freeze(definitions.filter((item) => item.suite === "04_M1-M5模块测试").map((definition) => execute(definition, context)));
}

function execute(definition: DevelopmentTestDefinition, c: { positive: Response; pending: Response; limited: Response; unconfirmed: Response }): MatrixAssertionExecution {
  const startedAt = performance.now();
  try {
    const moduleId = definition.fields["模块ID"] ?? "";
    const boundary = definition.fields["类型"] === "边界";
    if (moduleId === "M1.CORE") assertM1(boundary, c);
    else if (moduleId.startsWith("M2.")) assertM2(moduleId, boundary, c);
    else if (moduleId.startsWith("M3.")) assertM3(moduleId, boundary, c);
    else if (moduleId.startsWith("M4.")) assertM4(moduleId, boundary, c);
    else if (moduleId.startsWith("M5.")) assertM5(moduleId, boundary, c);
    else throw new Error(`unmapped module ${moduleId}`);
    return record(definition.testId, true, `${moduleId} ${boundary ? "boundary degradation" : "positive output"} verified`, startedAt);
  } catch (error) { return record(definition.testId, false, error instanceof Error ? error.message : String(error), startedAt); }
}

function assertM1(boundary: boolean, c: { positive: Response; pending: Response }): void {
  const value = boundary ? c.pending.relationship.m1 : c.positive.relationship.m1;
  if (boundary) check(value.status === "dependency_pending" && value.prototypes.length === 0 && value.dependencyFlags.length > 0, "M1 did not degrade on missing role basis");
  else check(value.status === "provisional" && value.prototypes.length > 0 && value.synthesis.boundary === "ATTRACTION_ENTRY_ONLY", "M1 attraction output missing");
}

function assertM2(moduleId: string, boundary: boolean, c: { positive: Response; pending: Response }): void {
  const value = boundary ? c.pending.relationship.m2 : c.positive.relationship.m2;
  if (boundary) { check(value.status === "dependency_pending" && value.dependencyFlags.length > 0, `${moduleId} did not expose dependency`); return; }
  const stage = moduleId.slice(3);
  const valid: Record<string, boolean> = {
    GATE: value.gate.evidence.length > 0,
    CORE: value.qualification.spouseStars.length > 0,
    SELF: value.selfPosition.conditions.length > 0,
    FLOW: value.flow.start.length > 0 && value.flow.end.length > 0,
    DUAL: ["single", "parallel"].includes(value.dual.status),
    TEMPO: value.tempo.class !== "pending" && value.tempo.calendarDuration === null,
    SYNTH: value.synthesis.scopeBoundary.length > 0 && value.status === "provisional",
  };
  check(valid[stage], `${moduleId} positive contract missing`);
}

function assertM3(moduleId: string, boundary: boolean, c: { positive: Response; limited: Response }): void {
  const value = boundary ? c.limited.relationship.m3 : c.positive.relationship.m3;
  if (boundary) { check(value.status === "limited" && value.dependencyFlags.includes("M3_HOUR_DEPENDENCY_LIMITED"), `${moduleId} did not degrade with unknown hour`); return; }
  const key = ({ "M3.BASE": "base", "M3.EXPR": "expression", "M3.CARE": "care", "M3.BOUND": "boundary", "M3.CONFLICT": "conflict" } as const)[moduleId as "M3.BASE"];
  const channel = value.channels[key];
  check(value.status === "provisional" && channel.moduleId === moduleId && channel.status === "provisional" && channel.ruleIds.length > 0, `${moduleId} channel output missing`);
}

function assertM4(moduleId: string, boundary: boolean, c: { positive: Response; unconfirmed: Response }): void {
  const value = boundary ? c.unconfirmed.relationship.m4 : c.positive.relationship.m4;
  const key = moduleId.slice(3).toLowerCase() as keyof typeof value.stages;
  const stage = value.stages[key];
  check(Boolean(stage), `${moduleId} stage missing`);
  if (boundary) check(value.riskChains.every((chain) => chain.realityStatus === "unconfirmed") && value.stages.loop.status === "unconfirmed", `${moduleId} fabricated mature risk output`);
  else if (moduleId === "M4.LOOP" || moduleId === "M4.SYNTH") check(value.stages.loop.status === "observed" && value.stages.synth.observedCount > 0, `${moduleId} repeated evidence not synthesized`);
  else check((stage as { status: string }).status === "candidate" || (stage as { status: string }).status === "provisional", `${moduleId} positive candidate missing`);
}

function assertM5(moduleId: string, boundary: boolean, c: { positive: Response; unconfirmed: Response }): void {
  const value = boundary ? c.unconfirmed.relationship.m5 : c.positive.relationship.m5;
  const key = moduleId.slice(3).toLowerCase() as keyof typeof value.stages;
  const stage = value.stages[key];
  check(Boolean(stage), `${moduleId} stage missing`);
  if (boundary) {
    check(value.reportStatus === "limited" && value.fit.grade === "FG1", `${moduleId} single-chart boundary exceeded evidence`);
    if (["M5.PARTNER", "M5.EXCHANGE", "M5.BOUND", "M5.REPAIR", "M5.RHYTHM"].includes(moduleId)) check((stage as { status: string }).status === "not_assessed", `${moduleId} fabricated reality evidence`);
  } else {
    check(value.reportStatus === "complete" && value.fit.grade === "FG4", `${moduleId} positive synthesis incomplete`);
    if (["M5.PARTNER", "M5.EXCHANGE", "M5.BOUND", "M5.REPAIR", "M5.RHYTHM"].includes(moduleId)) check((stage as { status: string }).status === "provisional", `${moduleId} did not consume reality evidence`);
    if (moduleId === "M5.GAP") check(value.stages.gap.status === "clear", "M5.GAP retained false gaps");
    if (moduleId === "M5.SYNTH") check(value.stages.synth.grade === "FG4" && value.stages.synth.assessment === "AF07", "M5.SYNTH final adjudication missing");
  }
}

function command(overrides: Partial<AnalyzeProfileCommand> = {}, unknownHour = false): AnalyzeProfileCommand { return { analysisMode: "test", subject: { inputMode: "four_pillars_provided", subjectId: unknownHour ? "UP-LIMITED" : "UP-EXACT", fourPillars: { year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: unknownHour ? null : { stem: "丙", branch: "午" } }, birthTimeStatus: unknownHour ? "unknown" : "exact", timezone: "Asia/Shanghai", dataQuality: unknownHour ? "medium" : "high", syntheticFixture: true }, requestedSections: ["m0", "m1", "m2", "m3", "m4", "m5"], roleBasis: "female_traditional", relationshipMode: "single_chart_relationship_profile", ...overrides }; }
function gates(): NonNullable<AnalyzeProfileCommand["gateAssessments"]> { return (["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"] as const).map((id) => ({ id, status: "pass", evidenceIds: [`event-${id}`] })); }
function repeatedObservations(): NonNullable<AnalyzeProfileCommand["observations"]> { return [{ id: "up-o1", chainId: "M4-C01", source: "self", context: "steady", direction: "supports" }, { id: "up-o2", chainId: "M4-C01", source: "partner", context: "pressure", direction: "supports" }]; }
function success(result: ReturnType<typeof analyzeProfile>): Response { if (!result.ok) throw new Error(result.issues.map((x) => x.code).join(",")); return result.response; }
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function record(testId: string, passed: boolean, actualSummary: string, startedAt: number): MatrixAssertionExecution { return Object.freeze({ testId, passed, actualSummary, durationMs: performance.now() - startedAt }); }
