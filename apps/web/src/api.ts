import type { AnalysisResponse, ApiErrorBody, HealthResponse } from "./types";

type JsonRecord = Record<string, unknown>;
const useBrowserRuntime = import.meta.env.VITE_ANALYSIS_RUNTIME === "browser";

export class ApiError extends Error {
  readonly status: number;
  readonly issues: readonly { code: string; message: string; jsonPointer?: string }[];
  constructor(status: number, body: ApiErrorBody) {
    const issues = body.issues ?? [];
    super(issues.map((issue) => issue.message).join("；") || `请求失败（HTTP ${status}）`);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  if (useBrowserRuntime) {
    const { fetchBrowserHealth } = await import("./browser-runtime");
    return parseHealthResponse(await fetchBrowserHealth(signal));
  }
  const response = await fetch("/health", { headers: { accept: "application/json" }, ...(signal ? { signal } : {}) });
  if (!response.ok) throw new ApiError(response.status, await safeJson(response));
  return parseHealthResponse(await safeSuccessJson(response));
}

export async function analyzeRelationship(endpoint: "/v1/relationship/profile" | "/v1/relationship/evaluate", payload: unknown, signal?: AbortSignal): Promise<AnalysisResponse> {
  if (useBrowserRuntime) {
    const { analyzeRelationshipInBrowser } = await import("./browser-runtime");
    const result = await analyzeRelationshipInBrowser(endpoint, payload, signal);
    if (!result.ok) throw new ApiError(result.status, result.body);
    return parseAnalysisResponse(result.body);
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new ApiError(response.status, await safeJson(response));
  return parseAnalysisResponse(await safeSuccessJson(response));
}

export function parseHealthResponse(value: unknown): HealthResponse {
  const health = record(value);
  const catalog = health && record(health.catalog);
  if (
    !health || health.status !== "ready" || !catalog
    || !isString(catalog.rulesetDigest)
    || !isNonNegativeInteger(catalog.loadedRecords)
    || !isNonNegativeInteger(catalog.compiledRecords)
    || !isStringArray(catalog.activeModules)
  ) {
    throw responseSchemaError("健康检查响应不符合前端契约");
  }
  return value as HealthResponse;
}

export function parseAnalysisResponse(value: unknown): AnalysisResponse {
  const response = record(value);
  if (!response || !hasStrings(response, ["requestId", "generatedAt", "rulesetDigest"]) || !isStringArray(response.ruleTrace) || !isStringArray(response.sourceIds)) {
    throw responseSchemaError("分析响应缺少顶层追踪字段");
  }

  const m0 = record(response.m0);
  if (!m0 || !isOneOf(m0.status, ["complete", "limited"]) || !isResultFieldMap(m0.fields) || !isStringArray(m0.dependencyFlags)) {
    throw responseSchemaError("分析响应的 M0 字段无效");
  }

  const relationship = record(response.relationship);
  const m1 = relationship && record(relationship.m1);
  const m2 = relationship && record(relationship.m2);
  const m3 = relationship && record(relationship.m3);
  const m4 = relationship && record(relationship.m4);
  const m5 = relationship && record(relationship.m5);
  const supplement = relationship && record(relationship.structuralSupplement);
  if (
    !relationship || !m1 || !m2 || !m3 || !m4 || !m5 || !supplement
    || !isOneOf(relationship.status, ["provisional", "dependency_pending"])
    || !isOneOf(relationship.roleBasis, ["female_traditional", "male_traditional", "unspecified"])
    || !isStringArray(relationship.dependencyFlags) || !isStringArray(relationship.ruleTrace)
    || !isM1(m1) || !isM2(m2) || !isM3(m3) || !isM4(m4) || !isM5(m5)
    || typeof supplement.available !== "boolean"
    || supplement.scope !== "structural_auxiliary_only"
    || supplement.replacesRealityEvidence !== false
    || supplement.replacesRealityGates !== false
    || !(supplement.fields === null || isResultFieldMap(supplement.fields))
  ) {
    throw responseSchemaError("分析响应的关系模块字段无效");
  }

  const report = record(response.report);
  const trace = report && record(report.trace);
  if (
    !report || !trace
    || !isOneOf(report.reportStatus, ["complete", "limited", "stop"])
    || !isOneOf(report.safetyStatus, ["standard", "safety_stop", "insufficient_data", "core_gate_stop"])
    || !isOneOf(report.evidenceGrade, ["FG0", "FG1", "FG2", "FG3", "FG4"])
    || !isOneOf(report.assessment, ["AF01", "AF02", "AF03", "AF04", "AF05", "AF06", "AF07", "AF08", "AF09"])
    || !isResultFieldMap(report.fields)
    || !isArrayOf(report.sections, isReportSection)
    || !isArrayOf(report.realityGates, isRealityGate)
    || !isArrayOf(report.observationPlan, isObservation)
    || !isArrayOf(report.boundaries, isBoundary)
    || !isStringArray(trace.ruleIds) || !isStringArray(trace.sourceIds) || !isStringArray(trace.eventIds)
  ) {
    throw responseSchemaError("分析响应的报告字段无效");
  }

  const fit = record(m5.fit);
  if (
    !fit
    || m5.reportStatus !== report.reportStatus
    || m5.safetyStatus !== report.safetyStatus
    || fit.grade !== report.evidenceGrade
    || fit.assessment !== report.assessment
    || (m5.realityGates as unknown[]).length !== 8
    || (report.realityGates as unknown[]).length !== 8
    || (report.sections as unknown[]).length === 0
  ) {
    throw responseSchemaError("分析模块与发布报告互相矛盾");
  }
  if (report.safetyStatus === "safety_stop" && (report.reportStatus !== "stop" || report.evidenceGrade !== "FG0" || report.assessment !== "AF09" || report.sections.some((section) => record(section)?.id !== "safety"))) {
    throw responseSchemaError("安全停止响应仍包含普通分析内容");
  }
  return value as AnalysisResponse;
}

async function safeJson(response: Response): Promise<ApiErrorBody> {
  try { return await response.json() as ApiErrorBody; }
  catch { return { issues: [{ code: "E_HTTP", message: `服务返回了无法读取的内容（HTTP ${response.status}）` }] }; }
}

async function safeSuccessJson(response: Response): Promise<unknown> {
  try { return await response.json() as unknown; }
  catch { throw responseSchemaError("服务返回了无法读取的成功响应"); }
}

function responseSchemaError(message: string): ApiError {
  return new ApiError(502, { issues: [{ code: "E_RESPONSE_SCHEMA", message }] });
}

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
}

function hasStrings(value: JsonRecord, keys: readonly string[]): boolean {
  return keys.every((key) => isString(value[key]));
}

function isString(value: unknown): value is string { return typeof value === "string"; }
function isNonNegativeInteger(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0; }
function isStringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(isString); }
function isOneOf<const T extends readonly unknown[]>(value: unknown, values: T): value is T[number] { return values.some((candidate) => candidate === value); }
function isArrayOf(value: unknown, predicate: (item: unknown) => boolean): value is unknown[] { return Array.isArray(value) && value.every(predicate); }

