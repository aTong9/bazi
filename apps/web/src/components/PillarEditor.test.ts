import { nextTick } from "vue";
import { describe, expect, it } from "vitest";

import { mountComponent } from "@/test/mount-component";
import type { SubjectDraft } from "@/types";
import PillarEditor from "./PillarEditor.vue";

describe("PillarEditor", () => {
  it("normalizes linked stems immediately for an initial draft", () => {
    const modelValue: SubjectDraft = {
      subjectId: "subject-a",
      year: "庚申",
      month: "癸丑",
      day: "甲寅",
      hour: "丙午",
      birthTimeStatus: "exact",
      dataQuality: "high",
    };
    const emitted: SubjectDraft[] = [];
    const mounted = mountComponent(PillarEditor, {
      modelValue,
      idPrefix: "subject-a",
      title: "主要命盘",
      description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => emitted.push(value),
    });
    expect(emitted[0]).toMatchObject({ month: "己丑", hour: "庚午" });
    mounted.unmount();
  });

  it("fills reviewed pillars from a clear UTC+8 civil datetime", async () => {
    const modelValue: SubjectDraft = {
      subjectId: "subject-a", year: "甲子", month: "丙寅", day: "甲子", hour: "甲子",
      birthTimeStatus: "unknown", dataQuality: "unknown",
    };
    const emitted: SubjectDraft[] = [];
    const mounted = mountComponent(PillarEditor, {
      modelValue, idPrefix: "subject-a", title: "主要命盘", description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => emitted.push(value),
    });
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("公历排盘辅助"))!.click();
    await nextTick();
    const input = mounted.host.querySelector<HTMLInputElement>("input[type='datetime-local']")!;
    input.value = "1986-05-29T12:00";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("计算并填入"))!.click();
    await nextTick();
    expect(emitted.at(-1)).toMatchObject({ year: "丙寅", month: "癸巳", day: "癸酉", hour: "戊午", birthTimeStatus: "exact", dataQuality: "high" });
    expect(mounted.host.textContent).toContain("已填入：丙寅 癸巳 癸酉 戊午");
    mounted.unmount();
  });

  it("shows boundary candidates without replacing manual pillars", async () => {
    const modelValue: SubjectDraft = {
      subjectId: "subject-a", year: "甲子", month: "丙寅", day: "甲子", hour: "甲子",
      birthTimeStatus: "exact", dataQuality: "high",
    };
    const emitted: SubjectDraft[] = [];
    const mounted = mountComponent(PillarEditor, {
      modelValue, idPrefix: "subject-a", title: "主要命盘", description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => emitted.push(value),
    });
    const emissionsBeforeCalculation = emitted.length;
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("公历排盘辅助"))!.click();
    await nextTick();
    const input = mounted.host.querySelector<HTMLInputElement>("input[type='datetime-local']")!;
    input.value = "2024-02-04T16:26";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("计算并填入"))!.click();
    await nextTick();
    expect(emitted).toHaveLength(emissionsBeforeCalculation);
    expect(mounted.host.textContent).toContain("系统不自动选择交节前后命盘");
    expect(mounted.host.textContent).toContain("候选：癸卯 乙丑 戊戌 庚申；甲辰 丙寅 戊戌 庚申");
    mounted.unmount();
  });
});
