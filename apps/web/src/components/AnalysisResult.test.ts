import { describe, expect, it } from "vitest";

import { makeAnalysisResponse } from "@/test/analysis-fixture";
import { mountComponent } from "@/test/mount-component";
import AnalysisResult from "./AnalysisResult.vue";
import ModuleRail from "./ModuleRail.vue";

describe("AnalysisResult", () => {
  it("publishes only the safety section when safety_stop is active", () => {
    const mounted = mountComponent(AnalysisResult, { result: makeAnalysisResponse({ safetyStop: true, includeOrdinarySectionDuringStop: true }) });

    expect(mounted.host.querySelector(".safety-only")).not.toBeNull();
    expect(mounted.host.textContent).toContain("现实资料触发安全停止");
    expect(mounted.host.textContent).not.toContain("ORDINARY-CONTENT-MUST-STAY-HIDDEN");
    expect(mounted.host.querySelector(".module-rail")).toBeNull();
    expect(mounted.host.querySelector("#result-m0")).toBeNull();
    expect(mounted.host.querySelector(".result-mast h2")?.getAttribute("tabindex")).toBe("-1");
    mounted.unmount();
  });

  it("keeps candidate, conditional, unknown, and not-assessed states distinct", () => {
    const mounted = mountComponent(AnalysisResult, {
      result: makeAnalysisResponse({ gateStatuses: { RG01: "unknown", RG02: "not_assessed", RG03: "conditional" } }),
    });

    expect(mounted.host.querySelector('[data-status="candidate"]')?.textContent).toContain("结构候选");
    expect(mounted.host.querySelector('.result-gate[data-status="unknown"]')?.textContent).toContain("未知");
    expect(mounted.host.querySelector('.result-gate[data-status="not_assessed"]')?.textContent).toContain("未评估");
    expect(mounted.host.querySelector('.result-gate[data-status="conditional"]')?.textContent).toContain("有条件");
    mounted.unmount();
  });

  it("renders an explicit fallback when a synthesis list is empty", () => {
    const mounted = mountComponent(AnalysisResult, { result: makeAnalysisResponse() });
    expect(mounted.host.querySelector("#result-m1 .statement-list")?.textContent).toContain("当前没有形成稳定陈述");
    mounted.unmount();
  });

  it("explains why an unknown-hour result is limited without exposing dependency codes", () => {
    const result = makeAnalysisResponse();
    result.m0.dependencyFlags = ["HOUR_UNKNOWN"];
    result.relationship.dependencyFlags = ["M3_HOUR_DEPENDENCY_LIMITED"];
    const mounted = mountComponent(AnalysisResult, { result });

    expect(mounted.host.querySelector(".result-mast .inline-notice")?.textContent).toContain("出生时辰未知");
    expect(mounted.host.querySelector<HTMLAnchorElement>('.result-mast .inline-notice a')?.getAttribute("href")).toBe("#primary-time-status");
    expect(mounted.host.querySelector(".result-mast")?.textContent).not.toMatch(/HOUR_UNKNOWN|M3_HOUR/u);
    mounted.unmount();
  });

  it("explains a data-quality limitation without exposing its dependency code", () => {
    const result = makeAnalysisResponse();
    result.m0.dependencyFlags = ["DATA_QUALITY_UNKNOWN"];
    const mounted = mountComponent(AnalysisResult, { result });

    expect(mounted.host.querySelector(".result-mast .inline-notice")?.textContent).toContain("输入资料尚未标记为已核对");
    expect(mounted.host.querySelector<HTMLAnchorElement>('.result-mast .inline-notice a')?.getAttribute("href")).toBe("#primary-quality");
    expect(mounted.host.querySelector(".result-mast")?.textContent).not.toContain("DATA_QUALITY_UNKNOWN");
    mounted.unmount();
  });

  it("keeps internal assessment and theme codes out of the ordinary reading surface", () => {
    const result = makeAnalysisResponse();
    result.relationship.m2.gate.themes = ["G07 平等尊重", "G13 选择自主度"];
    const mounted = mountComponent(AnalysisResult, { result, analysisMode: "profile" });

    expect(mounted.host.querySelector(".result-mast .eyebrow")?.textContent).toContain("关系画像");
    expect(mounted.host.querySelector("#result-m2 .two-column-copy")?.textContent).toContain("平等尊重；选择自主度");
    expect(mounted.host.querySelector("#result-m2 .two-column-copy")?.textContent).not.toMatch(/G07|G13/u);
    expect(mounted.host.querySelector(".technical-trace")?.textContent).toContain(`裁决状态${result.report.assessment}`);
    mounted.unmount();
  });

  it("shows the reality facts used by the current adjudication", () => {
    const result = makeAnalysisResponse();
    result.relationship.m5.realityGates[0]!.note = "双方能自由表达并撤回同意";
    result.relationship.m5.crossStateEvidence = [{ state: "pressure", note: "高压期仍能暂停并协商", evidenceIds: ["event-pressure"] }];
    const mounted = mountComponent(AnalysisResult, { result, analysisMode: "evaluate" });

    expect(mounted.host.querySelector('.result-gate[data-status="pass"] p')?.textContent).toBe("双方能自由表达并撤回同意");
    expect(mounted.host.querySelector(".cross-state-results")?.textContent).toContain("压力状态");
    expect(mounted.host.querySelector(".cross-state-results")?.textContent).toContain("高压期仍能暂停并协商");
    mounted.unmount();
  });

  it("shows only M4 observations already applied to the current result", () => {
    const result = makeAnalysisResponse();
    const observations = [{
      chainId: "M4-C01", slot: 0 as const, source: "joint_record" as const, context: "两次争执后都能在约定时间复盘", direction: "supports" as const,
      basisFingerprint: "input", candidateFingerprint: "candidate", basisRequestId: result.requestId,
    }];
    const applied = mountComponent(AnalysisResult, { result, observations });
    expect(applied.host.querySelector(".risk-evidence")?.textContent).toContain("双方共同记录 · 支持候选");
    expect(applied.host.querySelector(".risk-evidence")?.textContent).toContain("两次争执后都能在约定时间复盘");
    applied.unmount();

    const stale = mountComponent(AnalysisResult, { result, observations, actionsDisabled: true });
    expect(stale.host.querySelector(".risk-evidence")).toBeNull();
    stale.unmount();
  });

  it("explains the current M5 grade using user-facing adjudication reasons", () => {
    const result = makeAnalysisResponse();
    result.relationship.m5.fit.residualRisks = ["CORE_REALITY_GATE_UNKNOWN"];
    result.relationship.m5.fit.decisionCodes = ["EVIDENCE_CAP_FG2"];
    const mounted = mountComponent(AnalysisResult, { result });

    expect(mounted.host.querySelector(".adjudication-reasons")?.textContent).toContain("仍有核心现实闸门缺少可核验事实");
    expect(mounted.host.querySelector(".adjudication-reasons")?.textContent).toContain("证据等级暂时不高于 FG2");
    mounted.unmount();
  });

  it("shows the reviewed input summary and emits a print request", () => {
    let printRequests = 0;
    const result = makeAnalysisResponse();
    const mounted = mountComponent(AnalysisResult, {
      result,
      analysisMode: "evaluate",
      primarySubject: {
        subjectId: "小林", year: "丙寅", month: "癸巳", day: "癸酉", hour: "戊午", birthTimeStatus: "exact", dataQuality: "high",
        birthInput: {
          method: "solar_utc8_assist", solarLocalDateTime: "1986-05-29T12:00", resolutionStatus: "resolved", resolvedPillars: "丙寅 癸巳 癸酉 戊午",
          adapter: { id: "lunar-typescript-standard-time", version: "1.8.6", civilTimeBasis: "UTC+08:00", trueSolarTimeApplied: false },
        },
      },
      onPrint: () => { printRequests += 1; },
    });
    expect(mounted.host.querySelector(".result-context")?.textContent).toContain("丙寅 · 癸巳 · 癸酉 · 戊午");
    expect(mounted.host.querySelector(".result-context")?.textContent).toContain("小林");
    expect(mounted.host.querySelector(".result-context")?.textContent).toContain("现实评估");
    expect(mounted.host.querySelector(".result-context")?.textContent).toContain("1986-05-29 12:00 · UTC+08:00 · lunar-typescript-standard-time 1.8.6");
    expect(mounted.host.querySelector(".result-context")?.textContent).toContain(result.requestId);
    expect(mounted.host.querySelector(".result-context")?.textContent).toContain(result.rulesetDigest);
    [...mounted.host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("打印 / 存 PDF"))!.click();
    expect(printRequests).toBe(1);
    mounted.unmount();
  });

  it("keeps both charts' complete M0 evidence independently readable", () => {
    const result = makeAnalysisResponse();
    result.relationship.structuralSupplement.available = true;
    result.relationship.structuralSupplement.status = "complete";
    result.relationship.structuralSupplement.fields = structuredClone(result.m0.fields);
    const mounted = mountComponent(AnalysisResult, { result, hasSecondarySubject: true });

    const summaries = [...mounted.host.querySelectorAll(".m0-evidence > summary")].map((summary) => summary.textContent);
    expect(summaries).toEqual(["查看完整 M0 字段证据（45 项）", "查看另一方完整 M0 字段证据（45 项）"]);
    mounted.unmount();
  });

  it("keeps the secondary chart's own data-quality limit visible", () => {
    const result = makeAnalysisResponse();
    result.relationship.structuralSupplement = {
      ...result.relationship.structuralSupplement,
      available: true,
      status: "limited",
      dependencyFlags: ["DATA_QUALITY_LOW", "HOUR_APPROXIMATE"],
      fields: structuredClone(result.m0.fields),
    };
    const mounted = mountComponent(AnalysisResult, { result, hasSecondarySubject: true });

    expect(mounted.host.querySelector(".structural-supplement")?.textContent).toContain("受限");
    expect(mounted.host.querySelector(".structural-supplement .inline-notice")?.textContent).toContain("另一方资料尚未标记为已核对");
    expect(mounted.host.querySelector(".structural-supplement")?.textContent).toContain("另一方出生时辰不准确");
    expect(mounted.host.querySelector(".structural-supplement")?.textContent).not.toContain("DATA_QUALITY_LOW");
    mounted.unmount();
  });
});

describe("ModuleRail", () => {
  it("uses M5 reportStatus instead of reading a nonexistent status property", () => {
    const mounted = mountComponent(ModuleRail, { result: makeAnalysisResponse() });
    const statuses = [...mounted.host.querySelectorAll(".status-pill")].map((node) => node.getAttribute("data-status"));
    expect(statuses).toEqual(["complete", "provisional", "provisional", "provisional", "provisional", "limited"]);
    mounted.unmount();
  });
});