function isResultItem(value: unknown): boolean {
  const item = record(value);
  return Boolean(item && isString(item.status) && isString(item.confidence) && isStringArray(item.conditions) && isStringArray(item.ruleIds) && "value" in item);
}

function isResultFieldMap(value: unknown): value is JsonRecord {
  const fields = record(value);
  return Boolean(fields && Object.values(fields).every(isResultItem));
}

function isM1(value: JsonRecord): boolean {
  const synthesis = record(value.synthesis);
  return isOneOf(value.status, ["provisional", "dependency_pending"])
    && Array.isArray(value.prototypes)
    && Boolean(synthesis && isStringArray(synthesis.primarySignals) && isStringArray(synthesis.statements));
}

function isM2(value: JsonRecord): boolean {
  const gate = record(value.gate); const selfPosition = record(value.selfPosition); const tempo = record(value.tempo); const synthesis = record(value.synthesis);
  return isOneOf(value.status, ["provisional", "dependency_pending"])
    && Boolean(gate && isString(gate.dayBranchTenGod) && isStringArray(gate.themes) && isStringArray(gate.evidence))
    && Boolean(selfPosition && isString(selfPosition.class))
    && Boolean(tempo && isString(tempo.class) && isNonNegativeInteger(tempo.evidenceRounds))
    && Boolean(synthesis && isStringArray(synthesis.summary) && isStringArray(synthesis.scopeBoundary));
}

