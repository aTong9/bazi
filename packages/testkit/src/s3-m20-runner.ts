import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import { readM0SemanticWorkbook } from "../../catalog/src/verify-m0-enrichment.js";
import type { EarthlyBranch, HeavenlyStem, Pillar } from "../../domain/src/birth-input.js";
import { analyzeM0 } from "../../application/src/analyze-m0.js";
import { assessM0InputQuality } from "../../application/src/assess-m0-input-quality.js";

export interface M20ExecutionRecord {
  readonly testId: string; readonly sourceStatus: string; readonly targetModule: string;
  readonly targetRuleIds: readonly string[]; readonly executionStatus: "executed" | "quality_gate" | "review_required" | "failed";
  readonly targetRulesExist: boolean; readonly targetRulesMatched: readonly string[]; readonly issues: readonly string[]; readonly durationMs: number;
}

export async function executeAllM20Fixtures(options: { repositoryRoot: string; catalog: CatalogSnapshot }): Promise<readonly M20ExecutionRecord[]> {
  const rows = (await readM0SemanticWorkbook({ repositoryRoot: options.repositoryRoot })).filter((row) => row.moduleId === "M0.M20");
  return Object.freeze(rows.map((row): M20ExecutionRecord => {
    const startedAt = performance.now();
    const targetRuleIds = splitRuleIds(row.fields["目标Rule_ID"] ?? "");
    const targetRulesExist = targetRuleIds.every((id) => options.catalog.getRecord(id) !== null);
    if (row.fields["测试结果"] === "待复核") return record(row.id, row.fields, targetRuleIds, "review_required", targetRulesExist, [], ["SOURCE_FIXTURE_REQUIRES_HUMAN_OR_GOVERNANCE_REVIEW"], performance.now() - startedAt);
    const pillars = parseFourPillars(row.fields["四柱"] ?? "");
    if (!pillars) {
      const qualityGate = ["M03", "M19"].includes(row.fields["目标模块"] ?? "") && /资料不完整|待定|边界双盘/u.test(row.fields["四柱"] ?? "");
      if (qualityGate) {
        const assessment = assessM0InputQuality({ timezoneKnown: !/时区未知/u.test(row.fields["四柱"] ?? ""), calendarBoundaryCandidates: /边界双盘|接近交节/u.test(`${row.fields["四柱"] ?? ""}${row.fields["输入事实"] ?? ""}`) ? 2 : 1 });
        const matched = targetRuleIds.filter((id) => assessment.ruleTrace.includes(id));
        const passed = assessment.status === "stopped" && assessment.issues.length > 0 && matched.length === targetRuleIds.length;
        return record(row.id, row.fields, targetRuleIds, passed ? "executed" : "failed", targetRulesExist, matched, passed ? [] : ["INPUT_QUALITY_GATE_MISMATCH"], performance.now() - startedAt);
      }
      return record(row.id, row.fields, targetRuleIds, "failed", targetRulesExist, [], ["FOUR_PILLARS_NOT_PARSEABLE"], performance.now() - startedAt);
    }
    const result = analyzeM0({ analysisMode: "test", subject: { inputMode: "four_pillars_provided", subjectId: row.id, fourPillars: pillars, birthTimeStatus: "exact", timezone: "Asia/Shanghai", dataQuality: "high", syntheticFixture: true }, requestedSections: ["m0"] }, options.catalog);
    if (!result.ok) return record(row.id, row.fields, targetRuleIds, "failed", targetRulesExist, [], result.issues.map((issue) => issue.code), performance.now() - startedAt);
    const modulePresent = row.fields["目标模块"] === "M19" || Object.keys(result.response.m0.modules).some((key) => key.endsWith(`.${row.fields["目标模块"]}`));
    const matched = targetRuleIds.filter((id) => result.response.ruleTrace.includes(id));
    const issues = [...(!targetRulesExist ? ["TARGET_RULE_MISSING"] : []), ...(!modulePresent ? ["TARGET_MODULE_NOT_EXECUTED"] : []), ...(Object.keys(result.response.m0.fields).length !== 45 ? ["M19_FIELD_COUNT_INVALID"] : [])];
    return record(row.id, row.fields, targetRuleIds, issues.length ? "failed" : "executed", targetRulesExist, matched, issues, performance.now() - startedAt);
  }));
}

function record(testId: string, fields: Readonly<Record<string, string>>, targetRuleIds: readonly string[], executionStatus: M20ExecutionRecord["executionStatus"], targetRulesExist: boolean, targetRulesMatched: readonly string[], issues: readonly string[], durationMs: number): M20ExecutionRecord {
  return Object.freeze({ testId, sourceStatus: fields["测试结果"] ?? "", targetModule: fields["目标模块"] ?? "", targetRuleIds: Object.freeze(targetRuleIds), executionStatus, targetRulesExist, targetRulesMatched: Object.freeze(targetRulesMatched), issues: Object.freeze(issues), durationMs });
}
function splitRuleIds(value: string): string[] { return value.split(/[；;,，\s]+/u).map((item) => item.trim()).filter(Boolean); }
function parseFourPillars(value: string): { year: Pillar; month: Pillar; day: Pillar; hour: Pillar } | null {
  const tokens = value.trim().split(/\s+/u);
  if (tokens.length !== 4 || !tokens.every((token) => /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/u.test(token))) return null;
  const pillar = (token: string): Pillar => ({ stem: token[0] as HeavenlyStem, branch: token[1] as EarthlyBranch });
  return { year: pillar(tokens[0]!), month: pillar(tokens[1]!), day: pillar(tokens[2]!), hour: pillar(tokens[3]!) };
}
