import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { validateAnalysisReport } from "./analysis-report-contract.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const reportSchema = JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/analysis-report.schema.json", import.meta.url)), "utf8")) as object;
ajv.addSchema(reportSchema);
const validate = ajv.compile(JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/relationship-analysis-response.schema.json", import.meta.url)), "utf8")) as object);

export function validateRelationshipResponse(value: unknown, expected?: { readonly rulesetDigest?: string; readonly integrationVersion?: string }): readonly string[] {
  if (!validate(value)) return Object.freeze((validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`));
  const response = value as { requestId: string; rulesetDigest: string; versionManifest: { integrationVersion: string }; m0: { fields: Record<string, unknown> }; relationship: { status: string; dependencyFlags: string[]; ruleTrace: string[]; m3: { status?: string; repair?: unknown; state?: unknown; synthesis?: unknown }; m5: { mode: string; reportStatus: string; safetyStatus: string; fit: { grade: string; assessment: string }; realityGates: Array<{ id: string; label: string; status: string; evidenceIds: string[] }>; crossStateEvidence: Array<{ evidenceIds: string[] }>; observationPlan?: unknown[] } }; report: { analysisRunId: string; rulesetDigest: string; reportStatus: string; safetyStatus: string; fields: Record<string, unknown>; realityGates: unknown[]; observationPlan: unknown[]; trace: { ruleIds: string[]; sourceIds: string[]; eventIds: string[] }; logs?: { decisions?: Array<{ decisionId?: string }> } }; ruleTrace: string[]; sourceIds: string[] };
  const errors = [...validateAnalysisReport(response.report)];
  if (expected?.rulesetDigest && response.rulesetDigest !== expected.rulesetDigest) errors.push("rulesetDigest does not match the fixed snapshot");
  if (expected?.integrationVersion && response.versionManifest.integrationVersion !== expected.integrationVersion) errors.push("integrationVersion does not match the fixed snapshot");
  if (Object.keys(response.m0.fields).length !== 45) errors.push("M0 must publish exactly 45 fields");
  if (response.relationship.status === "dependency_pending" && response.relationship.dependencyFlags.length === 0) errors.push("dependency_pending requires dependency flags");
  if (response.relationship.m3.status === "complete" && (!response.relationship.m3.repair || !response.relationship.m3.state || !response.relationship.m3.synthesis)) errors.push("complete M3 requires repair, state, and synthesis");
  const m5 = response.relationship.m5;
  if (m5.mode === "single_chart_relationship_profile" && ["FG3", "FG4"].includes(m5.fit.grade)) errors.push("single-chart mode cannot publish FG3 or FG4");
  if (new Set(m5.realityGates.map((gate) => gate.id)).size !== 8) errors.push("M5 must publish RG01-RG08 exactly once");
  if (m5.safetyStatus === "safety_stop" && (m5.reportStatus !== "stop" || m5.fit.grade !== "FG0" || m5.fit.assessment !== "AF09")) errors.push("M5 safety stop requires stop/FG0/AF09");
  if ((m5.observationPlan?.length ?? 0) > 3) errors.push("M5 observation plan cannot exceed 3 items");
  const expectedObservationPlan = response.report.safetyStatus === "safety_stop" || response.report.reportStatus === "stop"
    ? []
    : m5.realityGates.filter((gate) => gate.status !== "pass").slice(0, 5).map((gate) => ({ gateId: gate.id, observe: gate.label, directive: false }));
  if (JSON.stringify(response.report.fields) !== JSON.stringify(response.m0.fields)) errors.push("report fields must project M0 fields unchanged");
  if (JSON.stringify(response.report.realityGates) !== JSON.stringify(m5.realityGates)) errors.push("report reality gates must project M5 gates unchanged");
  if (JSON.stringify(response.report.observationPlan) !== JSON.stringify(expectedObservationPlan)) errors.push("report observation plan must project M5 gates");
  if (response.report.analysisRunId !== response.requestId) errors.push("report analysisRunId must match requestId");
  if (response.report.rulesetDigest !== response.rulesetDigest) errors.push("report rulesetDigest must match response rulesetDigest");
  const expectedTrace = {
    ruleIds: unique([...response.ruleTrace, ...response.relationship.ruleTrace]),
    sourceIds: unique([...response.sourceIds, ...response.relationship.ruleTrace]),
    eventIds: unique([...m5.realityGates.flatMap((gate) => gate.evidenceIds), ...m5.crossStateEvidence.flatMap((evidence) => evidence.evidenceIds)]),
  };
  if (JSON.stringify(response.report.trace) !== JSON.stringify(expectedTrace)) errors.push("report trace must match current module and evidence provenance");
  if (response.report.logs?.decisions?.some((decision) => !decision.decisionId)) errors.push("every decision record requires decisionId");
  if (response.ruleTrace.length === 0) errors.push("published analysis requires rule trace");
  return Object.freeze(errors);
}

function unique(values: readonly string[]): string[] { return [...new Set(values)].filter(Boolean); }
