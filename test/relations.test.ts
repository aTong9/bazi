import { describe, expect, it } from "vitest";
import {
  analyzeBranchGroups,
  analyzeBranchPair,
  analyzeChartRelations,
  analyzeStemPair,
  createFourPillarsChart,
  presentNatalRelations,
} from "../src/index.js";

describe("ganzhi relations", () => {
  it("detects heavenly-stem combination and generation/overcoming direction", () => {
    const combined = analyzeStemPair(
      { source: "a", value: "甲" },
      { source: "b", value: "己" },
    );
    expect(combined).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "stem_combine", resultElement: "土" }),
      expect.objectContaining({ kind: "stem_overcome" }),
    ]));
    expect(analyzeStemPair(
      { source: "a", value: "甲" },
      { source: "b", value: "庚" },
    )).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "stem_clash" })]));
  });

  it("detects pair, self-punishment, three-harmony and three-meeting relations", () => {
    expect(analyzeBranchPair(
      { source: "a", value: "子" },
      { source: "b", value: "午" },
    )).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "branch_clash" })]));
    expect(analyzeBranchPair(
      { source: "a", value: "辰" },
      { source: "b", value: "辰" },
    )).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "branch_self_punishment" })]));
    const groups = analyzeBranchGroups([
      { source: "a", value: "申" }, { source: "b", value: "子" },
      { source: "c", value: "辰" }, { source: "d", value: "酉" },
    ]);
    expect(groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "branch_three_harmony", resultElement: "水" }),
    ]));
  });

  it("analyzes all natal pillar pairs through one interface", () => {
    const chart = createFourPillarsChart({
      calendarType: "gregorian",
      gender: "female",
      localDate: "1986-05-29",
      localTime: "00:00:00",
      timeZone: "Asia/Shanghai",
      latitude: 31.2304,
      longitude: 121.4737,
    }, { timeBasis: "civil" });
    const relations = analyzeChartRelations(chart);
    expect(relations.length).toBeGreaterThan(0);
    expect(relations.every((relation) => relation.participants.length >= 2)).toBe(true);
    expect(relations.every((relation) => relation.algorithmVersion === "mainstream-ganzhi-v1")).toBe(true);
  });

  it("presents combinations as review-required candidates instead of confirmed transformations", () => {
    const relations = analyzeStemPair(
      { source: "year:stem", value: "甲" },
      { source: "month:stem", value: "己" },
    );
    const presented = presentNatalRelations(relations);
    expect(presented[0]).toEqual(expect.objectContaining({
      group: "combination",
      label: "天干五合",
      positions: "年柱 · 月柱",
      judgment: "transformation_review_required",
    }));
    expect(presented[0]?.note).toContain("当前不自动判定");
  });
});
