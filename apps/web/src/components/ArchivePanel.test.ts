import { defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import { makeAnalysisResponse } from "@/test/analysis-fixture";
import { mountComponent } from "@/test/mount-component";
import type { AnalysisArchive } from "@/types";
import ArchivePanel from "./ArchivePanel.vue";

afterEach(() => document.body.replaceChildren());

describe("ArchivePanel", () => {
  it("traps keyboard focus and restores the opening control after Escape", async () => {
    const archive = makeArchive();
    const Wrapper = defineComponent({
      setup() {
        const open = ref(false);
        return () => h("div", [
          h("button", { id: "archive-trigger", onClick: () => { open.value = true; } }, "看盘档案"),
          h(ArchivePanel, { open: open.value, archives: [archive], onClose: () => { open.value = false; } }),
        ]);
      },
    });
    const mounted = mountComponent(Wrapper, {});
    const trigger = mounted.host.querySelector<HTMLButtonElement>("#archive-trigger")!;
    trigger.focus();
    trigger.click();
    await nextTick();
    await nextTick();

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    expect(document.activeElement).toBe(buttons[0]);
    buttons.at(-1)!.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons[0]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons.at(-1));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await nextTick();
    await nextTick();
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    mounted.unmount();
  });

  it("requires a cancellable second action before deleting an archive", async () => {
    const deleted: string[] = [];
    const archive = makeArchive();
    const mounted = mountComponent(ArchivePanel, {
      open: true,
      archives: [archive],
      onDelete: (id: string) => deleted.push(id),
    });
    await nextTick();

    findButton("删除").click();
    await nextTick();
    expect(deleted).toEqual([]);
    expect(findButton("确认删除")).not.toBeNull();

    findButton("取消").click();
    await nextTick();
    expect(deleted).toEqual([]);
    findButton("删除").click();
    await nextTick();
    findButton("确认删除").click();
    expect(deleted).toEqual([archive.id]);
    mounted.unmount();
  });
});

function findButton(label: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label);
  if (!button) throw new Error(`button not found: ${label}`);
  return button;
}

function makeArchive(): AnalysisArchive {
  const result = makeAnalysisResponse();
  return {
    id: "archive-test",
    title: "小林 · 甲寅日 · 关系画像",
    savedAt: "2026-08-30T01:00:00.000Z",
    rulesetDigest: result.rulesetDigest,
    workspace: {
      analysisMode: "profile",
      roleBasis: "female_traditional",
      primarySubject: { subjectId: "小林", year: "庚申", month: "己丑", day: "甲寅", hour: "庚午", birthTimeStatus: "exact", dataQuality: "high" },
      secondarySubject: { subjectId: "另一方", year: "己巳", month: "丙寅", day: "乙卯", hour: "丙子", birthTimeStatus: "exact", dataQuality: "high" },
      hasSecondarySubject: false,
      gates: [],
      crossState: { steady: false, pressure: false, repair: false, turningPoint: false, counterevidenceReviewed: false, evidence: { steady: "", pressure: "", repair: "", turningPoint: "", counterevidenceReviewed: "" } },
      observations: [],
      result,
    },
  };
}
