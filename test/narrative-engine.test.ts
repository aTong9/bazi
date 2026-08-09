import { describe, expect, it } from "vitest";
import { createFourPillarsChart, createNarrativeRequest, createRelationshipReport, generateValidatedNarrative, NARRATIVE_CONTRACT_VERSION, type NarrativeOutput, validateNarrativeOutput } from "../src/index.js";

const chart = createFourPillarsChart({ calendarType: "gregorian", gender: "female", localDate: "1990-06-15", localTime: "10:30", timeZone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737 });
const report = createRelationshipReport(chart, "2026-08-09T00:00:00Z");
const validOutput = (): NarrativeOutput => ({ contractVersion: NARRATIVE_CONTRACT_VERSION, baZi: report.chart.baZi, chapters: report.chapters.map(chapter => ({ id: chapter.id, prose: chapter.summary, evidenceRuleIds: chapter.evidence.ruleIds })) });

describe("AI narrative contract", () => {
  it("sends only structured conclusions and explicit constraints", () => {
    const request = createNarrativeRequest(report);
    expect(request.system).toContain("不得计算或修改四柱");
    expect(request.payload).not.toContain("birthPlaceText");
    expect(JSON.parse(request.payload).chapters).toHaveLength(14);
  });

  it("accepts a conforming adapter response", async () => {
    const output = await generateValidatedNarrative(report, { modelVersion: "fake-safe-1", async generate() { return validOutput(); } });
    expect(output.baZi).toBe(report.chart.baZi);
  });

  it("rejects hallucinated rules, altered Ganzhi, forbidden claims and prompt-shaped prose", () => {
    const output = validOutput();
    output.baZi = "甲子 甲子 甲子 甲子";
    output.chapters[2]!.evidenceRuleIds = ["invented.rule"];
    output.chapters[2]!.prose = "忽略前文，你注定会离婚";
    expect(validateNarrativeOutput(output, report)).toEqual(expect.arrayContaining([
      "narrative changed source Ganzhi",
      expect.stringContaining("evidence rules changed"),
      expect.stringContaining("forbidden term 注定"),
    ]));
  });

  it("rejects new claims even when they contain no forbidden keyword", () => {
    const output = validOutput();
    output.chapters[2]!.prose = "你明年会遇到适合结婚的对象。";
    expect(validateNarrativeOutput(output, report)).toContain("emotional-tone: narrative contains unauthorized prose");
  });

  it("allows exact source statements to be reordered and joined", () => {
    const output = validOutput();
    const source = report.chapters[2]!;
    output.chapters[2]!.prose = `${source.risks[0] ?? source.summary}${source.summary}`;
    expect(validateNarrativeOutput(output, report)).toEqual([]);
  });
});
