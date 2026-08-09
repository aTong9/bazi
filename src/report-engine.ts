import type { FourPillarsChart } from "./domain.js";
import { calculateAnnualLuck } from "./annual-luck.js";
import { calculateMajorLuckInteractions, type MajorLuckInteraction } from "./major-luck.js";
import { analyzeRelationship, type RelationshipConclusion } from "./relationship-analysis.js";

export const REPORT_SCHEMA_VERSION = "relationship-report-v1";
export const NARRATIVE_PROMPT_VERSION = "deterministic-narrative-v1";

export interface ReportEvidence {
  ruleIds: string[];
  factPaths: string[];
  confidence: "low" | "medium" | "high";
  period: "natal" | "dayun" | "year";
}

export interface ReportChapter {
  id: string;
  title: string;
  summary: string;
  positives: string[];
  risks: string[];
  advice: string[];
  evidence: ReportEvidence;
}

export interface RelationshipReport {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  metadata: {
    calendarEngineVersion: string;
    chartConfigVersion: "chart-config-v1";
    timezoneDatabaseVersion: "runtime-iana";
    ephemerisVersion: "lunar-typescript-1.8.6";
    ruleSetVersion: string;
    promptVersion: typeof NARRATIVE_PROMPT_VERSION;
    modelVersion: "none-deterministic";
    generatedAt: string;
  };
  chart: Pick<FourPillarsChart, "baZi" | "pillars" | "time" | "config" | "warnings" | "luck">;
  majorLuckInteractions: MajorLuckInteraction[];
  chapters: ReportChapter[];
  disclaimer: string;
  trace: string[];
}

const CHAPTERS = [
  ["birth-basis", "出生数据和排盘口径"], ["four-pillars", "四柱命盘"],
  ["emotional-tone", "你的情感底色"], ["attraction", "容易被什么类型的人吸引"],
  ["love-expression", "你如何表达爱"], ["spouse-star", "夫妻星状态"],
  ["spouse-palace", "夫妻宫及长期相处模式"], ["patterns", "容易重复的关系惯性"],
  ["peach-blossom", "桃花与感情机会"], ["strengths", "关系优势"],
  ["risks", "需要留意的风险"], ["timing", "当前大运和未来流年时间窗口"],
  ["advice", "可实践的关系建议"], ["method", "方法、置信度和免责声明"],
] as const;

function chapterFromConclusion(id: string, title: string, conclusion?: RelationshipConclusion): ReportChapter {
  if (!conclusion) return {
    id, title,
    summary: "当前审核规则不足以稳定判断这一主题，因此暂不生成个体化结论。",
    positives: [], risks: ["证据不足时保留空白，比强行归类更可靠。"], advice: [],
    evidence: { ruleIds: [], factPaths: [], confidence: "low", period: "natal" },
  };
  return {
    id, title, summary: conclusion.summary, positives: conclusion.positiveSignals,
    risks: conclusion.riskSignals, advice: conclusion.advice,
    evidence: { ruleIds: conclusion.evidenceRuleIds, factPaths: [`relationship.${conclusion.topic}`], confidence: conclusion.confidence, period: conclusion.applicablePeriod },
  };
}

