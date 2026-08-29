import type { PillarPosition } from "./m02.js";
import type { M03Result } from "./m03.js";
import type { M04Result, StemRelationInstance } from "./m04.js";
import type { BranchRelationInstance, M05Result } from "./m05.js";

export type RelationEffectKind =
  | "combination_pull" | "transformation_candidate" | "control_expenditure" | "control_pressure"
  | "binding_candidate" | "configuration_candidate" | "configuration_tendency"
  | "activation_candidate" | "opening_storage_candidate" | "punishment_activation_candidate"
  | "self_punishment_candidate" | "obstruction_candidate" | "connection_instability_candidate"
  | "root_damage_candidate";

export interface ObjectEffect {
  readonly id: string;
  readonly relationId: string;
  readonly objectRef: PillarPosition;
  readonly effect: RelationEffectKind;
  readonly status: "candidate" | "conditional" | "supported" | "contradicted";
  readonly ruleIds: readonly string[];
  readonly conditions: readonly string[];
  readonly counterevidence: readonly string[];
}

export interface RelationEffectEvidence {
  readonly objectStrength?: Partial<Record<PillarPosition, "strong" | "weak" | "unknown">>;
  readonly transformation?: "supported" | "vetoed" | "contested" | "unknown";
  readonly openingStorage?: "supported" | "unsupported" | "unknown";
  readonly uniqueRootTarget?: PillarPosition;
}
export interface M06EvidenceContext {
  readonly byRelationId: Readonly<Record<string, RelationEffectEvidence>>;
}

export interface M06Result {
  readonly moduleId: "M0.M06";
  readonly status: "partial";
  readonly effects: readonly ObjectEffect[];
  readonly matchedRuleIds: readonly string[];
  readonly decisionLog: readonly {
    decision: "preserve" | "defer";
    relationId: string;
    reason: string;
  }[];
  readonly forbiddenConclusions: readonly ["final_strength", "pattern", "favorability", "useful_god"];
}

const BOUNDARY_RULES = Array.from({ length: 10 }, (_, index) => `M06-BOUND-${String(index + 111).padStart(4, "0")}-V1.0`);

export function analyzeM06(m03: M03Result, m04: M04Result, m05: M05Result, context?: M06EvidenceContext): M06Result {
  const effects: ObjectEffect[] = [];
  const matched = new Set<string>(BOUNDARY_RULES);
  const decisions: M06Result["decisionLog"][number][] = [];
  for (const relation of m04.relations) {
    const evidence = context?.byRelationId[relation.id];
    if (relation.type === "stem_combine") addStemCombineEffects(relation, m03, effects, matched, evidence);
    else addStemControlEffects(relation, effects, matched);
    decisions.push({ decision: "defer", relationId: relation.id, reason: "effect_requires_strength_and_channel_comparison" });
  }
  if (m04.contentions.length > 0) {
    matched.add("M06-TGHE-0010-V1.0");
    matched.add("M06-TGHUA-0020-V1.0");
  }
  for (const relation of m05.relations) {
    addBranchEffects(relation, effects, matched, context?.byRelationId[relation.id]);
    decisions.push({ decision: "preserve", relationId: relation.id, reason: "all_relation_instances_remain_independent_candidates" });
  }
  const participation = new Map<PillarPosition, number>();
  for (const effect of effects) participation.set(effect.objectRef, (participation.get(effect.objectRef) ?? 0) + 1);
  if ([...participation.values()].some((count) => count > 1)) matched.add("M06-OVER-0104-V1.0");
  if (m05.relations.filter((relation) => relation.branches.includes("巳") && relation.branches.includes("申")).length >= 3) {
    matched.add("M06-OVER-0105-V1.0");
  }
  return {
    moduleId: "M0.M06",
    status: "partial",
    effects: Object.freeze(effects.sort((a, b) => a.id.localeCompare(b.id))),
    matchedRuleIds: Object.freeze([...matched].sort()),
    decisionLog: Object.freeze(decisions),
    forbiddenConclusions: ["final_strength", "pattern", "favorability", "useful_god"],
  };
}

