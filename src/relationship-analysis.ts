import type { FourPillarsChart } from "./domain.js";
import { deriveChartFacts } from "./derived-facts.js";
import { analyzeChartRelations, type RelationKind } from "./relations.js";
import { RELATIONSHIP_RULES, RELATIONSHIP_RULE_SET_VERSION } from "./relationship-rules.js";
import type { AtomicCondition, RelationshipRule } from "./rule-schema.js";

type Position = "year" | "month" | "day" | "hour";

export interface RelationshipFacts {
  spouseStar: { names: string[]; count: number; visibleCount: number; hiddenCount: number; positions: Position[]; kindsPresent: string[]; mixed: boolean };
  spousePalace: { branch: string; relations: RelationKind[] };
  peachBlossom: { positionCount: number; positions: Position[] };
  loveExpression: { tenGodsPresent: string[]; positions: Position[] };
  monthMode: { mainHiddenTenGod: string | null };
}

export interface RuleExecution {
  ruleId: string;
  status: "matched" | "not_matched" | "skipped_review_required" | "excluded";
  conditionResults: Array<{ condition: AtomicCondition; matched: boolean }>;
  score: number;
}

export interface RelationshipConclusion {
  conclusionId: string;
  topic: string;
  summary: string;
  positiveSignals: string[];
  riskSignals: string[];
  counterSignals: string[];
  advice: string[];
  evidenceRuleIds: string[];
  confidence: "low" | "medium" | "high";
  applicablePeriod: "natal";
  languageStrength: "cautious" | "normal" | "strong";
}

export interface RelationshipAnalysis {
  ruleSetVersion: typeof RELATIONSHIP_RULE_SET_VERSION;
  source: { baZi: string; chartEngineVersion: string };
  facts: RelationshipFacts;
  conclusions: RelationshipConclusion[];
  trace: RuleExecution[];
}

function unique<T>(values: T[]): T[] { return [...new Set(values)]; }

export function deriveRelationshipFacts(chart: FourPillarsChart): RelationshipFacts {
  const positions: Position[] = chart.input.timePrecision === "unknown" ? ["year", "month", "day"] : ["year", "month", "day", "hour"];
  const names = chart.input.gender === "male" ? ["正财", "偏财"] : ["正官", "七杀"];
  let visibleCount = 0;
  let hiddenCount = 0;
  const spousePositions: Position[] = [];
  const spouseKinds: string[] = [];
  const expressionPositions: Position[] = [];
  const expressionKinds: string[] = [];
  for (const position of positions) {
    const pillar = chart.pillars[position];
    const visible = names.includes(pillar.tenGodStem);
    const hidden = pillar.tenGodHiddenStems.filter(item => names.includes(item)).length;
    if (visible) visibleCount += 1;
    hiddenCount += hidden;
    if (visible || hidden) spousePositions.push(position);
    if (visible) spouseKinds.push(pillar.tenGodStem);
    spouseKinds.push(...pillar.tenGodHiddenStems.filter(item => names.includes(item)));
    const expression = [pillar.tenGodStem, ...pillar.tenGodHiddenStems].filter(item => item === "食神" || item === "伤官");
    if (expression.length) expressionPositions.push(position);
    expressionKinds.push(...expression);
  }
  const relations = analyzeChartRelations(chart);
  const spousePalaceRelations = relations
    .filter(relation => relation.participants.some(item => item.source === "day" && item.value === chart.pillars.day.branch))
    .map(relation => relation.kind);
  const derived = deriveChartFacts(chart);
  const peachPositions = unique(derived.peachBlossom.flatMap(item => item.positions));
  return {
    spouseStar: { names, count: visibleCount + hiddenCount, visibleCount, hiddenCount, positions: spousePositions, kindsPresent: unique(spouseKinds), mixed: names.every(name => spouseKinds.includes(name)) },
    spousePalace: { branch: chart.pillars.day.branch, relations: unique(spousePalaceRelations) },
    peachBlossom: { positionCount: peachPositions.length, positions: peachPositions },
    loveExpression: { tenGodsPresent: unique(expressionKinds), positions: unique(expressionPositions) },
    monthMode: { mainHiddenTenGod: chart.pillars.month.tenGodHiddenStems[0] ?? null },
  };
}

