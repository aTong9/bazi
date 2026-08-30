import { nextTick, reactive } from "vue";
import { describe, expect, it } from "vitest";

import { mountComponent } from "@/test/mount-component";
import type { CrossStateDraft, RealityGateDraft } from "@/types";
import RealityGatePanel from "./RealityGatePanel.vue";

describe("RealityGatePanel", () => {
  it("makes a discoverable factual basis mandatory for non-neutral gate states", async () => {
    const mounted = mountPanel();
    const status = mounted.host.querySelector<HTMLSelectElement>("#gate-RG01")!;
    status.value = "pass";
    status.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();

    const note = mounted.host.querySelector<HTMLInputElement>('[aria-label="安全、同意与尊重的事实依据"]')!;
    const help = mounted.host.querySelector<HTMLElement>("#gate-RG01-help")!;
    expect(note.required).toBe(true);
    expect(note.getAttribute("aria-invalid")).toBe("true");
    expect(note.getAttribute("aria-describedby")).toBe(help.id);
    expect(help.textContent).toContain("必须填写具体事实依据");
    mounted.unmount();
  });

  it("requires an auditable note whenever a cross-state is checked", async () => {
    const mounted = mountPanel();
    const checkbox = mounted.host.querySelector<HTMLInputElement>('[id="cross-pressure"]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();

    const evidence = mounted.host.querySelector<HTMLInputElement>("#cross-pressure-evidence")!;
    expect(evidence.required).toBe(true);
    expect(evidence.getAttribute("aria-invalid")).toBe("true");
    expect(evidence.labels?.[0]?.textContent).toContain("事实依据（必填）");
    mounted.unmount();
  });
});

function mountPanel() {
  const gates = reactive<RealityGateDraft[]>([{ id: "RG01", label: "安全、同意与尊重", status: "not_assessed", note: "" }]);
  const crossState = reactive<CrossStateDraft>({
    steady: false, pressure: false, repair: false, turningPoint: false, counterevidenceReviewed: false,
    evidence: { steady: "", pressure: "", repair: "", turningPoint: "", counterevidenceReviewed: "" },
  });
  return mountComponent(RealityGatePanel, { gates, crossState });
}