function addStemCombineEffects(
  relation: StemRelationInstance,
  m03: M03Result,
  effects: ObjectEffect[],
  matched: Set<string>,
  evidence?: RelationEffectEvidence,
): void {
  matched.add("M06-TGHE-0001-V1.0");
  const distanceRule = relation.distance === "adjacent" ? "M06-TGHE-0002-V1.0" : relation.distance === "separated" ? "M06-TGHE-0003-V1.0" : "M06-TGHE-0004-V1.0";
  matched.add(distanceRule);
  const transformRule = transformationRule(relation.candidateElement);
  for (const position of relation.positions) {
    const strengths = evidence?.objectStrength;
    const participantStrength = strengths?.[position];
    const otherPosition = relation.positions.find((candidate) => candidate !== position);
    const otherStrength = otherPosition ? strengths?.[otherPosition] : undefined;
    const weaker = participantStrength === "weak" && otherStrength === "strong";
    if (weaker) matched.add("M06-TGHE-0005-V1.0");
    effects.push(effect(
      relation.id, position, "combination_pull", weaker ? "supported" : "candidate",
      weaker ? ["M06-TGHE-0001-V1.0", distanceRule, "M06-TGHE-0005-V1.0"] : ["M06-TGHE-0001-V1.0", distanceRule],
      weaker ? ["WEAKER_PARTICIPANT_MORE_RESTRAINED"] : [],
      ["RELATION_RECOGNITION_DOES_NOT_PROVE_TRANSFORMATION"],
    ));
    const roots = m03.dayMasterRoots.filter((root) => root.position === position && root.kind === "direct");
    const transformationStatus = evidence?.transformation === "supported"
      ? "supported"
      : evidence?.transformation === "vetoed" || evidence?.transformation === "contested"
        ? "contradicted"
        : "conditional";
    if (evidence?.transformation === "contested") {
      matched.add("M06-TGHE-0010-V1.0");
      matched.add("M06-TGHUA-0020-V1.0");
    }
    effects.push(effect(
      relation.id, position, "transformation_candidate", transformationStatus,
      ["M06-TGHUA-0011-V1.0", transformRule],
      evidence?.transformation === "supported" ? ["TRANSFORMATION_THRESHOLDS_SATISFIED"] : ["TRANSFORMATION_REQUIRES_CARRIER_ROOT_TREND_AND_NO_VETO"],
      evidence?.transformation === "vetoed" ? ["TRANSFORMATION_VETOED"]
        : evidence?.transformation === "contested" ? ["CONTENTION_PREVENTS_EXCLUSIVE_TRANSFORMATION"]
          : roots.length > 0 ? ["PARTICIPANT_HAS_DIRECT_ROOT"] : ["FULL_TRANSFORMATION_THRESHOLDS_NOT_EVALUATED"],
    ));
  }
  matched.add("M06-TGHUA-0011-V1.0");
  matched.add(transformRule);
}

function addStemControlEffects(relation: StemRelationInstance, effects: ObjectEffect[], matched: Set<string>): void {
  matched.add("M06-TGKE-0023-V1.0");
  matched.add("M06-TGKE-0030-V1.0");
  effects.push(effect(relation.id, relation.positions[0], "control_expenditure", "conditional", ["M06-TGKE-0023-V1.0", "M06-TGKE-0030-V1.0"], ["COMPARE_BOTH_PARTIES"], []));
  effects.push(effect(relation.id, relation.positions[1], "control_pressure", "conditional", ["M06-TGKE-0023-V1.0", "M06-TGKE-0030-V1.0"], ["COMPARE_BOTH_PARTIES"], []));
}

