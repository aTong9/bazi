import { describe, expect, it } from "vitest";
import {
  approximateEquationOfTimeMinutes,
  createFourPillarsChart,
  type GregorianBirthInput,
} from "../src/index.js";

const baseInput: GregorianBirthInput = {
  calendarType: "gregorian",
  gender: "female",
  localDate: "1986-05-29",
  localTime: "00:00:00",
  timeZone: "Asia/Shanghai",
  latitude: 31.2304,
  longitude: 121.4737,
};

describe("createFourPillarsChart", () => {
  it("creates a deterministic civil-time chart", () => {
    const chart = createFourPillarsChart(baseInput, { timeBasis: "civil" });

    expect(chart.baZi).toBe("丙寅 癸巳 癸酉 壬子");
    expect(chart.dayMaster).toBe("癸");
    expect(chart.pillars.day.hiddenStems).toEqual(["辛"]);
    expect(chart.trace.some((entry) => entry.includes(chart.baZi))).toBe(true);
  });

  it("uses exact solar-term boundaries for year and month pillars", () => {
    const before = createFourPillarsChart(
      { ...baseInput, localDate: "2024-02-04", localTime: "16:00:00", longitude: 120 },
      { timeBasis: "civil" },
    );
    const after = createFourPillarsChart(
      { ...baseInput, localDate: "2024-02-04", localTime: "17:00:00", longitude: 120 },
      { timeBasis: "civil" },
    );

    expect(before.pillars.year.text).toBe("癸卯");
    expect(before.pillars.month.text).toBe("乙丑");
    expect(after.pillars.year.text).toBe("甲辰");
    expect(after.pillars.month.text).toBe("丙寅");
  });

  it("supports both common day-boundary sects at 23:00", () => {
    const input = { ...baseInput, localDate: "2024-02-04", localTime: "23:30:00", longitude: 120 };
    const ziInitial = createFourPillarsChart(input, {
      timeBasis: "civil",
      dayBoundary: "zi_initial_23",
    });
    const midnight = createFourPillarsChart(input, {
      timeBasis: "civil",
      dayBoundary: "midnight_00",
    });

    expect(ziInitial.pillars.day.text).toBe("己亥");
    expect(midnight.pillars.day.text).toBe("戊戌");
    expect(ziInitial.warnings).toContain(
      "出生时间位于子时，日柱结果受换日口径影响，请核对 dayBoundary 配置。",
    );
  });

  it("records true-solar-time corrections instead of hiding them", () => {
    const chart = createFourPillarsChart(baseInput);

    expect(chart.time.selectedBasis).toBe("true_solar");
    expect(chart.time.longitudeCorrectionMinutes).toBeCloseTo(5.8948, 3);
    expect(chart.time.daylightSavingOffsetMinutes).toBe(60);
    expect(chart.time.standardOffsetMinutes).toBe(480);
    expect(chart.time.selectedDateTime).toBe(chart.time.trueSolarDateTime);
    expect(chart.time.originalLocalDateTime).toContain("+09:00[Asia/Shanghai]");
  });

  it("rejects invalid coordinates", () => {
    expect(() => createFourPillarsChart({ ...baseInput, latitude: 91 })).toThrow(RangeError);
  });
});

describe("approximateEquationOfTimeMinutes", () => {
  it("returns a finite correction throughout the year", () => {
    for (const day of [1, 32, 81, 172, 266, 365]) {
      expect(Number.isFinite(approximateEquationOfTimeMinutes(day))).toBe(true);
    }
  });
});
