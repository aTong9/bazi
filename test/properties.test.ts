import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { createFourPillarsChart, EARTHLY_BRANCHES, HEAVENLY_STEMS } from "../src/index.js";

const base = { calendarType: "gregorian" as const, gender: "female" as const, timeZone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737 };
const cycle = Array.from({ length: 60 }, (_, index) => `${HEAVENLY_STEMS[index % 10]}${EARTHLY_BRANCHES[index % 12]}`);

describe("calendar engine properties", () => {
  it("advances the day pillar exactly one position on 60 adjacent civil days", () => {
    const start = Temporal.PlainDate.from("2024-01-01");
    const pillars = Array.from({ length: 61 }, (_, offset) => createFourPillarsChart({ ...base, localDate: start.add({ days: offset }).toString(), localTime: "12:00:00" }, { timeBasis: "civil" }).pillars.day.text);
    for (let index = 1; index < pillars.length; index += 1) expect(cycle.indexOf(pillars[index]!)).toBe((cycle.indexOf(pillars[index - 1]!) + 1) % 60);
    expect(pillars[60]).toBe(pillars[0]);
  });

  it("covers every two-hour branch and advances at each civil shichen boundary", () => {
    const observed = Array.from({ length: 12 }, (_, index) => {
      const hour = (index * 2 + 23) % 24;
      return createFourPillarsChart({ ...base, localDate: hour === 23 ? "2024-06-01" : "2024-06-02", localTime: `${String(hour).padStart(2, "0")}:30:00` }, { timeBasis: "civil", dayBoundary: "midnight_00" }).pillars.hour.branch;
    });
    expect(observed).toEqual(EARTHLY_BRANCHES);
  });

  it("is deterministic across all supported time bases and day boundaries", () => {
    for (const timeBasis of ["civil", "local_mean_solar", "true_solar"] as const) {
      for (const dayBoundary of ["midnight_00", "zi_initial_23"] as const) {
        const input = { ...base, localDate: "1990-06-15", localTime: "23:30:00" };
        expect(createFourPillarsChart(input, { timeBasis, dayBoundary })).toEqual(createFourPillarsChart(input, { timeBasis, dayBoundary }));
      }
    }
  });
});
