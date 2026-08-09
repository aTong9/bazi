import { readFileSync } from "node:fs";
import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { createFourPillarsChart, type BirthInput, type DayBoundary, type TimeBasis } from "../src/index.js";

interface GoldenCase {
  caseId: string;
  boundary: boolean;
  input: BirthInput;
  settings: { timeBasis: TimeBasis; dayBoundary: DayBoundary };
  observed: { fourPillars: string; dayun: string[]; qiyunStartsAt: string };
  compatibility: { fourPillars: boolean; dayun: boolean; qiyunWithin20Minutes: boolean; overall: boolean };
  differenceReason: string;
}

const fixture = JSON.parse(readFileSync(new URL("./fixtures/wenzhen-public-api-golden.json", import.meta.url), "utf8")) as { schemaVersion: string; provenance: { endpoint: string }; cases: GoldenCase[] };

function minuteDifference(left: string, right: string): number {
  return Math.abs(Temporal.PlainDateTime.from(left.replace(" ", "T")).until(Temporal.PlainDateTime.from(right.replace(" ", "T")), { largestUnit: "minutes" }).total({ unit: "minutes" }));
}

describe("tracked Wenzhen public API golden observations", () => {
  it("has explicit public provenance and the complete 150-case matrix", () => {
    expect(fixture.schemaVersion).toBe("wenzhen-public-api-golden-v1");
    expect(fixture.provenance.endpoint).toBe("https://bzapi4.iwzbz.com/getbasebz8.php");
    expect(fixture.cases).toHaveLength(150);
    expect(new Set(fixture.cases.map(item => item.caseId)).size).toBe(150);
  });

  it("replays all observed fields and preserves every explained boundary difference", () => {
    let ordinary = 0;
    let ordinaryCompatible = 0;
    let unexplainedBoundaryDifferences = 0;
    for (const item of fixture.cases) {
      const chart = createFourPillarsChart(item.input, item.settings);
      const pillarsMatch = chart.baZi === item.observed.fourPillars;
      const dayunMatch = chart.luck.periods.every((period, index) => period.pillar === item.observed.dayun[index]);
      const qiyunMatch = minuteDifference(chart.luck.startsAt, item.observed.qiyunStartsAt) <= 20;
      expect(pillarsMatch, `${item.caseId} pillars`).toBe(item.compatibility.fourPillars);
      expect(dayunMatch, `${item.caseId} dayun`).toBe(item.compatibility.dayun);
      expect(qiyunMatch, `${item.caseId} qiyun`).toBe(item.compatibility.qiyunWithin20Minutes);
      if (!item.boundary) {
        ordinary += 1;
        if (pillarsMatch && dayunMatch && qiyunMatch) ordinaryCompatible += 1;
      } else if (!(pillarsMatch && dayunMatch && qiyunMatch) && !item.differenceReason.trim()) {
        unexplainedBoundaryDifferences += 1;
      }
    }
    expect({ ordinary, ordinaryCompatible, unexplainedBoundaryDifferences }).toEqual({ ordinary: 30, ordinaryCompatible: 30, unexplainedBoundaryDifferences: 0 });
  });
});
