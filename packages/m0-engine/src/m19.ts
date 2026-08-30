import type { CanonicalCatalogRecord } from "../../catalog/src/import-catalog.js";
import { createResultItem, type DomainIssue, type ResultItem } from "../../domain/src/index.js";
import type { M02Result } from "./m02.js";
import type { M03Result } from "./m03.js";
import type { M04Result } from "./m04.js";
import type { M05Result } from "./m05.js";
import type { M06Result } from "./m06.js";
import type { M07Result } from "./m07.js";
import type { M08Result } from "./m08.js";
import type { M09Result } from "./m09.js";
import type { M10Result } from "./m10.js";
import type { M11Result } from "./m11.js";
import type { M12Result } from "./m12.js";
import type { M13Result } from "./m13.js";
import type { M14Result } from "./m14.js";
import type { M15Result } from "./m15.js";
import type { M16Result } from "./m16.js";
import type { M17Result } from "./m17.js";
import type { M18Result } from "./m18.js";

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
  m07: M07Result; m08: M08Result; m09: M09Result; m10: M10Result; m11: M11Result; m12: M12Result;
  m13: M13Result; m14: M14Result; m15: M15Result; m16: M16Result; m17: M17Result; m18: M18Result;
}): M19Projection {
  const fields: Record<string, Readonly<ResultItem<unknown>>> = {};
  for (const contract of input.contracts) {
    if (!contract.jsonKey) continue;
    fields[contract.jsonKey] = result(null, "not_assessed", "unknown", [], ["MODULE_NOT_RUN"]);
  }
  const allRules = unique([
    ...input.m02.matchedRuleIds, ...input.m03.matchedRuleIds, ...input.m04.matchedRuleIds,
    ...input.m05.matchedRuleIds, ...input.m06.matchedRuleIds, ...input.m07.matchedRuleIds, ...input.m08.matchedRuleIds,
    ...input.m09.matchedRuleIds, ...input.m10.matchedRuleIds, ...input.m11.matchedRuleIds, ...input.m12.matchedRuleIds,
    ...input.m13.matchedRuleIds, ...input.m14.matchedRuleIds, ...input.m15.matchedRuleIds, ...input.m16.matchedRuleIds,
    ...input.m17.matchedRuleIds, ...input.m18.matchedRuleIds,
  ]);
  const hourDependencyFlags = input.birthTimeStatus === "unknown"
    ? ["HOUR_UNKNOWN"]
    : input.birthTimeStatus === "approximate"
      ? ["HOUR_APPROXIMATE"]
      : [];
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
    ["FOUR_PILLARS_STRUCTURE_VALID", "CALENDAR_NOT_REVERIFIED_FROM_FOUR_PILLARS", ...hourDependencyFlags],
  ));
  set(fields, "scope_boundary", result(
    ["NATAL_STATIC_STRUCTURE_ONLY", "NO_DYNAMIC_TIMING", "NO_MEDICAL_DIAGNOSIS", "NO_LIFESTYLE_REMEDY"],
    "supported", "high", [], ["SCOPE_BOUNDARY_ENFORCED"],
  ));
  set(fields, "overall_confidence", result(
    { level: input.birthTimeStatus === "exact" ? "medium" : "medium_low", pendingModules: [], conditions: hourDependencyFlags },
    input.birthTimeStatus === "exact" ? "supported" : "conditional", input.birthTimeStatus === "exact" ? "medium" : "medium_low", allRules, hourDependencyFlags,
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
  const elementRanking = Object.values(input.m08.elements).sort((a, b) => strengthRank(b.effectiveStrengthCandidate) - strengthRank(a.effectiveStrengthCandidate));
  const dominantGods = Object.values(input.m10.tenGods).filter((state) => state.effectivePower === "strong_candidate");
  const constrainedGods = Object.values(input.m10.tenGods).filter((state) => state.presence !== "absent" && state.effectivePower === "weak_candidate");
  const openPaths = input.m12.paths.filter((path) => path.status === "open");
  const blockedPaths = input.m12.paths.filter((path) => path.blockPoint);
  const primaryProblem = input.m16.problems.find((problem) => problem.severity === "primary") ?? input.m16.problems[0] ?? null;
  const secondaryProblems = input.m16.problems.filter((problem) => problem !== primaryProblem);
  const primaryUses = Object.values(input.m18.decisions).filter((decision) => decision.classification === "primary_candidate");
  const auxiliaryUses = Object.values(input.m18.decisions).filter((decision) => decision.classification === "secondary_candidate");
  set(fields, "natal_structure_summary", result({ dayMaster: input.m09.strengthCandidate, dominantElements: elementRanking.slice(0, 2), relations: input.m05.relations.length, mainPaths: openPaths.slice(0, 3), climate: { temperature: input.m13.temperature.state, humidity: input.m13.humidity.state } }, "supported", "medium", allRules, []));
  set(fields, "element_effective_strength_matrix", result(input.m08.elements, "supported", "medium", input.m08.matchedRuleIds, input.m08.pendingEffectIds.length ? ["PENDING_RELATION_EFFECTS_RETAINED"] : []));
  set(fields, "element_strength_ranking", result(elementRanking.map((item) => ({ element: item.element, strength: item.effectiveStrengthCandidate })), "conditional", "medium_low", input.m08.matchedRuleIds, ["RELATIVE_CANDIDATE_ORDER_NOT_NUMERIC_SCORE"]));
  set(fields, "strength_adjustment_reasons", result(Object.fromEntries(Object.entries(input.m08.elements).map(([element, state]) => [element, { appliedEffects: state.appliedEffects, retainedEvidence: state.retainedEvidence }])), "supported", "medium", [...input.m06.matchedRuleIds, ...input.m08.matchedRuleIds], []));
  set(fields, "day_master_strength", result(input.m09.strengthCandidate, "supported", "medium", input.m09.matchedRuleIds, ["CANDIDATE_GRADE_PRESERVES_BOUNDARY"]));
  set(fields, "support_side_evidence", result(input.m09.supportEvidence, "supported", "medium", input.m09.matchedRuleIds, input.m09.supportEvidence.length ? [] : ["NO_STRONG_SUPPORT_EVIDENCE"]));
  set(fields, "load_side_evidence", result(input.m09.burdenEvidence, "supported", "medium", input.m09.matchedRuleIds, input.m09.burdenEvidence.length ? [] : ["NO_SUSTAINED_LOAD_EVIDENCE"]));
  set(fields, "adjacent_grade_exclusion", result({ grade: input.m09.strengthCandidate, support: input.m09.supportEvidence, burden: input.m09.burdenEvidence }, "conditional", "medium_low", input.m09.matchedRuleIds, ["ADJACENT_GRADES_REMAIN_CONDITIONAL_WHEN_EVIDENCE_IS_MIXED"]));
  set(fields, "ten_god_status_matrix", result(input.m10.tenGods, "supported", "medium", input.m10.matchedRuleIds, []));
  set(fields, "dominant_ten_gods", result(dominantGods, dominantGods.length ? "supported" : "conditional", "medium", input.m10.matchedRuleIds, dominantGods.length ? [] : ["NO_SINGLE_DOMINANT_TEN_GOD"]));
  set(fields, "constrained_or_overused_ten_gods", result(constrainedGods, "supported", "medium", input.m10.matchedRuleIds, constrainedGods.length ? [] : ["NO_KEY_CONSTRAINED_TEN_GOD"]));
  set(fields, "ten_god_purity", result(Object.values(input.m10.tenGods).filter((state) => state.presence !== "absent").map((state) => ({ tenGod: state.tenGod, purity: state.purity })), "supported", "medium", input.m10.matchedRuleIds, []));
  set(fields, "established_ten_god_combinations", result(input.m11.combinations, input.m11.combinations.length ? "candidate" : "supported", "medium_low", input.m11.matchedRuleIds, input.m11.combinations.length ? ["COMBINATION_CANDIDATES_REQUIRE_PATTERN_REVIEW"] : ["NO_STABLE_COMBINATION"]));
  set(fields, "weak_or_rejected_combinations", result([], "supported", "medium", input.m11.matchedRuleIds, ["NO_REJECTED_COMBINATION_RECORDED"]));
  set(fields, "dominant_function_chain", result(input.m11.combinations.slice(0, 2), "conditional", "medium_low", [...input.m11.matchedRuleIds, ...input.m12.matchedRuleIds], input.m11.combinations.length ? ["DOMINANCE_REQUIRES_ROUTE_COMPARISON"] : ["SINGLE_POINT_FUNCTIONS_ONLY"]));
  set(fields, "main_flow_path", result(openPaths.slice(0, 3), openPaths.length ? "supported" : "conditional", "medium", input.m12.matchedRuleIds, openPaths.length ? [] : ["NO_COMPLETE_MAIN_PATH"]));
  set(fields, "primary_flow_block", result(blockedPaths[0] ?? null, blockedPaths.length ? "supported" : "conditional", "medium", input.m12.matchedRuleIds, blockedPaths.length ? [] : ["NO_PRIMARY_FLOW_BLOCK"]));
  set(fields, "secondary_blocks_and_alternatives", result(blockedPaths.slice(1), "supported", "medium", input.m12.matchedRuleIds, blockedPaths.length > 1 ? [] : ["NO_INDEPENDENT_SECONDARY_BLOCK"]));
  set(fields, "bridge_candidates_and_side_effects", result(input.m12.bridgeCandidates.map((element) => ({ element, sideEffects: input.m17.matrix[element].sideEffects, decision: input.m18.decisions[element] })), "conditional", "medium_low", [...input.m12.matchedRuleIds, ...input.m18.matchedRuleIds], input.m12.bridgeCandidates.length ? ["BRIDGE_CANDIDATES_REQUIRE_SIDE_EFFECT_REVIEW"] : ["NO_DEDICATED_BRIDGE_REQUIRED"]));
  set(fields, "temperature_state", result(input.m13.temperature, "supported", "medium", input.m13.matchedRuleIds, []));
  set(fields, "moisture_state", result(input.m13.humidity, "supported", "medium", input.m13.matchedRuleIds, []));
  set(fields, "climate_problem_and_urgency", result(input.m16.problems.filter((problem) => problem.type === "climate"), "conditional", "medium_low", [...input.m13.matchedRuleIds, ...input.m16.matchedRuleIds], input.m16.problems.some((problem) => problem.type === "climate") ? ["CLIMATE_URGENCY_REQUIRES_NET_EFFECT_REVIEW"] : ["CLIMATE_IS_BACKGROUND_NOT_PRIMARY_DISEASE"]));
  set(fields, "climate_candidates_and_conflicts", result({ temperature: input.m13.temperature.candidateElements, humidity: input.m13.humidity.candidateElements, conflicts: input.m13.conflicts }, "conditional", "medium_low", [...input.m13.matchedRuleIds, ...input.m18.matchedRuleIds], ["CLIMATE_CANDIDATES_REQUIRE_NET_BENEFIT_REVIEW"]));
  set(fields, "pattern_candidates", result(input.m14.candidates, input.m14.candidates.length ? "candidate" : "conditional", "medium_low", input.m14.matchedRuleIds, input.m14.candidates.length ? [] : ["NO_STABLE_PATTERN_CANDIDATE"]));
  set(fields, "final_pattern", result(input.m15.evaluations, "conditional", "medium_low", [...input.m15.matchedRuleIds, ...input.m18.matchedRuleIds], ["PATTERN_STATE_SEPARATE_FROM_RANK"]));
  set(fields, "pattern_evidence_and_level", result(input.m15.evaluations.map((item) => ({ name: item.name, formation: item.formation, purity: item.purity, conditions: item.conditions })), "conditional", "medium_low", input.m15.matchedRuleIds, ["PATTERN_EVIDENCE_DOES_NOT_IMPLY_FINAL_PATTERN"]));
  set(fields, "pattern_failure_factors", result(input.m15.evaluations.flatMap((item) => item.damage.map((damage) => ({ pattern: item.name, damage }))), "supported", "medium", input.m15.matchedRuleIds, []));
  set(fields, "pattern_rescue_and_alternatives", result(input.m15.evaluations.map((item) => ({ pattern: item.name, rescue: item.rescue })), "conditional", "medium_low", [...input.m15.matchedRuleIds, ...input.m18.matchedRuleIds], ["RESCUE_EFFECTIVENESS_REQUIRES_VALIDATION"]));
  set(fields, "root_disease", result(primaryProblem, primaryProblem?.severity === "primary" ? "supported" : "conditional", "medium", input.m16.matchedRuleIds, primaryProblem?.severity === "primary" ? [] : ["NO_STRUCTURAL_PRIMARY_DISEASE_PROVEN"]));
  set(fields, "secondary_diseases", result(secondaryProblems, "supported", "medium", input.m16.matchedRuleIds, secondaryProblems.length ? [] : ["NO_INDEPENDENT_SECONDARY_DISEASE"]));
  set(fields, "primary_and_auxiliary_medicine", result(input.m16.medicines, "conditional", "medium_low", [...input.m16.matchedRuleIds, ...input.m18.matchedRuleIds], input.m16.medicines.length ? ["MEDICINE_REQUIRES_ROUTE_AND_DOSE"] : ["NO_MEDICINE_REQUIRED"]));
  set(fields, "medicine_risks", result(input.m16.medicines.map((medicine) => ({ element: medicine.element, risk: medicine.overdoseRisk, decision: input.m18.decisions[medicine.element] })), "supported", "medium", [...input.m16.matchedRuleIds, ...input.m18.matchedRuleIds], []));
  set(fields, "five_element_use_matrix", result(input.m17.matrix, "supported", "medium", [...input.m17.matchedRuleIds, ...input.m18.matchedRuleIds], []));
  set(fields, "primary_and_auxiliary_use", result({ primary: primaryUses, auxiliary: auxiliaryUses }, primaryUses.length ? "supported" : "conditional", "medium_low", input.m18.matchedRuleIds, primaryUses.length ? [] : ["NO_SINGLE_PRIMARY_USE;CONDITIONAL_CANDIDATES_RETAINED"]));
  set(fields, "favorable_unfavorable_roles", result(Object.values(input.m18.decisions), "supported", "medium", input.m18.matchedRuleIds, []));
  set(fields, "final_structure_summary", result({ dayMaster: input.m09.strengthCandidate, patterns: input.m15.evaluations, primaryProblem, mainPaths: openPaths.slice(0, 3), climate: { temperature: input.m13.temperature.state, humidity: input.m13.humidity.state }, useDecisions: input.m18.decisions, boundary: "NATAL_STATIC_STRUCTURE_ONLY" }, "supported", "medium", allRules, input.birthTimeStatus === "unknown" ? ["HOUR_UNKNOWN_LIMITS_POSITIONAL_CONCLUSIONS"] : []));
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
function strengthRank(value: "weak_candidate" | "balanced_candidate" | "strong_candidate"): number {
  return value === "strong_candidate" ? 3 : value === "balanced_candidate" ? 2 : 1;
}
function issue(code: string, message: string): DomainIssue {
  return { code, severity: "error", stage: "publication", message, retryable: false };
}
