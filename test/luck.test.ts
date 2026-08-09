import { describe, expect, it } from "vitest";
import { createFourPillarsChart } from "../src/index.js";

const input = {
  calendarType: "gregorian" as const,
  localDate: "1990-01-01",
  localTime: "12:00:00",
  timeZone: "Asia/Shanghai",
  latitude: 30,
  longitude: 120,
};

describe("major luck calculation", () => {
  it("uses year-stem yin-yang and male gender for direction", () => {
    const chart = createFourPillarsChart(
      { ...input, gender: "male" },
      { timeBasis: "civil", qiyunMethod: "precise_minutes" },
    );
    expect(chart.pillars.year.text).toBe("己巳");
    expect(chart.luck.direction).toBe("backward");
    expect(chart.luck.periods).toHaveLength(8);
    expect(chart.luck.periods[0]?.pillar).toBe("乙亥");
  });

  it("reverses direction for female gender in the same chart", () => {
    const chart = createFourPillarsChart(
      { ...input, gender: "female" },
      { timeBasis: "civil", qiyunMethod: "precise_minutes" },
    );
    expect(chart.luck.direction).toBe("forward");
    expect(chart.luck.periods[0]?.pillar).toBe("丁丑");
  });

  it("exposes both supported qiyun calculation methods", () => {
    const precise = createFourPillarsChart(
      { ...input, gender: "female" },
      { timeBasis: "civil", qiyunMethod: "precise_minutes" },
    );
    const rounded = createFourPillarsChart(
      { ...input, gender: "female" },
      { timeBasis: "civil", qiyunMethod: "rounded_shichen" },
    );
    expect(precise.luck.startsAt).not.toBe(rounded.luck.startsAt);
    expect(precise.luck.qiyunMethod).toBe("precise_minutes");
    expect(rounded.luck.qiyunMethod).toBe("rounded_shichen");
  });

  it("preserves sub-hour precision with the default second-based method", () => {
    const chart = createFourPillarsChart({ ...input, gender: "female" }, { timeBasis: "civil", qiyunMethod: "precise_seconds" });
    expect(chart.luck.qiyunMethod).toBe("precise_seconds");
    expect(chart.luck.startOffset.minutes).toBeGreaterThanOrEqual(0);
    expect(chart.luck.startOffset.minutes).toBeLessThan(60);
    expect(chart.luck.startsAt).toMatch(/\d{2}:\d{2}:\d{2}$/);
  });
});
