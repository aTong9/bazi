import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createFourPillarsChart, type DayBoundary } from "../src/index.js";

interface GoldenCase {
  id: string;
  purpose: string;
  input: { localDate: string; localTime: string };
  dayBoundary: DayBoundary;
  expectedBaZi: string;
  wenzhenObserved: string | null;
  verification: string;
}

const cases = JSON.parse(
  readFileSync(new URL("./fixtures/wenzhen-boundary-cases.json", import.meta.url), "utf8"),
) as GoldenCase[];

describe("Wenzhen compatibility candidate golden cases", () => {
  for (const golden of cases) {
    it(`${golden.id}: ${golden.purpose}`, () => {
      const chart = createFourPillarsChart(
        {
          calendarType: "gregorian",
          gender: "female",
          ...golden.input,
          timeZone: "Asia/Shanghai",
          latitude: 30,
          longitude: 120,
        },
        { timeBasis: "civil", dayBoundary: golden.dayBoundary },
      );
      expect(chart.baZi).toBe(golden.expectedBaZi);
      if (golden.wenzhenObserved !== null) {
        expect(chart.baZi).toBe(golden.wenzhenObserved);
      }
    });
  }
});
