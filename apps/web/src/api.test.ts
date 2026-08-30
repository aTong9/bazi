import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeRelationship, ApiError, fetchHealth, parseAnalysisResponse, parseHealthResponse } from "./api";
import { makeAnalysisResponse } from "./test/analysis-fixture";

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

  it("applies guards to successful fetch calls", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "ready", catalog: { rulesetDigest: "digest", loadedRecords: 1, compiledRecords: 1, activeModules: ["M0"] } }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ requestId: "missing-modules" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchHealth()).resolves.toMatchObject({ status: "ready" });
    await expect(analyzeRelationship("/v1/relationship/profile", {})).rejects.toMatchObject({ status: 502, issues: [{ code: "E_RESPONSE_SCHEMA" }] });
  });
});
