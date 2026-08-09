import type { Gender } from "./domain.js";

export type RuleStatus = "approved" | "review_required";
export type RuleOperator = "equals" | "in" | "includes" | "exists" | "greater_than";

export interface AtomicCondition {
  fact: string;
  operator: RuleOperator;
  value?: string | number | boolean | string[];
}

export interface RelationshipRule {
  id: string;
  version: number;
  status: RuleStatus;
  topic: string;
  title: string;
  appliesTo?: { gender?: Gender };
  conditions: { all: AtomicCondition[]; any?: AtomicCondition[] };
  enhancers: AtomicCondition[];
  reducers: AtomicCondition[];
  exclusions: AtomicCondition[];
  evidencePriority: number;
  confidence: "low" | "medium" | "high";
  outputs: { tendency: string; positive: string; risk: string; advice: string };
  languageConstraints: { forbidden: string[] };
  dependencies: string[];
  source: { file: string; section: string };
}

const ABSOLUTE_TERMS = ["一定", "注定", "必然", "绝对", "肯定离婚", "克死"];

export function validateRelationshipRule(rule: RelationshipRule): string[] {
  const errors: string[] = [];
  if (!/^relationship\.[a-z0-9_.-]+$/.test(rule.id)) errors.push("id must use relationship.* namespacing");
  if (!Number.isInteger(rule.version) || rule.version < 1) errors.push("version must be a positive integer");
  if (!rule.conditions.all.length) errors.push("conditions.all must contain at least one atomic condition");
  if (rule.evidencePriority < 0 || rule.evidencePriority > 100) errors.push("evidencePriority must be between 0 and 100");
  if (!rule.source.file || !rule.source.section) errors.push("source file and section are required");
  const prose = Object.values(rule.outputs).join(" ");
  for (const term of ABSOLUTE_TERMS) if (prose.includes(term)) errors.push(`output contains forbidden absolute term: ${term}`);
  if (rule.status === "approved" && rule.dependencies.some(item => item.startsWith("research."))) {
    errors.push("approved rules cannot depend on unresolved research facts");
  }
  return errors;
}

export function validateRuleSet(rules: RelationshipRule[]): string[] {
  const errors = rules.flatMap(rule => validateRelationshipRule(rule).map(error => `${rule.id}: ${error}`));
  const ids = new Set<string>();
  for (const rule of rules) {
    if (ids.has(rule.id)) errors.push(`${rule.id}: duplicate id`);
    ids.add(rule.id);
  }
  return errors;
}
