import { describe, expect, it } from "vitest";
import { createFourPillarsChart, normalizeBirthInput } from "../src/index.js";

const location = {
  gender: "female" as const,
  localTime: "12:00:00",
  timeZone: "Asia/Shanghai",
  latitude: 31.2304,
  longitude: 121.4737,
};

describe("lunar birth input", () => {
  it("converts a regular lunar date to Gregorian", () => {
    const normalized = normalizeBirthInput({
      calendarType: "lunar",
      lunarYear: 2020,
      lunarMonth: 4,
      lunarDay: 1,
      isLeapMonth: false,
      ...location,
    });
    expect(normalized.localDate).toBe("2020-04-23");
  });

  it("distinguishes a leap lunar month", () => {
    const normalized = normalizeBirthInput({
      calendarType: "lunar",
      lunarYear: 2020,
      lunarMonth: 4,
      lunarDay: 1,
      isLeapMonth: true,
      ...location,
    });
    expect(normalized.localDate).toBe("2020-05-23");
  });

  it("produces the same chart as its normalized Gregorian input", () => {
    const lunarInput = {
      calendarType: "lunar" as const,
      lunarYear: 2020,
      lunarMonth: 4,
      lunarDay: 1,
      isLeapMonth: true,
      ...location,
    };
    const normalized = normalizeBirthInput(lunarInput);
    const fromLunar = createFourPillarsChart(lunarInput, { timeBasis: "civil" });
    const fromGregorian = createFourPillarsChart(normalized, { timeBasis: "civil" });
    expect(fromLunar.baZi).toBe(fromGregorian.baZi);
  });

  it("rejects a leap month that does not exist", () => {
    expect(() =>
      normalizeBirthInput({
        calendarType: "lunar",
        lunarYear: 2021,
        lunarMonth: 4,
        lunarDay: 1,
        isLeapMonth: true,
        ...location,
      }),
    ).toThrow(RangeError);
  });

  it("preserves raw precision and place metadata through lunar normalization", () => {
    const normalized = normalizeBirthInput({ calendarType: "lunar", lunarYear: 2020, lunarMonth: 4, lunarDay: 1, isLeapMonth: false, timePrecision: "approximate", birthPlaceText: "中国 上海市", countryCode: "CN", ...location });
    expect(normalized).toMatchObject({ timePrecision: "approximate", birthPlaceText: "中国 上海市", countryCode: "CN" });
  });

  it("rejects dates outside the frozen product range", () => {
    expect(() => normalizeBirthInput({ calendarType: "gregorian", localDate: "1899-12-31", ...location })).toThrow(/supported range/);
    expect(() => normalizeBirthInput({ calendarType: "gregorian", localDate: "2101-01-01", ...location })).toThrow(/supported range/);
    expect(() => normalizeBirthInput({ calendarType: "gregorian", localDate: "2024-02-30", ...location })).toThrow(/valid ISO date/);
  });
});
