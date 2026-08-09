import { describe, expect, it } from "vitest";
import { createFourPillarsChart, deriveChartFacts } from "../src/index.js";

const chart = createFourPillarsChart({
  calendarType: "gregorian", gender: "female", localDate: "1986-05-29",
  localTime: "00:00:00", timeZone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737,
}, { timeBasis: "civil" });

describe("derived chart facts", () => {
  it("derives traceable element, yin-yang and hidden-stem facts", () => {
    const facts = deriveChartFacts(chart);
    expect(facts.source.baZi).toBe("丙寅 癸巳 癸酉 壬子");
    expect(facts.stems.day).toEqual({ value: "癸", element: "水", yinYang: "阴" });
    expect(facts.hiddenStems.year.map(item => item.weight)).toEqual([0.6, 0.3, 0.1]);
    expect(facts.hiddenStems.day).toEqual([{ value: "辛", role: "main", weight: 1 }]);
  });

  it("derives twelve-growth, void and peach blossom without changing the chart", () => {
    const original = chart.baZi;
    const facts = deriveChartFacts(chart);
    expect(facts.twelveGrowth.day).toBe("病");
    expect(facts.void.branches).toEqual(["戌", "亥"]);
    expect(facts.peachBlossom).toEqual(expect.arrayContaining([
      { basis: "year", target: "卯", positions: [] },
      { basis: "day", target: "午", positions: [] },
    ]));
    expect(chart.baZi).toBe(original);
  });
});
