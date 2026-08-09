import { describe, expect, it } from "vitest";
import { parseWenzhenCelebrityResponse } from "../src/index.js";

const sample = [
  "梅兰芳,男,甲午 甲戌 丁酉 癸卯,1894-10-22 6:00:00,mr3,1,-,-",
  "朱元璋,男,戊辰 壬戌 丁丑 丁未,2048-11-03 14:00:00,mr0,0,明朝,开国皇帝",
  "陈道明,男,乙未 庚辰 丁巳  **,1955-4-26 6:00:00,mr3,1,-,-",
].join("\n");

describe("Wenzhen public celebrity evidence", () => {
  it("keeps all unverified complete timestamps at replay-only confidence", () => {
    const cases = parseWenzhenCelebrityResponse(sample);
    expect(cases.map(item => item.confidence)).toEqual([
      "site_replay_only",
      "site_replay_only",
      "incomplete_hour",
    ]);
    expect(cases[0]!.limitations.join(" ")).toContain("未经独立考证");
    expect(cases[2]!.limitations.join(" ")).toContain("时柱");
  });

  it("rejects malformed public rows instead of silently shifting columns", () => {
    expect(() => parseWenzhenCelebrityResponse("坏数据,男,甲子")).toThrow(/expected 8/u);
  });
});
