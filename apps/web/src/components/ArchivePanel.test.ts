import { nextTick } from "vue";
import { describe, expect, it } from "vitest";

import { makeAnalysisResponse } from "@/test/analysis-fixture";
import { mountComponent } from "@/test/mount-component";
import type { AnalysisArchive } from "@/types";
import ArchivePanel from "./ArchivePanel.vue";

describe("ArchivePanel", () => {
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