function pathValue(root: unknown, path: string): unknown {
  const normalized = path.replace(/^relationship\./, "");
  return normalized.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, root);
}

function matchesCondition(facts: RelationshipFacts, condition: AtomicCondition): boolean {
  const actual = pathValue(facts, condition.fact);
  switch (condition.operator) {
    case "equals": return actual === condition.value;
    case "exists": return actual !== undefined && actual !== null;
    case "greater_than": return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
    case "includes": return Array.isArray(actual) && actual.includes(condition.value);
    case "in": return Array.isArray(condition.value) && condition.value.includes(String(actual));
  }
}

function executeRule(rule: RelationshipRule, chart: FourPillarsChart, facts: RelationshipFacts): RuleExecution {
  if (rule.status === "review_required") return { ruleId: rule.id, status: "skipped_review_required", conditionResults: [], score: 0 };
  if (rule.appliesTo?.gender && rule.appliesTo.gender !== chart.input.gender) return { ruleId: rule.id, status: "not_matched", conditionResults: [], score: 0 };
  const conditionResults = rule.conditions.all.map(condition => ({ condition, matched: matchesCondition(facts, condition) }));
  const anyResults = (rule.conditions.any ?? []).map(condition => ({ condition, matched: matchesCondition(facts, condition) }));
  const excluded = rule.exclusions.some(condition => matchesCondition(facts, condition));
  const matched = conditionResults.every(item => item.matched) && (!anyResults.length || anyResults.some(item => item.matched));
  const enhancerCount = rule.enhancers.filter(condition => matchesCondition(facts, condition)).length;
  const reducerCount = rule.reducers.filter(condition => matchesCondition(facts, condition)).length;
  return {
    ruleId: rule.id,
    status: excluded ? "excluded" : matched ? "matched" : "not_matched",
    conditionResults: [...conditionResults, ...anyResults],
    score: excluded || !matched ? 0 : Math.max(0, Math.min(100, rule.evidencePriority + enhancerCount * 8 - reducerCount * 8)),
  };
}

function confidence(score: number, evidenceCount: number): RelationshipConclusion["confidence"] {
  if (score >= 78 && evidenceCount >= 2) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function analyzeRelationship(chart: FourPillarsChart): RelationshipAnalysis {
  const facts = deriveRelationshipFacts(chart);
  const trace = RELATIONSHIP_RULES.map(rule => executeRule(rule, chart, facts));
  const matched = trace.filter(item => item.status === "matched");
  const byTopic = new Map<string, Array<{ rule: RelationshipRule; execution: RuleExecution }>>();
  for (const execution of matched) {
    const rule = RELATIONSHIP_RULES.find(item => item.id === execution.ruleId)!;
    byTopic.set(rule.topic, [...(byTopic.get(rule.topic) ?? []), { rule, execution }]);
  }
  const conclusions = [...byTopic.entries()].map(([topic, entries]) => {
    const strongest = [...entries].sort((a, b) => b.execution.score - a.execution.score)[0]!;
    const average = entries.reduce((sum, item) => sum + item.execution.score, 0) / entries.length;
    const resultConfidence = confidence(average, entries.length);
    return {
      conclusionId: `conclusion.${topic}`,
      topic,
      summary: strongest.rule.outputs.tendency,
      positiveSignals: unique(entries.map(item => item.rule.outputs.positive)),
      riskSignals: unique(entries.map(item => item.rule.outputs.risk)),
      counterSignals: [],
      advice: unique(entries.map(item => item.rule.outputs.advice)),
      evidenceRuleIds: entries.map(item => item.rule.id),
      confidence: resultConfidence,
      applicablePeriod: "natal" as const,
      languageStrength: resultConfidence === "high" ? "strong" as const : resultConfidence === "medium" ? "normal" as const : "cautious" as const,
    };
  }).sort((a, b) => (byTopic.get(b.topic)?.[0]?.execution.score ?? 0) - (byTopic.get(a.topic)?.[0]?.execution.score ?? 0));
  return { ruleSetVersion: RELATIONSHIP_RULE_SET_VERSION, source: { baZi: chart.baZi, chartEngineVersion: chart.engineVersion }, facts, conclusions, trace };
}
