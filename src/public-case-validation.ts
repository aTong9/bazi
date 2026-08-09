export type PublicCaseConfidence =
  | "site_replay_only"
  | "plausible_modern_timestamp"
  | "incomplete_hour";

export interface WenzhenPublicCelebrityCase {
  name: string;
  gender: "male" | "female";
  pillars: string;
  solarTime: string;
  group: string;
  hasAnnualLuck: boolean;
  period: string;
  description: string;
  confidence: PublicCaseConfidence;
  limitations: string[];
}

/** Parse the public, comma-separated response used by Wenzhen's celebrity page. */
export function parseWenzhenCelebrityResponse(source: string): WenzhenPublicCelebrityCase[] {
  return source
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const fields = line.split(",").map(value => value.trim());
      if (fields.length !== 8) throw new Error(`Celebrity row ${index + 1} has ${fields.length} fields; expected 8`);
      const [name, sex, pillars, solarTime, group, annualLuck, period, description] = fields as [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      if (sex !== "男" && sex !== "女") throw new Error(`Celebrity row ${index + 1} has invalid sex`);
      if (!/^mr[0-6]$/u.test(group)) throw new Error(`Celebrity row ${index + 1} has invalid group`);

      const incompleteHour = pillars.includes("*");
      const limitations = [
        "第三方公开案例，仅能回放问真展示的命盘，不能作为人生事件或关系结论的真值标签。",
      ];
      if (incompleteHour) limitations.push("时柱在来源中缺失。\n");
      limitations.push("站内日期可能按六十甲子周期平移；未经独立考证前，不能视为历史公历生日。\n");

      return {
        name,
        gender: sex === "男" ? "male" : "female",
        pillars: pillars.replace(/\s+/gu, " "),
        solarTime,
        group,
        hasAnnualLuck: annualLuck === "1",
        period,
        description,
        confidence: incompleteHour ? "incomplete_hour" : "site_replay_only",
        limitations: limitations.map(value => value.trim()),
      };
    });
}
