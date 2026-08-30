import { nextTick, reactive } from "vue";
import { describe, expect, it } from "vitest";

import { mountComponent } from "@/test/mount-component";
import type { SubjectDraft } from "@/types";
import PillarEditor from "./PillarEditor.vue";

describe("PillarEditor", () => {
  it("edits the label used to distinguish reports and archives", async () => {
    const modelValue = reactive<SubjectDraft>({
      subjectId: "主命盘", year: "庚申", month: "己丑", day: "甲寅", hour: "庚午",
      birthTimeStatus: "exact", dataQuality: "high",
    });
    const mounted = mountComponent(PillarEditor, {
      modelValue, idPrefix: "subject-a", title: "主要命盘", description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => { Object.assign(modelValue, value); },
    });
    const input = mounted.host.querySelector<HTMLInputElement>("#subject-a-subject-id")!;
    expect(input.required).toBe(true);
    expect(input.maxLength).toBe(120);
    input.value = "  小林  ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(modelValue.subjectId).toBe("小林");
    mounted.unmount();
  });

  it("normalizes linked stems immediately for an initial draft", () => {
    const modelValue = reactive<SubjectDraft>({
      subjectId: "subject-a",
      year: "庚申",
      month: "癸丑",
      day: "甲寅",
      hour: "丙午",
      birthTimeStatus: "exact",
      dataQuality: "high",
    });
    const emitted: SubjectDraft[] = [];
    const mounted = mountComponent(PillarEditor, {
      modelValue,
      idPrefix: "subject-a",
      title: "主要命盘",
      description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => { Object.assign(modelValue, value); emitted.push(value); },
    });
    expect(emitted[0]).toMatchObject({ month: "己丑", hour: "庚午" });
    mounted.unmount();
  });

  it("removes a specific hour and solar timestamp when birth time becomes unknown", async () => {
    const modelValue = reactive<SubjectDraft>({
      subjectId: "subject-a", year: "丙寅", month: "癸巳", day: "癸酉", hour: "戊午",
      birthTimeStatus: "exact", dataQuality: "high",
      birthInput: {
        method: "solar_utc8_assist", solarLocalDateTime: "1986-05-29T12:00", resolutionStatus: "resolved",
        resolvedPillars: "丙寅 癸巳 癸酉 戊午",
        adapter: { id: "lunar-typescript-standard-time", version: "1.8.6", civilTimeBasis: "UTC+08:00", trueSolarTimeApplied: false },
      },
    });
    const mounted = mountComponent(PillarEditor, {
      modelValue, idPrefix: "subject-a", title: "主要命盘", description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => { Object.assign(modelValue, value); },
    });
    const status = mounted.host.querySelector<HTMLSelectElement>("#subject-a-time-status")!;
    status.value = "unknown";
    status.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await nextTick();
    expect(modelValue).toMatchObject({ birthTimeStatus: "unknown", hour: "壬子", birthInput: { method: "manual_four_pillars" } });
    expect(mounted.host.querySelector<HTMLSelectElement>("#subject-a-hour")?.disabled).toBe(true);
    mounted.unmount();
  });

  it("fills reviewed pillars from a clear UTC+8 civil datetime", async () => {
    const modelValue = reactive<SubjectDraft>({
      subjectId: "subject-a", year: "甲子", month: "丙寅", day: "甲子", hour: "甲子",
      birthTimeStatus: "unknown", dataQuality: "unknown",
    });
    const emitted: SubjectDraft[] = [];
    const mounted = mountComponent(PillarEditor, {
      modelValue, idPrefix: "subject-a", title: "主要命盘", description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => { Object.assign(modelValue, value); emitted.push(value); },
    });
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("公历排盘辅助"))!.click();
    await nextTick();
    const input = mounted.host.querySelector<HTMLInputElement>("input[type='datetime-local']")!;
    input.value = "1986-05-29T12:00";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("计算并填入"))!.click();
    await nextTick();
    expect(emitted.at(-1)).toMatchObject({ year: "丙寅", month: "癸巳", day: "癸酉", hour: "戊午", birthTimeStatus: "exact", dataQuality: "high" });
    expect(emitted.at(-1)?.birthInput).toMatchObject({
      method: "solar_utc8_assist", solarLocalDateTime: "1986-05-29T12:00", resolutionStatus: "resolved",
      resolvedPillars: "丙寅 癸巳 癸酉 戊午", adapter: { version: "1.8.6", civilTimeBasis: "UTC+08:00", trueSolarTimeApplied: false },
    });
    expect(mounted.host.textContent).toContain("已填入：丙寅 癸巳 癸酉 戊午");
    mounted.unmount();
  });

  it("shows boundary candidates without replacing manual pillars", async () => {
    const modelValue = reactive<SubjectDraft>({
      subjectId: "subject-a", year: "甲子", month: "丙寅", day: "甲子", hour: "甲子",
      birthTimeStatus: "exact", dataQuality: "high",
    });
    const emitted: SubjectDraft[] = [];
    const mounted = mountComponent(PillarEditor, {
      modelValue, idPrefix: "subject-a", title: "主要命盘", description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => { Object.assign(modelValue, value); emitted.push(value); },
    });
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("公历排盘辅助"))!.click();
    await nextTick();
    const input = mounted.host.querySelector<HTMLInputElement>("input[type='datetime-local']")!;
    input.value = "2024-02-04T16:26";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("计算并填入"))!.click();
    await nextTick();
    expect(emitted.at(-1)).toMatchObject({ year: "甲子", month: "丙寅", day: "甲子", hour: "甲子" });
    expect(emitted.at(-1)?.birthInput).toMatchObject({ method: "solar_utc8_assist", resolutionStatus: "boundary_unresolved", resolvedPillars: null });
    expect(mounted.host.textContent).toContain("系统不自动选择交节前后命盘");
    expect(mounted.host.textContent).toContain("候选：癸卯 乙丑 戊戌 庚申；甲辰 丙寅 戊戌 庚申");
    mounted.unmount();
  });

  it("shows both native Zi-hour sect candidates in their documented order", async () => {
    const modelValue = reactive<SubjectDraft>({
      subjectId: "subject-a", year: "甲子", month: "丙寅", day: "甲子", hour: "甲子",
      birthTimeStatus: "exact", dataQuality: "high",
    });
    const mounted = mountComponent(PillarEditor, {
      modelValue, idPrefix: "subject-a", title: "主要命盘", description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => { Object.assign(modelValue, value); },
    });
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("公历排盘辅助"))!.click();
    await nextTick();
    const input = mounted.host.querySelector<HTMLInputElement>("input[type='datetime-local']")!;
    input.value = "2024-06-01T23:30";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    [...mounted.host.querySelectorAll("button")].find((button) => button.textContent?.includes("计算并填入"))!.click();
    await nextTick();
    expect(mounted.host.textContent).toContain("候选依次为 23 时换日与 0 时换日口径");
    expect(mounted.host.textContent).toContain("候选：甲辰 己巳 丁酉 庚子；甲辰 己巳 丙申 庚子");
    mounted.unmount();
  });

  it("restores a saved UTC+8 source and warns when pillars no longer match it", async () => {
    const modelValue = reactive<SubjectDraft>({
      subjectId: "subject-a", year: "丙寅", month: "癸巳", day: "癸酉", hour: "戊午",
      birthTimeStatus: "exact", dataQuality: "high",
      birthInput: {
        method: "solar_utc8_assist", solarLocalDateTime: "1986-05-29T12:00", resolutionStatus: "resolved",
        resolvedPillars: "丙寅 癸巳 癸酉 戊午",
        adapter: { id: "lunar-typescript-standard-time", version: "1.8.6", civilTimeBasis: "UTC+08:00", trueSolarTimeApplied: false },
      },
    });
    const emitted: SubjectDraft[] = [];
    const mounted = mountComponent(PillarEditor, {
      modelValue, idPrefix: "subject-a", title: "主要命盘", description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => { Object.assign(modelValue, value); emitted.push(value); },
    });
    expect(mounted.host.textContent).toContain("已恢复公历记录：1986-05-29 12:00（UTC+8）");
    const year = mounted.host.querySelector<HTMLSelectElement>(".pillar-grid select")!;
    year.value = "丁卯";
    year.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    expect(mounted.host.textContent).toContain("当前四柱已在公历辅助计算后被修改");
    expect(emitted.at(-1)?.year).toBe("丁卯");
    mounted.unmount();
  });

  it("requires recalculation when a restored solar record uses another adapter version", () => {
    const modelValue = reactive<SubjectDraft>({
      subjectId: "subject-a", year: "丙寅", month: "癸巳", day: "癸酉", hour: "戊午",
      birthTimeStatus: "exact", dataQuality: "high",
      birthInput: {
        method: "solar_utc8_assist", solarLocalDateTime: "1986-05-29T12:00", resolutionStatus: "resolved",
        resolvedPillars: "丙寅 癸巳 癸酉 戊午",
        adapter: { id: "lunar-typescript-standard-time", version: "0.9.0", civilTimeBasis: "UTC+08:00", trueSolarTimeApplied: false },
      },
    });
    const mounted = mountComponent(PillarEditor, {
      modelValue, idPrefix: "subject-a", title: "主要命盘", description: "测试",
      "onUpdate:modelValue": (value: SubjectDraft) => { Object.assign(modelValue, value); },
    });
    expect(mounted.host.textContent).toContain("来自其他历法适配器版本");
    expect(mounted.host.textContent).not.toContain("已恢复公历记录");
    mounted.unmount();
  });
});
