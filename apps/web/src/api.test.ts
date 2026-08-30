import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeRelationship, ApiError, fetchHealth, parseAnalysisResponse, parseHealthResponse, parseM0AnalysisResponse } from "./api";
import { makeAnalysisResponse, makeM0AnalysisResponse } from "./test/analysis-fixture";

afterEach(() => vi.unstubAllGlobals());

describe("API response guards", () => {
  it("accepts a valid health response", () => {
    const health = { status: "ready", catalog: { rulesetDigest: "a".repeat(64), loadedRecords: 10, compiledRecords: 9, activeModules: ["M0", "M1"] } };
    expect(parseHealthResponse(health)).toBe(health);
  });

  it("rejects malformed health data as an upstream schema error", () => {
    expect(() => parseHealthResponse({ status: "ready", catalog: { compiledRecords: "9" } })).toThrowError(ApiError);
    try { parseHealthResponse(null); } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(502);
      expect((error as ApiError).issues[0]?.code).toBe("E_RESPONSE_SCHEMA");
    }
  });

  it("accepts the complete browser-facing analysis contract", () => {
    const response = makeAnalysisResponse();
    expect(parseAnalysisResponse(response)).toBe(response);

    response.m0.status = "limited";
    response.m0.dependencyFlags = ["DATA_QUALITY_LOW"];
    response.relationship.status = "limited";
    response.relationship.dependencyFlags = ["DATA_QUALITY_LOW"];
    expect(parseAnalysisResponse(response)).toBe(response);

    response.relationship.dependencyFlags = [];
    expect(() => parseAnalysisResponse(response)).toThrow("关系模块字段无效");
  });

  it("rejects relationship responses missing authoritative runtime metadata", () => {
    const version = makeAnalysisResponse() as unknown as Record<string, unknown>;
    delete version.versionManifest;
    expect(() => parseAnalysisResponse(version)).toThrow("顶层追踪字段");

    const modules = makeAnalysisResponse() as unknown as { m0: Record<string, unknown> };
    delete modules.m0.modules;
    expect(() => parseAnalysisResponse(modules)).toThrow("M0 字段无效");

    const fields = makeAnalysisResponse();
    delete fields.m0.fields.fixture_field_45;
    expect(() => parseAnalysisResponse(fields)).toThrow("M0 字段无效");

    const legacy = makeAnalysisResponse() as unknown as { relationship: Record<string, unknown> };
    delete legacy.relationship.legacyPayloads;
    expect(() => parseAnalysisResponse(legacy)).toThrow("关系模块字段无效");
  });

  it("accepts the standalone M0 response and rejects missing trace metadata", () => {
    expect(parseM0AnalysisResponse(makeM0AnalysisResponse()).m0.status).toBe("complete");
    const malformed = makeM0AnalysisResponse() as unknown as Record<string, unknown>;
    delete malformed.versionManifest;
    expect(() => parseM0AnalysisResponse(malformed)).toThrow("原局结构响应不符合前端契约");
  });

  it("requires both structural supplement non-replacement flags", () => {
    const response = makeAnalysisResponse() as unknown as Record<string, unknown>;
    const relationship = response.relationship as Record<string, unknown>;
    const supplement = relationship.structuralSupplement as Record<string, unknown>;
    delete supplement.replacesRealityGates;
    expect(() => parseAnalysisResponse(response)).toThrow("关系模块字段无效");
  });

  it("requires structural supplement availability to match its fields", () => {
    const response = makeAnalysisResponse();
    response.relationship.structuralSupplement.available = true;
    expect(() => parseAnalysisResponse(response)).toThrow("关系模块字段无效");
  });

  it("requires the auditable cross-state evidence collection in M5", () => {
    const response = makeAnalysisResponse() as unknown as Record<string, unknown>;
    const relationship = response.relationship as Record<string, unknown>;
    const m5 = relationship.m5 as Record<string, unknown>;
    delete m5.crossStateEvidence;
    expect(() => parseAnalysisResponse(response)).toThrow("关系模块字段无效");
  });

  it("rejects ordinary report sections during a safety stop", () => {
    expect(() => parseAnalysisResponse(makeAnalysisResponse({ safetyStop: true, includeOrdinarySectionDuringStop: true }))).toThrow("安全停止响应仍包含普通分析内容");
  });

  it("rejects contradictory module and report publication states", () => {
    const response = makeAnalysisResponse();
    response.report.evidenceGrade = "FG3";
    expect(() => parseAnalysisResponse(response)).toThrow("分析模块与发布报告互相矛盾");
  });

  it("rejects report facts that diverge from their module results", () => {
    const fields = JSON.parse(JSON.stringify(makeAnalysisResponse())) as ReturnType<typeof makeAnalysisResponse>;
    fields.report.fields.day_master_and_season!.value = { dayMaster: "乙" };
    expect(() => parseAnalysisResponse(fields)).toThrow("分析模块与发布报告投影不一致");

    const gates = JSON.parse(JSON.stringify(makeAnalysisResponse())) as ReturnType<typeof makeAnalysisResponse>;
    gates.report.realityGates[0]!.status = "fail";
    expect(() => parseAnalysisResponse(gates)).toThrow("分析模块与发布报告投影不一致");

    const plan = JSON.parse(JSON.stringify(makeAnalysisResponse({ gateStatuses: { RG04: "unknown" } }))) as ReturnType<typeof makeAnalysisResponse>;
    plan.report.observationPlan = [];
    expect(() => parseAnalysisResponse(plan)).toThrow("分析模块与发布报告投影不一致");
  });

  it("binds report provenance and trace to the current analysis", () => {
    const identity = makeAnalysisResponse();
    identity.report.analysisRunId = "another-analysis";
    expect(() => parseAnalysisResponse(identity)).toThrow("报告字段无效");

    const trace = makeAnalysisResponse();
    trace.report.trace.eventIds = [];
    expect(() => parseAnalysisResponse(trace)).toThrow("追踪信息与当前结果不一致");
  });

  it("rejects report prose that diverges from M3, M4, or M5", () => {
    const response = JSON.parse(JSON.stringify(makeAnalysisResponse())) as ReturnType<typeof makeAnalysisResponse>;
    response.report.sections[0]!.body = "被替换的关系结论";
    expect(() => parseAnalysisResponse(response)).toThrow("报告正文与当前模块结果不一致");
  });

  it("binds report governance records to the current analysis", () => {
    const logs = makeAnalysisResponse();
    logs.report.logs.discardedCandidates = [];
    expect(() => parseAnalysisResponse(logs)).toThrow("报告治理记录与当前结果不一致");

    const boundaries = makeAnalysisResponse();
    boundaries.report.boundaries.pop();
    expect(() => parseAnalysisResponse(boundaries)).toThrow("报告治理记录与当前结果不一致");
  });

  it("applies guards to successful fetch calls", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ready", catalog: { rulesetDigest: "digest", loadedRecords: 1, compiledRecords: 1, activeModules: ["M0"] } }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ requestId: "missing-modules" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchHealth()).resolves.toMatchObject({ status: "ready" });
    await expect(analyzeRelationship("/v1/relationship/profile", {})).rejects.toMatchObject({ status: 502, issues: [{ code: "E_RESPONSE_SCHEMA" }] });
  });
});
