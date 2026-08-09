import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeBirthInput } from "../src/index.js";

interface HkoCase { lunarYear: number; lunarMonth: number; lunarDay: number; isLeapMonth: boolean; gregorianDate: string }
const fixture = JSON.parse(readFileSync(new URL("./fixtures/hko-lunar-conversion-golden.json", import.meta.url), "utf8")) as { schemaVersion: string; provenance: { publisher: string; sources: string[] }; cases: HkoCase[] };

describe("Hong Kong Observatory lunar conversion golden cases", () => {
  it("carries primary-source provenance", () => {
    expect(fixture.schemaVersion).toBe("hko-lunar-conversion-golden-v1");
    expect(fixture.provenance.publisher).toBe("香港天文台");
    expect(fixture.provenance.sources.every(source => source.startsWith("https://www.hko.gov.hk/"))).toBe(true);
  });

  for (const item of fixture.cases) {
    it(`${item.lunarYear}-${item.isLeapMonth ? "闰" : ""}${item.lunarMonth}-1 → ${item.gregorianDate}`, () => {
      const normalized = normalizeBirthInput({ calendarType: "lunar", ...item, gender: "female", localTime: "12:00:00", timeZone: "Asia/Hong_Kong", latitude: 22.3193, longitude: 114.1694 });
      expect(normalized.localDate).toBe(item.gregorianDate);
    });
  }
});
