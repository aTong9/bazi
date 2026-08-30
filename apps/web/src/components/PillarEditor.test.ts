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
});
