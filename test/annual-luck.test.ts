import { describe, expect, it } from "vitest";
import { calculateAnnualLuck, createFourPillarsChart } from "../src/index.js";

const chart = createFourPillarsChart({
  calendarType: "gregorian",
  gender: "female",
  localDate: "1986-05-29",
  localTime: "00:00:00",
  timeZone: "Asia/Shanghai",
  latitude: 31.2304,
  longitude: 121.4737,
}, { timeBasis: "civil" });

describe("annual luck", () => {
  it("returns annual pillars, ten gods and natal interactions", () => {
    const years = calculateAnnualLuck(chart, 2024, 2026);
    expect(years.map((item) => item.pillar)).toEqual(["甲辰", "乙巳", "丙午"]);
    expect(years.map((item) => item.stemTenGod)).toEqual(["伤官", "食神", "正财"]);
    expect(years[0]?.relations.length).toBeGreaterThan(0);
    expect(years.every((item) => item.algorithmVersion === "annual-luck-v1")).toBe(true);
    expect(years.every((item) => item.source.baZi === chart.baZi && item.source.chartEngineVersion === chart.engineVersion)).toBe(true);
    expect(years.every((item) => item.relations.every(relation => relation.participants.some(participant => participant.source.startsWith(`annual:${item.year}:`))))).toBe(true);
  });

  it("rejects invalid or excessive ranges", () => {
    expect(() => calculateAnnualLuck(chart, 2026, 2024)).toThrow(RangeError);
    expect(() => calculateAnnualLuck(chart, 1900, 2101)).toThrow(RangeError);
  });
});
