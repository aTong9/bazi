import { describe, expect, it } from "vitest";
import { createLocalChartResult } from "../web/app/local-chart.js";

describe("browser-local workbench pipeline", () => {
  it("creates the golden chart, luck periods and JSON-template narrative without HTTP", () => {
    const result = createLocalChartResult({
      calendarType: "gregorian",
      gender: "female",
      localDate: "1986-05-29",
      localTime: "00:00:00",
      timeZone: "Asia/Shanghai",
      latitude: 31.2304,
      longitude: 121.4737,
    }, { timeBasis: "civil" }, {
      currentYear: 2025,
      generatedAt: "2025-01-01T00:00:00.000Z",
      annualStartYear: 2024,
      annualEndYear: 2026,
    });

    expect(result.executionMode).toBe("browser-local");
    expect(result.chart.baZi).toBe("丙寅 癸巳 癸酉 壬子");
    expect(result.annualLuck.map(item => item.pillar)).toEqual(["甲辰", "乙巳", "丙午"]);
    expect(result.majorLuckInteractions).toHaveLength(8);
    expect(result.report.chapters).toHaveLength(14);
    expect(result.localNarrative.version).toBe("local-narrative-v1");
    expect(result.localNarrative.chapters).toHaveLength(result.report.chapters.length);
    expect(result.localNarrative.intro).toContain("当前浏览器");
  });
});