function addBranchEffects(relation: BranchRelationInstance, effects: ObjectEffect[], matched: Set<string>, evidence?: RelationEffectEvidence): void {
  const mapping: Record<BranchRelationInstance["type"], { effect: RelationEffectKind; rules: readonly string[]; status: "candidate" | "conditional" }> = {
    six_harmony: { effect: "binding_candidate", rules: ["M06-LIUHE-0031-V1.0", harmonyDirectionRule(relation.branches)], status: "conditional" },
    three_harmony: { effect: "configuration_candidate", rules: ["M06-SANHE-0043-V1.0", threeHarmonyDirectionRule(relation.branches)], status: "conditional" },
    half_harmony: { effect: "configuration_tendency", rules: ["M06-BANGONG-0059-V1.0", "M06-BANGONG-0061-V1.0"], status: "candidate" },
    arch_harmony: { effect: "configuration_tendency", rules: ["M06-BANGONG-0062-V1.0", "M06-BANGONG-0064-V1.0"], status: "candidate" },
    three_meeting: { effect: "configuration_candidate", rules: ["M06-SANHUI-0053-V1.0", threeMeetingDirectionRule(relation.branches)], status: "conditional" },
    three_meeting_partial: { effect: "configuration_tendency", rules: ["M06-SANHUI-0053-V1.0"], status: "candidate" },
    clash: { effect: "activation_candidate", rules: ["M06-CHONG-0065-V1.0", "M06-CHONG-0081-V1.0"], status: "candidate" },
    local_punishment: { effect: "punishment_activation_candidate", rules: ["M06-XING-0083-V1.0"], status: "candidate" },
    three_punishment: { effect: "punishment_activation_candidate", rules: ["M06-XING-0083-V1.0", relation.branches.includes("寅") ? "M06-XING-0084-V1.0" : "M06-XING-0086-V1.0"], status: "candidate" },
    self_punishment: { effect: "self_punishment_candidate", rules: ["M06-ZIXING-0092-V1.0"], status: "candidate" },
    harm: { effect: "obstruction_candidate", rules: ["M06-HAI-0096-V1.0"], status: "candidate" },
    break: { effect: "connection_instability_candidate", rules: ["M06-PO-0100-V1.0"], status: "candidate" },
  };
  const selected = mapping[relation.type];
  selected.rules.forEach((ruleId) => matched.add(ruleId));
  for (const position of relation.positions) {
    effects.push(effect(relation.id, position, selected.effect, selected.status, selected.rules, ["OBJECT_LEVEL_EFFECT_REQUIRES_EVIDENCE_COMPARISON"], ["NO_FIXED_STRENGTH_CHANGE"]));
    if (
      relation.type === "clash" && evidence?.uniqueRootTarget === position &&
      evidence.objectStrength?.[position] === "weak" &&
      relation.positions.some((candidate) => candidate !== position && evidence.objectStrength?.[candidate] === "strong")
    ) {
      matched.add("M06-CHONG-0071-V1.0");
      matched.add("M06-CHONG-0082-V1.0");
      effects.push(effect(relation.id, position, "root_damage_candidate", "supported", ["M06-CHONG-0071-V1.0", "M06-CHONG-0082-V1.0"], ["UNIQUE_WEAK_ROOT_STRUCK_BY_STRONG_BRANCH"], []));
    }
    if (relation.type === "clash" && relation.branches.every((branch) => ["辰", "戌", "丑", "未"].includes(branch))) {
      matched.add("M06-CHONG-0078-V1.0");
      const openingStatus = evidence?.openingStorage === "supported" ? "supported" : evidence?.openingStorage === "unsupported" ? "contradicted" : "candidate";
      if (openingStatus === "supported") matched.add("M06-CHONG-0079-V1.0");
      effects.push(effect(
        relation.id, position, "opening_storage_candidate", openingStatus,
        openingStatus === "supported" ? ["M06-CHONG-0078-V1.0", "M06-CHONG-0079-V1.0"] : ["M06-CHONG-0078-V1.0"],
        openingStatus === "supported" ? ["STORAGE_CONTENT_AND_RECEIVING_PATH_CONFIRMED"] : ["STORAGE_CONTENT_AND_RECEIVING_PATH_REQUIRED"],
        openingStatus === "supported" ? [] : ["OPENING_NOT_PROVEN"],
      ));
    }
  }
}

function effect(
  relationId: string,
  objectRef: PillarPosition,
  effectKind: RelationEffectKind,
  status: "candidate" | "conditional" | "supported" | "contradicted",
  ruleIds: readonly string[],
  conditions: readonly string[],
  counterevidence: readonly string[],
): ObjectEffect {
  return {
    id: `M06:${relationId}:${objectRef}:${effectKind}`,
    relationId, objectRef, effect: effectKind, status,
    ruleIds: Object.freeze([...ruleIds]), conditions: Object.freeze([...conditions]), counterevidence: Object.freeze([...counterevidence]),
  };
}

function transformationRule(element: string | undefined): string {
  return ({ 土: "M06-TGHUA-0012-V1.0", 金: "M06-TGHUA-0013-V1.0", 水: "M06-TGHUA-0014-V1.0", 木: "M06-TGHUA-0015-V1.0", 火: "M06-TGHUA-0016-V1.0" } as Record<string, string>)[element ?? ""] ?? "M06-TGHUA-0011-V1.0";
}
function harmonyDirectionRule(branches: readonly string[]): string {
  const key = [...branches].sort().join("");
  return ({ 丑子:35, 亥寅:36, 卯戌:37, 辰酉:38, 巳申:39, 午未:40 } as Record<string, number>)[key]
    ? `M06-LIUHE-${String(({ 丑子:35, 亥寅:36, 卯戌:37, 辰酉:38, 巳申:39, 午未:40 } as Record<string, number>)[key]).padStart(4,"0")}-V1.0`
    : "M06-LIUHE-0031-V1.0";
}
function threeHarmonyDirectionRule(branches: readonly string[]): string {
  const set = new Set(branches); const index = set.has("申") && set.has("子") && set.has("辰") ? 44 : set.has("亥") && set.has("卯") && set.has("未") ? 45 : set.has("寅") && set.has("午") && set.has("戌") ? 46 : 47;
  return `M06-SANHE-${String(index).padStart(4,"0")}-V1.0`;
}
function threeMeetingDirectionRule(branches: readonly string[]): string {
  const set = new Set(branches); const index = set.has("亥") ? 54 : set.has("寅") ? 55 : set.has("巳") ? 56 : 57;
  return `M06-SANHUI-${String(index).padStart(4,"0")}-V1.0`;
}
