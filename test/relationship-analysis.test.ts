import { describe, expect, it } from "vitest";
import { analyzeRelationship, createFourPillarsChart } from "../src/index.js";

function chart(gender: "male" | "female" = "female") {
  return createFourPillarsChart({ calendarType: "gregorian", gender, localDate: "1986-05-29", localTime: "00:00:00", timeZone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737 }, { timeBasis: "civil" });
}

describe("relationship analysis", () => {
  it("derives gender-specific spouse-star facts and traceable conclusions", () => {
    const analysis = analyzeRelationship(chart("female"));
    expect(analysis.facts.spouseStar.names).toEqual(["正官", "七杀"]);
    expect(analysis.facts.spouseStar.count).toBeGreaterThan(0);
    expect(analysis.conclusions.length).toBeGreaterThan(0);
    expect(analysis.conclusions.every(item => item.evidenceRuleIds.length > 0)).toBe(true);
    expect(analysis.trace.some(item => item.status === "skipped_review_required")).toBe(true);
  });

  it("is deterministic and never mutates the four pillars", () => {
    const input = chart("male");
    const first = analyzeRelationship(input);
    expect(analyzeRelationship(input)).toEqual(first);
    expect(input.baZi).toBe("丙寅 癸巳 癸酉 壬子");
  });

  it("keeps peach blossom from becoming high-confidence evidence by itself", () => {
    const analysis = analyzeRelationship(chart());
    const peach = analysis.conclusions.find(item => item.topic === "peach_blossom");
    if (peach) expect(peach.confidence).toBe("low");
  });
});