function isM3(value: JsonRecord): boolean {
  const state = record(value.state); const synthesis = record(value.synthesis); const repair = record(value.repair);
  return isOneOf(value.status, ["provisional", "limited"])
    && Boolean(state && isString(state.activeState) && isStringArray(state.modifiers))
    && Boolean(synthesis && isStringArray(synthesis.primaryChannels) && isStringArray(synthesis.statements))
    && Boolean(repair && isString(repair.trigger) && isStringArray(repair.steps) && isStringArray(repair.stopConditions))
    && isStringArray(value.boundaries);
}

function isM4(value: JsonRecord): boolean {
  return value.status === "provisional" && isArrayOf(value.riskChains, (candidate) => {
    const chain = record(candidate); const repair = chain && record(chain.repair); const buffer = chain && record(chain.buffer);
    return Boolean(chain && hasStrings(chain, ["id", "structuralCandidate", "realityStatus"]) && isStringArray(chain.evidenceIds) && repair && isStringArray(repair.actions) && buffer && isStringArray(buffer.conditions));
  }) && isStringArray(value.boundaries);
}

function isM5(value: JsonRecord): boolean {
  const fit = record(value.fit);
  return isString(value.mode)
    && isOneOf(value.reportStatus, ["complete", "limited", "stop"])
    && isOneOf(value.safetyStatus, ["standard", "safety_stop", "insufficient_data", "core_gate_stop"])
    && isArrayOf(value.realityGates, isRealityGate)
    && isArrayOf(value.crossStateEvidence, isCrossStateEvidence)
    && isArrayOf(value.observationPlan, isObservation)
    && Boolean(fit && isOneOf(fit.grade, ["FG0", "FG1", "FG2", "FG3", "FG4"]) && isOneOf(fit.assessment, ["AF01", "AF02", "AF03", "AF04", "AF05", "AF06", "AF07", "AF08", "AF09"]) && isStringArray(fit.residualRisks) && isStringArray(fit.decisionCodes) && fit.isSuccessProbability === false)
    && isStringArray(value.boundaries);
}

function isCrossStateEvidence(value: unknown): boolean {
  const evidence = record(value);
  return Boolean(evidence
    && isOneOf(evidence.state, ["steady", "pressure", "repair", "turningPoint", "counterevidenceReviewed"])
    && isString(evidence.note)
    && evidence.note.trim().length > 0
    && isStringArray(evidence.evidenceIds)
    && evidence.evidenceIds.length > 0);
}

function isRealityGate(value: unknown): boolean {
  const gate = record(value);
  return Boolean(gate && isOneOf(gate.id, ["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"]) && isString(gate.label) && isOneOf(gate.status, ["pass", "conditional", "fail", "unknown", "not_assessed"]) && isStringArray(gate.evidenceIds) && (gate.note === undefined || isString(gate.note)));
}

function isObservation(value: unknown): boolean {
  const observation = record(value);
  return Boolean(observation && isString(observation.gateId) && isString(observation.observe) && observation.directive === false);
}

function isReportSection(value: unknown): boolean {
  const section = record(value);
  return Boolean(section && hasStrings(section, ["id", "title", "body"]));
}

function isBoundary(value: unknown): boolean {
  const boundary = record(value);
  return Boolean(boundary && hasStrings(boundary, ["code", "text"]) && boundary.hard === true);
}
