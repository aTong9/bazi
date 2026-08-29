import type { CanonicalCatalogRecord } from "../../catalog/src/import-catalog.js";
import { createResultItem, type DomainIssue, type ResultItem } from "../../domain/src/index.js";
import type { M02Result } from "./m02.js";
import type { M03Result } from "./m03.js";
import type { M04Result } from "./m04.js";
import type { M05Result } from "./m05.js";
import type { M06Result } from "./m06.js";

export type M19Fields = Readonly<Record<string, Readonly<ResultItem<unknown>>>>;

export interface M19Projection {
  readonly fields: M19Fields;
  readonly issues: readonly DomainIssue[];
}

export function projectM19(input: {
  contracts: readonly CanonicalCatalogRecord[];
  birthTimeStatus: "exact" | "approximate" | "unknown";
  m02: M02Result;
  m03: M03Result;
  m04: M04Result;
  m05: M05Result;
  m06: M06Result;
}): M19Projection {
  const fields: Record<string, Readonly<ResultItem<unknown>>> = {};
  for (const contract of input.contracts) {
    if (!contract.jsonKey) continue;
    fields[contract.jsonKey] = result(null, "not_assessed", "unknown", [], ["MODULE_NOT_RUN"]);
  }
  const allRules = unique([
    ...input.m02.matchedRuleIds, ...input.m03.matchedRuleIds, ...input.m04.matchedRuleIds,
    ...input.m05.matchedRuleIds, ...input.m06.matchedRuleIds,
  ]);
  set(fields, "input_validation", result(
    {
      fourPillarsProvided: true,
      birthTimeStatus: input.birthTimeStatus,
      calendarVerified: input.m03.calendarVerified,
      canContinue: true,
    },
    input.birthTimeStatus === "exact" ? "conditional" : "conditional",
    input.birthTimeStatus === "exact" ? "medium" : "medium_low",
    [...input.m02.matchedRuleIds, "M03-PROC-0018-V1.0"],
    ["FOUR_PILLARS_STRUCTURE_VALID", "CALENDAR_NOT_REVERIFIED_FROM_FOUR_PILLARS", ...(input.birthTimeStatus === "unknown" ? ["HOUR_UNKNOWN"] : [])],
  ));
  set(fields, "scope_boundary", result(
    ["NATAL_STATIC_STRUCTURE_ONLY", "NO_DYNAMIC_TIMING", "NO_MEDICAL_DIAGNOSIS", "NO_LIFESTYLE_REMEDY"],
    "supported", "high", [], ["SCOPE_BOUNDARY_ENFORCED"],
  ));
  set(fields, "overall_confidence", result(
    { level: "medium_low", pendingModules: ["M0.M07", "M0.M08", "M0.M09", "M0.M10", "M0.M11", "M0.M12", "M0.M13", "M0.M14", "M0.M15", "M0.M16", "M0.M17", "M0.M18"] },
    "conditional", "medium_low", allRules, ["S2_PARTIAL_M0_SLICE"],
  ));
  set(fields, "day_master_and_season", result(
    {
      dayMaster: input.m02.dayMaster,
      element: input.m02.pillars.day.stem.element,
      yinYang: input.m02.pillars.day.stem.yinYang,
      monthBranch: input.m02.pillars.month.branch.branch,
      seasonElement: input.m03.seasonElement,
      calendarVerified: false,
    }, "conditional", "medium", [...input.m02.matchedRuleIds, ...input.m03.matchedRuleIds], ["MONTH_BRANCH_PROVIDED_NOT_CALENDAR_REVERIFIED"],
  ));
  set(fields, "pillar_element_ten_god_map", result(
    input.m02.pillars, input.m02.status === "complete" ? "supported" : "conditional",
    input.m02.status === "complete" ? "high" : "medium_low", input.m02.matchedRuleIds,
    input.m02.status === "complete" ? [] : ["HOUR_UNKNOWN"],
  ));
  set(fields, "roots_and_exposure", result(
    { rootStatus: input.m03.rootStatus, roots: input.m03.dayMasterRoots },
    "conditional", "medium", input.m03.matchedRuleIds,
    ["ROOT_EVIDENCE_ONLY_NOT_DAY_MASTER_STRENGTH"],
  ));
  set(fields, "identified_relations", result(
    { stems: input.m04.relations, stemContentions: input.m04.contentions, branches: input.m05.relations },
    "supported", input.birthTimeStatus === "unknown" ? "medium_low" : "high",
    [...input.m04.matchedRuleIds, ...input.m05.matchedRuleIds],
    input.birthTimeStatus === "unknown" ? ["HOUR_RELATIONS_NOT_ASSESSED"] : [],
  ));
  set(fields, "relation_effects", result(
    input.m06.effects, "conditional", "medium_low", input.m06.matchedRuleIds,
    ["EFFECTS_ARE_OBJECT_LEVEL_CANDIDATES", "NO_FIXED_STRENGTH_CHANGE"],
  ));
  set(fields, "pending_or_rejected_relations", result(
    input.m06.effects.filter((effect) => effect.status === "conditional"),
    "conditional", "medium_low", input.m06.matchedRuleIds,
    ["FULL_EFFECT_THRESHOLDS_PENDING_M07_TO_M18"],
  ));
  const issues = validateM19Fields(fields, input.contracts);
  return { fields: Object.freeze(fields), issues: Object.freeze(issues) };
}

export function validateM19Fields(
  fields: Readonly<Record<string, Readonly<ResultItem<unknown>>>>,
  contracts: readonly CanonicalCatalogRecord[],
): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const expected = new Set(contracts.flatMap((contract) => contract.jsonKey ? [contract.jsonKey] : []));
  const actual = Object.keys(fields);
  if (expected.size !== 45 || actual.length !== 45) {
    issues.push(issue("E_M19_FIELD_COUNT", `M19 requires 45 fields; expected=${expected.size}, actual=${actual.length}`));
  }
  for (const key of expected) if (!(key in fields)) issues.push(issue("E_M19_FIELD_MISSING", `M19 field missing: ${key}`));
  for (const [key, item] of Object.entries(fields)) {
    if (item.status === "not_assessed" && item.value !== null) issues.push(issue("E_NOT_ASSESSED_VALUE", `${key} must have value=null`));
    if (item.status === "unknown" && (item.value !== null || item.confidence !== "unknown" || item.conditions.length === 0)) {
      issues.push(issue("E_UNKNOWN_RESULT", `${key} violates unknown-result invariants`));
    }
  }
  return issues;
}

function result(
  value: unknown,
  status: "not_assessed" | "unknown" | "candidate" | "supported" | "conditional" | "contradicted" | "stopped",
  confidence: "high" | "medium_high" | "medium" | "medium_low" | "low" | "not_applicable" | "unknown",
  ruleIds: readonly string[],
  conditions: readonly string[],
): Readonly<ResultItem<unknown>> {
  return createResultItem({
    applicability: "applicable", status, value, confidence, evidence: null,
    ruleIds: unique(ruleIds), sourceIds: unique(ruleIds), eventIds: [],
    conditions: Object.freeze([...conditions]), counterevidence: [],
  });
}

function set(fields: Record<string, Readonly<ResultItem<unknown>>>, key: string, value: Readonly<ResultItem<unknown>>): void {
  if (!(key in fields)) throw new Error(`M19 contract does not define jsonKey ${key}`);
  fields[key] = value;
}

function unique(values: readonly string[]): readonly string[] { return Object.freeze([...new Set(values)].sort()); }
function issue(code: string, message: string): DomainIssue {
  return { code, severity: "error", stage: "publication", message, retryable: false };
}
