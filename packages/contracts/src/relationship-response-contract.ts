import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { validateAnalysisReport } from "./analysis-report-contract.js";
import { reportStatusLabel } from "../../reporting/src/status-labels.js";
import { formatProfileLayers } from "../../reporting/src/profile-layers.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const reportSchema = JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/analysis-report.schema.json", import.meta.url)), "utf8")) as object;
ajv.addSchema(reportSchema);
const validate = ajv.compile(JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/relationship-analysis-response.schema.json", import.meta.url)), "utf8")) as object);

export function validateRelationshipResponse(value: unknown, expected?: { readonly rulesetDigest?: string; readonly integrationVersion?: string }): readonly string[] {
  if (!validate(value)) return Object.freeze((validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`));
  const response = value as { requestId: string; rulesetDigest: string; versionManifest: { integrationVersion: string }; m0: { fields: Record<string, unknown> }; relationship: { status: string; dependencyFlags: string[]; ruleTrace: string[]; m1: { synthesis: { statements: string[] } }; m2: { synthesis: { summary: string[] } }; m3: { status?: string; repair?: unknown; state?: unknown; synthesis: { statements: string[] } }; m4: { riskChains: Array<{ id: string; structuralCandidate: string; realityStatus: string }> }; m5: { mode: string; reportStatus: string; safetyStatus: string; fit: { grade: string; assessment: string }; realityGates: Array<{ id: string; label: string; status: string; evidenceIds: string[] }>; crossStateEvidence: Array<{ evidenceIds: string[] }>; observationPlan?: unknown[]; ruleTrace: string[] } }; report: { analysisRunId: string; rulesetDigest: string; reportStatus: string; safetyStatus: string; assessment: string; fields: Record<string, unknown>; sections: unknown[]; realityGates: unknown[]; observationPlan: unknown[]; boundaries: unknown[]; trace: { ruleIds: string[]; sourceIds: string[]; eventIds: string[] }; logs: { dedup: string[]; conflicts: string[]; discardedCandidates: string[]; decisions: Array<{ decisionId: string; code: string; outcome: string; ruleIds: string[] }> } }; ruleTrace: string[]; sourceIds: string[] };
  const errors = [...validateAnalysisReport(response.report)];
  if (expected?.rulesetDigest && response.rulesetDigest !== expected.rulesetDigest) errors.push("rulesetDigest does not match the fixed snapshot");
  if (expected?.integrationVersion && response.versionManifest.integrationVersion !== expected.integrationVersion) errors.push("integrationVersion does not match the fixed snapshot");
  if (Object.keys(response.m0.fields).length !== 45) errors.push("M0 must publish exactly 45 fields");
  if (["limited", "dependency_pending"].includes(response.relationship.status) && response.relationship.dependencyFlags.length === 0) errors.push(`${response.relationship.status} requires dependency flags`);
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
  const expectedLogs = {
    dedup: expectedTrace.eventIds.map((id) => `${id} counted once`),
    conflicts: response.report.assessment === "AF08" ? ["CORE_REALITY_GATE_CAP_FG2"] : response.report.assessment === "AF09" ? ["SAFETY_STOP_OVERRIDES_ORDINARY_FIT"] : [],
    discardedCandidates: response.relationship.m4.riskChains.filter((chain) => chain.realityStatus === "unconfirmed").map((chain) => `${chain.id}:unconfirmed_harm`),
    decisions: response.report.assessment === "AF08"
      ? [{ decisionId: `${response.requestId}:core-gate`, code: "CORE_REALITY_GATE_CAP_FG2", outcome: "CAP_FG2", ruleIds: m5.ruleTrace }]
      : response.report.assessment === "AF09" ? [{ decisionId: `${response.requestId}:safety-stop`, code: "SAFETY_STOP_OVERRIDES_ORDINARY_FIT", outcome: "STOP", ruleIds: m5.ruleTrace }] : [],
  };
  const expectedBoundaries = [
    { code: "NOT_FATE", hard: true, text: "本报告不是命定结果。" },
    { code: "NOT_SUCCESS_PROBABILITY", hard: true, text: "FG 是证据发布等级，不是关系成功概率。" },
    { code: "NOT_DIRECTIVE", hard: true, text: "报告不替代当事人的同意、安全判断和现实决定。" },
    { code: "STRUCTURE_NOT_HARM", hard: true, text: "结构风险候选不等于现实伤害事实。" },
  ];
  if (JSON.stringify(response.report.logs) !== JSON.stringify(expectedLogs)) errors.push("report logs must project current adjudication");
  if (JSON.stringify(response.report.boundaries) !== JSON.stringify(expectedBoundaries)) errors.push("report boundaries must retain all canonical safety limits");
  const expectedSections = response.report.reportStatus === "stop" || response.report.safetyStatus === "safety_stop"
    ? [{ id: "safety", title: "安全与边界", body: "现实资料触发安全停止；请优先关注安全、同意与现实支持。" }]
    : [
        { id: "profile", title: "关系结构候选", body: formatProfileLayers({ attraction: response.relationship.m1.synthesis.statements, selection: response.relationship.m2.synthesis.summary, interaction: response.relationship.m3.synthesis.statements }).join("\n") || "当前没有足够资料形成结构候选。" },
        { id: "risk", title: "风险与现实核验", body: response.relationship.m4.riskChains.map((chain) => `${chain.structuralCandidate}（${reportStatusLabel(chain.realityStatus)}）`).join("；") || "暂无已确认风险模式。" },
        { id: "reality", title: "现实闸门", body: m5.realityGates.map((gate) => `${gate.id} ${gate.label}：${reportStatusLabel(gate.status)}`).join("；") },
      ];
  if (JSON.stringify(response.report.sections) !== JSON.stringify(expectedSections)) errors.push("report sections must project M1, M2, M3, M4, and M5 unchanged");
  if (response.ruleTrace.length === 0) errors.push("published analysis requires rule trace");
  return Object.freeze(errors);
}

function unique(values: readonly string[]): string[] { return [...new Set(values)].filter(Boolean); }
