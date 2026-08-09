export const CONTENT_ENGINE_VERSION = "xiaohongshu-content-v1";

export interface AnonymousCaseSource {
  type: "case";
  caseId: string;
  approved: boolean;
  features: string[];
  relationshipPattern: string;
  changeDirection: string;
  evidenceRuleIds: string[];
}

export interface KnowledgeSource {
  type: "knowledge";
  topicId: string;
  approved: boolean;
  signals: Array<{ label: string; behavior: string; ruleId: string }>;
  action: string;
}

export type ContentSource = AnonymousCaseSource | KnowledgeSource;

export interface ContentPage { page: number; role: string; heading: string; body: string; evidenceRuleIds: string[] }

export interface XiaohongshuDraft {
  engineVersion: typeof CONTENT_ENGINE_VERSION;
  sourceType: ContentSource["type"];
  sourceId: string;
  titleVariants: string[];
  pages: ContentPage[];
  interactionQuestion: string;
  reviewRequired: true;
  publishStatus: "draft_only";
}

function assertSafeSource(source: ContentSource): void {
  if (!source.approved) throw new Error("Only human-approved rules or anonymous cases may enter the content engine.");
  const serialized = JSON.stringify(source);
  for (const key of ["name", "phone", "email", "birthDate", "birthTime", "address", "localDate", "localTime"]) {
    if (new RegExp(`\\"${key}\\"`, "i").test(serialized)) throw new Error(`Content source contains private field: ${key}`);
  }
}

export function generateXiaohongshuDraft(source: ContentSource): XiaohongshuDraft {
  assertSafeSource(source);
  if (source.type === "knowledge") {
    const signals = source.signals.slice(0, 5);
    if (signals.length < 3) throw new Error("Knowledge drafts require three to five reviewed signals.");
    const evidence = signals.map(item => item.ruleId);
    const pages: ContentPage[] = [
      { page: 1, role: "cover", heading: `你以为是性格，其实是「${source.topicId}」在关系里的惯性`, body: "单一信号不能决定一段关系，但重复出现的模式值得被看见。", evidenceRuleIds: evidence },
      { page: 2, role: "reframe", heading: "先别急着责怪自己", body: "很多反应是在寻找安全感。看见模式，是为了多一个选择。", evidenceRuleIds: evidence },
      ...signals.slice(0, 3).map((item, index) => ({ page: index + 3, role: "signal", heading: `信号 ${index + 1} · ${item.label}`, body: item.behavior, evidenceRuleIds: [item.ruleId] })),
      { page: 6, role: "self-check", heading: "你可以这样自测", body: "最近三次冲突里，你是否重复了同一种保护自己的方式？", evidenceRuleIds: evidence },
      { page: 7, role: "action", heading: "把判断换成一个小行动", body: source.action, evidenceRuleIds: evidence },
    ];
    return { engineVersion: CONTENT_ENGINE_VERSION, sourceType: source.type, sourceId: source.topicId, titleVariants: [`真正影响关系的，可能不是你以为的性格`, `${source.topicId}：3 个容易忽略的关系信号`, `别急着改自己，先看懂这个关系模式`], pages, interactionQuestion: "你最常重复的是哪一种反应？", reviewRequired: true, publishStatus: "draft_only" };
  }
  const evidence = source.evidenceRuleIds.slice(0, 3);
  const pages: ContentPage[] = [
    { page: 1, role: "cover", heading: "她以为自己遇人不淑，后来才看见重复的选择", body: "案例已匿名化；命理信号只作为观察角度。", evidenceRuleIds: evidence },
    { page: 2, role: "character", heading: "关系开始时，一切都很有吸引力", body: "人物身份与可识别经历已移除。", evidenceRuleIds: evidence },
    { page: 3, role: "problem", heading: "真正困住她的是同一种关系惯性", body: source.relationshipPattern, evidenceRuleIds: evidence },
    ...source.features.slice(0, 3).map((feature, index) => ({ page: index + 4, role: "evidence", heading: `观察 ${index + 1}`, body: feature, evidenceRuleIds: evidence[index] ? [evidence[index]!] : evidence })),
    { page: 7, role: "change", heading: "改变不是预测下一段关系", body: source.changeDirection, evidenceRuleIds: evidence },
  ];
  return { engineVersion: CONTENT_ENGINE_VERSION, sourceType: source.type, sourceId: source.caseId, titleVariants: ["她不是总遇到错的人，而是重复进入熟悉的关系", "一个匿名案例：吸引力为什么总变成消耗", "看懂关系惯性后，她不再急着证明自己"], pages, interactionQuestion: "你有没有在不同关系里遇到相似的困境？", reviewRequired: true, publishStatus: "draft_only" };
}

const CONTENT_FORBIDDEN = ["注定", "必然", "百分百", "肯定离婚", "克死", "精神病"];

export function validateXiaohongshuDraft(draft: XiaohongshuDraft): string[] {
  const errors: string[] = [];
  if (draft.pages.length !== 7) errors.push("draft must contain exactly seven pages");
  if (!draft.reviewRequired || draft.publishStatus !== "draft_only") errors.push("draft must require human review and remain unpublished");
  for (const page of draft.pages) {
    if (!page.evidenceRuleIds.length) errors.push(`page ${page.page} has no traceable evidence`);
    for (const term of CONTENT_FORBIDDEN) if (`${page.heading}${page.body}`.includes(term)) errors.push(`page ${page.page} contains forbidden term: ${term}`);
  }
  return errors;
}

export interface TopicMetrics { impressions: number; views: number; comments: number; saves: number; followers: number }
export function scoreContentTopic(metrics: TopicMetrics): number {
  if (Object.values(metrics).some(value => !Number.isFinite(value) || value < 0)) throw new RangeError("Metrics must be non-negative numbers.");
  const reach = metrics.impressions ? metrics.views / metrics.impressions : 0;
  const engagement = metrics.views ? (metrics.comments * 2 + metrics.saves * 3 + metrics.followers * 5) / metrics.views : 0;
  return Math.round((reach * 0.4 + engagement * 0.6) * 10_000) / 10_000;
}
