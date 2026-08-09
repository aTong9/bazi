import { describe, expect, it } from "vitest";
import { analyzeRelationship, createFourPillarsChart, createRelationshipReport } from "../src/index.js";

describe("unknown birth time", () => {
  it("warns and excludes hour-pillar spouse facts from conclusions", () => {
    const common = { calendarType: "gregorian" as const, gender: "female" as const, localDate: "1986-05-29", localTime: "00:00:00", timeZone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737 };
    const exact = createFourPillarsChart({ ...common, timePrecision: "exact" }, { timeBasis: "civil" });
    const unknown = createFourPillarsChart({ ...common, timePrecision: "unknown" }, { timeBasis: "civil" });
    expect(unknown.warnings).toEqual(expect.arrayContaining([expect.stringContaining("出生时间未知")]));
    expect(analyzeRelationship(unknown).facts.spouseStar.positions).not.toContain("hour");
    expect(analyzeRelationship(exact).facts.spouseStar.count).toBeGreaterThanOrEqual(analyzeRelationship(unknown).facts.spouseStar.count);
    expect(createRelationshipReport(unknown, "2026-08-09T00:00:00Z").chapters[0]!.evidence.confidence).toBe("low");
  });
});