export function createRelationshipReport(chart: FourPillarsChart, generatedAt = new Date().toISOString()): RelationshipReport {
  const analysis = analyzeRelationship(chart);
  const byTopic = new Map(analysis.conclusions.map(item => [item.topic, item]));
  const currentYear = Number(generatedAt.slice(0, 4));
  const annual = calculateAnnualLuck(chart, currentYear, currentYear + 2);
  const majorLuckInteractions = calculateMajorLuckInteractions(chart);
  const currentLuck = majorLuckInteractions.find(item => currentYear >= item.startYear && currentYear <= item.endYear);
  const custom = new Map<string, ReportChapter>([
    ["birth-basis", { id: "birth-basis", title: "出生数据和排盘口径", summary: `采用 ${chart.config.timeBasis} 时间口径，换日配置为 ${chart.config.dayBoundary}。`, positives: [], risks: chart.warnings, advice: ["边界时间请结合计算轨迹复核。"], evidence: { ruleIds: [], factPaths: ["chart.input", "chart.time", "chart.config"], confidence: chart.warnings.length ? "low" : "high", period: "natal" } }],
    ["four-pillars", { id: "four-pillars", title: "四柱命盘", summary: chart.baZi, positives: [`日主为${chart.dayMaster}。`], risks: [], advice: [], evidence: { ruleIds: [], factPaths: ["chart.pillars"], confidence: "high", period: "natal" } }],
    ["timing", { id: "timing", title: "当前大运和未来流年时间窗口", summary: currentLuck ? `当前大运为${currentLuck.pillar}（${currentLuck.startYear}—${currentLuck.endYear}），运干十神为${currentLuck.stemTenGod}。` : "当前年份不在已计算的大运范围内。", positives: [...(currentLuck?.relations.slice(0, 4).map(item => `当前大运与原局：${item.description}`) ?? []), ...annual.map(item => `${item.year} ${item.pillar}：${item.stemTenGod}`)], risks: ["大运、流年关系仅表示结构被触发，不等同于具体事件会发生。"], advice: ["结合现实关系状态与可验证事件观察，不以大运流年替代决定。"], evidence: { ruleIds: [], factPaths: ["majorLuckInteractions", "annualLuck"], confidence: "low", period: "year" } }],
    ["method", { id: "method", title: "方法、置信度和免责声明", summary: `排盘引擎 ${chart.engineVersion}；规则集 ${analysis.ruleSetVersion}。`, positives: ["四柱计算与语言表达分层，结论均保留证据。"], risks: ["命理属于传统文化解释框架，不是科学预测或专业建议。"], advice: ["重要关系决定应依据真实沟通、行为和自身安全。"], evidence: { ruleIds: [], factPaths: ["metadata", "trace"], confidence: "high", period: "natal" } }],
  ]);
  const topicFor: Record<string, string> = {
    "emotional-tone": "spouse_star", attraction: "spouse_star_position", "spouse-star": "spouse_star",
    "spouse-palace": "spouse_palace", "peach-blossom": "peach_blossom", patterns: "spouse_palace",
    strengths: "spouse_star", risks: "spouse_palace", advice: "spouse_star", "love-expression": "love_expression",
  };
  const chapters = CHAPTERS.map(([id, title]) => custom.get(id) ?? chapterFromConclusion(id, title, byTopic.get(topicFor[id]!)));
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    metadata: { calendarEngineVersion: chart.engineVersion, chartConfigVersion: "chart-config-v1", timezoneDatabaseVersion: "runtime-iana", ephemerisVersion: "lunar-typescript-1.8.6", ruleSetVersion: analysis.ruleSetVersion, promptVersion: NARRATIVE_PROMPT_VERSION, modelVersion: "none-deterministic", generatedAt },
    chart: { baZi: chart.baZi, pillars: chart.pillars, time: chart.time, config: chart.config, warnings: chart.warnings, luck: chart.luck },
    majorLuckInteractions,
    chapters,
    disclaimer: "本报告用于传统文化研究与自我观察，不构成医疗、法律、财务或心理诊断，也不应替代现实沟通与自主决定。",
    trace: [...chart.trace, ...analysis.trace.filter(item => item.status === "matched").map(item => `规则命中：${item.ruleId}（${item.score}）`)],
  };
}

const FORBIDDEN_OUTPUT = ["注定", "必然离婚", "一定会离婚", "克死", "有精神病", "有灾"];

export function validateRelationshipReport(report: RelationshipReport, expectedChart?: FourPillarsChart): string[] {
  const errors: string[] = [];
  if (report.chapters.length !== 14) errors.push("report must contain exactly 14 chapters");
  const text = JSON.stringify(report.chapters);
  for (const term of FORBIDDEN_OUTPUT) if (text.includes(term)) errors.push(`forbidden report term: ${term}`);
  for (const chapter of report.chapters) {
    if (chapter.evidence.ruleIds.some(id => !report.trace.some(line => line.includes(id)))) errors.push(`${chapter.id}: evidence rule missing from trace`);
  }
  if (!report.disclaimer) errors.push("disclaimer is required");
  if (expectedChart) {
    if (report.chart.baZi !== expectedChart.baZi) errors.push("report Ganzhi differs from source chart");
    for (const position of ["year", "month", "day", "hour"] as const) {
      if (report.chart.pillars[position].text !== expectedChart.pillars[position].text) errors.push(`report ${position} pillar differs from source chart`);
    }
    const timing = report.chapters.find(chapter => chapter.id === "timing");
    if (timing?.evidence.period !== "year") errors.push("timing chapter must use year period");
  }
  return errors;
}
