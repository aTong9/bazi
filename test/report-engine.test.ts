import { describe, expect, it } from "vitest";
import { createFourPillarsChart, createRelationshipReport, validateRelationshipReport } from "../src/index.js";

const chart = createFourPillarsChart({ calendarType: "gregorian", gender: "female", localDate: "1986-05-29", localTime: "00:00:00", timeZone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737 }, { timeBasis: "civil" });

describe("formal relationship report", () => {
  it("creates 14 traceable chapters and passes output validation", () => {
    const report = createRelationshipReport(chart, "2026-08-09T12:00:00.000Z");
    expect(report.chapters).toHaveLength(14);
    expect(report.chapters.map(item => item.id)).toEqual(expect.arrayContaining(["birth-basis", "spouse-star", "timing", "method"]));
    expect(report.metadata.modelVersion).toBe("none-deterministic");
    expect(report.majorLuckInteractions).toHaveLength(8);
    expect(validateRelationshipReport(report, chart)).toEqual([]);
  });

  it("is reproducible when generatedAt is fixed and preserves chart Ganzhi", () => {
    const time = "2026-08-09T12:00:00.000Z";
    expect(createRelationshipReport(chart, time)).toEqual(createRelationshipReport(chart, time));
    expect(createRelationshipReport(chart, time).chart.baZi).toBe(chart.baZi);
  });

  it("rejects forbidden deterministic claims", () => {
    const report = createRelationshipReport(chart, "2026-08-09T12:00:00.000Z");
    report.chapters[2]!.summary = "注定会发生";
    expect(validateRelationshipReport(report)).toEqual(expect.arrayContaining([expect.stringContaining("forbidden report term")]));
  });

  it("rejects changed Ganzhi and inconsistent timing evidence", () => {
    const report = createRelationshipReport(chart, "2026-08-09T12:00:00.000Z");
    report.chart.baZi = "甲子 甲子 甲子 甲子";
    report.chapters.find(item => item.id === "timing")!.evidence.period = "natal";
    expect(validateRelationshipReport(report, chart)).toEqual(expect.arrayContaining([
      "report Ganzhi differs from source chart",
      "timing chapter must use year period",
    ]));
  });
});
