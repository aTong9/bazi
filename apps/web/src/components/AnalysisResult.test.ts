import { describe, expect, it } from "vitest";

import { makeAnalysisResponse } from "@/test/analysis-fixture";
import { mountComponent } from "@/test/mount-component";
import AnalysisResult from "./AnalysisResult.vue";
import ModuleRail from "./ModuleRail.vue";

describe("AnalysisResult", () => {
  it("publishes only the safety section when safety_stop is active", () => {
    const mounted = mountComponent(AnalysisResult, { result: makeAnalysisResponse({ safetyStop: true, includeOrdinarySectionDuringStop: true }) });

    expect(mounted.host.querySelector(".safety-only")).not.toBeNull();
    expect(mounted.host.textContent).toContain("现实安全事实优先");
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
});

describe("ModuleRail", () => {
  it("uses M5 reportStatus instead of reading a nonexistent status property", () => {
    const mounted = mountComponent(ModuleRail, { result: makeAnalysisResponse() });
    const statuses = [...mounted.host.querySelectorAll(".status-pill")].map((node) => node.getAttribute("data-status"));
    expect(statuses).toEqual(["complete", "provisional", "provisional", "provisional", "provisional", "limited"]);
    mounted.unmount();
  });
});
