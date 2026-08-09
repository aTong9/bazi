import type { RelationshipReport } from "./report-engine.js";

export const NARRATIVE_CONTRACT_VERSION = "narrative-contract-v2-extractive";

export interface NarrativeChapter {
  id: string;
  prose: string;
  evidenceRuleIds: string[];
}

export interface NarrativeOutput {
  contractVersion: typeof NARRATIVE_CONTRACT_VERSION;
  baZi: string;
  chapters: NarrativeChapter[];
}

export interface NarrativeAdapter {
  readonly modelVersion: string;
  generate(request: { system: string; payload: string }): Promise<unknown>;
}

export function createNarrativeRequest(report: RelationshipReport): { system: string; payload: string } {
  return {
    system: [
      "你是正式关系报告的中文编辑，只能改写 payload 已有结论。",
      "不得计算或修改四柱、增删规则依据、推断身强弱喜忌或具体事件。",
      "不得输出疾病、灾祸、死亡、离婚断言，以及‘一定、注定、必然’等绝对表达。",
      "prose 只能逐字选取、重排或拼接该章已有 summary、positives、risks、advice 句子，不得增加过渡语或新事实。",
      "返回严格 JSON：{contractVersion,baZi,chapters:[{id,prose,evidenceRuleIds}]}。",
      "每章 evidenceRuleIds 必须与输入该章完全一致；证据不足章节必须保留谨慎表达。",
    ].join("\n"),
    payload: JSON.stringify({
      contractVersion: NARRATIVE_CONTRACT_VERSION,
      baZi: report.chart.baZi,
      chapters: report.chapters.map(chapter => ({
        id: chapter.id, title: chapter.title, summary: chapter.summary,
        positives: chapter.positives, risks: chapter.risks, advice: chapter.advice,
        confidence: chapter.evidence.confidence, period: chapter.evidence.period,
        evidenceRuleIds: chapter.evidence.ruleIds,
        maxChineseCharacters: 420,
      })),
      forbidden: ["一定", "注定", "必然", "离婚命", "克死", "灾祸", "精神疾病诊断"],
    }),
  };
}

function parseOutput(value: unknown): NarrativeOutput {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object") throw new TypeError("Narrative output must be a JSON object.");
  return parsed as NarrativeOutput;
}

const FORBIDDEN = ["一定", "注定", "必然", "离婚命", "克死", "灾祸", "精神病"];

function normalized(value: string): string {
  return value.replace(/\s+/gu, "");
}

function isExtractiveProse(prose: string, allowedStatements: string[]): boolean {
  const target = normalized(prose);
  if (!target) return false;
  const allowed = [...new Set(allowedStatements.map(normalized).filter(Boolean))];
  const reachable = new Set<number>([0]);
  for (let index = 0; index <= target.length; index += 1) {
    if (!reachable.has(index)) continue;
    for (const statement of allowed) {
      if (target.startsWith(statement, index)) reachable.add(index + statement.length);
    }
  }
  return reachable.has(target.length);
}

export function validateNarrativeOutput(output: NarrativeOutput, report: RelationshipReport): string[] {
  const errors: string[] = [];
  if (output.contractVersion !== NARRATIVE_CONTRACT_VERSION) errors.push("narrative contract version mismatch");
  if (output.baZi !== report.chart.baZi) errors.push("narrative changed source Ganzhi");
  if (!Array.isArray(output.chapters) || output.chapters.length !== report.chapters.length) errors.push("narrative chapter count mismatch");
  const outputById = new Map((output.chapters ?? []).map(chapter => [chapter.id, chapter]));
  for (const source of report.chapters) {
    const chapter = outputById.get(source.id);
    if (!chapter) { errors.push(`missing narrative chapter: ${source.id}`); continue; }
    if (chapter.prose.length > 420) errors.push(`${source.id}: prose exceeds length limit`);
    const expected = [...source.evidence.ruleIds].sort();
    const actual = [...(chapter.evidenceRuleIds ?? [])].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${source.id}: evidence rules changed`);
    const allowedStatements = [source.summary, ...source.positives, ...source.risks, ...source.advice];
    if (!isExtractiveProse(chapter.prose, allowedStatements)) errors.push(`${source.id}: narrative contains unauthorized prose`);
    for (const term of FORBIDDEN) if (chapter.prose.includes(term)) errors.push(`${source.id}: forbidden term ${term}`);
  }
  for (const id of outputById.keys()) if (!report.chapters.some(chapter => chapter.id === id)) errors.push(`unauthorized narrative chapter: ${id}`);
  return errors;
}

export async function generateValidatedNarrative(report: RelationshipReport, adapter: NarrativeAdapter): Promise<NarrativeOutput> {
  const raw = await adapter.generate(createNarrativeRequest(report));
  const output = parseOutput(raw);
  const errors = validateNarrativeOutput(output, report);
  if (errors.length) throw new Error(`Narrative validation failed (${adapter.modelVersion}): ${errors.join("; ")}`);
  return output;
}
