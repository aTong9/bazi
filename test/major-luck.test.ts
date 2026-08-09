import { describe, expect, it } from "vitest";
import { calculateMajorLuckInteractions, createFourPillarsChart } from "../src/index.js";

const chart = createFourPillarsChart({ calendarType: "gregorian", gender: "female", localDate: "1986-05-29", localTime: "00:00:00", timeZone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737 }, { timeBasis: "civil" });

describe("major-luck interactions", () => {
  it("derives ten gods and only interactions involving the major-luck pillar", () => {
    const periods = calculateMajorLuckInteractions(chart);
    expect(periods).toHaveLength(chart.luck.periods.length);
    expect(periods.every(period => period.algorithmVersion === "major-luck-interactions-v1")).toBe(true);
    for (const period of periods) {
      expect(period.source).toMatchObject({ baZi: chart.baZi, chartEngineVersion: chart.engineVersion, qiyunMethod: chart.luck.qiyunMethod });
      expect(period.stemTenGod).toBeTruthy();
      expect(period.relations.every(relation => relation.participants.some(participant => participant.source.startsWith(`dayun:${period.index}:`)))).toBe(true);
    }
  });
});
