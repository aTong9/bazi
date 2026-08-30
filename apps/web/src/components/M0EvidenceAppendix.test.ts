import { nextTick } from "vue";
import { describe, expect, it } from "vitest";

import { mountComponent } from "@/test/mount-component";
import type { ResultItem } from "@/types";
import M0EvidenceAppendix from "./M0EvidenceAppendix.vue";

describe("M0EvidenceAppendix", () => {
  it("shows values and filters by Chinese field name", async () => {
    const field = (value: unknown): ResultItem => ({ status: "supported", confidence: "medium", value, conditions: [], ruleIds: [] });
    const mounted = mountComponent(M0EvidenceAppendix, { fields: { day_master_strength: field("balanced_candidate"), root_disease: field({ severity: "low" }) } });

    expect(mounted.host.textContent).toContain("查看完整 M0 字段证据（2 项）");
    expect(mounted.host.textContent).toContain("日主旺衰等级");
    expect(mounted.host.querySelector("pre")?.textContent).toContain("balanced_candidate");
    const input = mounted.host.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = "根本主病";
    input.dispatchEvent(new Event("input"));
    await nextTick();
    expect(mounted.host.querySelectorAll(".evidence-item")).toHaveLength(1);
    expect(mounted.host.textContent).toContain('"severity": "low"');
    mounted.unmount();
  });

  it("uses a distinct accessible title for a secondary chart", () => {
    const field: ResultItem = { status: "supported", confidence: "medium", value: "balanced_candidate", conditions: [], ruleIds: [] };
    const mounted = mountComponent(M0EvidenceAppendix, { fields: { day_master_strength: field }, title: "查看另一方完整 M0 字段证据" });

    expect(mounted.host.querySelector("summary")?.textContent).toContain("查看另一方完整 M0 字段证据（1 项）");
    expect(mounted.host.querySelector("input")?.getAttribute("aria-label")).toBe("查看另一方完整 M0 字段证据检索");
    mounted.unmount();
  });
});
