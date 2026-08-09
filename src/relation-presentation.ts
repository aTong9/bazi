import type { GanzhiRelation, RelationKind } from "./relations.js";

export const NATAL_RELATION_PRESENTATION_VERSION = "natal-relations-reference-v1";

export type NatalRelationGroup = "combination" | "tension" | "elemental";

export interface PresentedNatalRelation {
  relation: GanzhiRelation;
  group: NatalRelationGroup;
  groupLabel: string;
  label: string;
  positions: string;
  note: string;
  priority: number;
  judgment: "structure_only" | "transformation_review_required";
}

const POSITION_LABELS: Record<string, string> = {
  year: "年柱", month: "月柱", day: "日柱", hour: "时柱",
};

const LABELS: Record<RelationKind, string> = {
  stem_generate: "天干相生",
  stem_overcome: "天干相克",
  stem_combine: "天干五合",
  stem_clash: "天干四冲",
  branch_combine: "地支六合",
  branch_clash: "地支六冲",
  branch_harm: "地支六害",
  branch_break: "地支六破",
  branch_punishment: "地支相刑",
  branch_self_punishment: "地支自刑",
  branch_three_harmony: "地支三合",
  branch_three_meeting: "地支三会",
};

const COMBINATION_KINDS = new Set<RelationKind>([
  "stem_combine", "branch_combine", "branch_three_harmony", "branch_three_meeting",
]);

const TENSION_KINDS = new Set<RelationKind>([
  "stem_clash", "branch_clash", "branch_harm", "branch_break",
  "branch_punishment", "branch_self_punishment",
]);

const PRIORITY: Record<RelationKind, number> = {
  branch_three_meeting: 300,
  branch_three_harmony: 290,
  branch_combine: 280,
  branch_punishment: 250,
  branch_self_punishment: 245,
  branch_clash: 240,
  branch_harm: 230,
  branch_break: 220,
  stem_combine: 200,
  stem_clash: 190,
  stem_overcome: 110,
  stem_generate: 100,
};

function sourceLabel(source: string): string {
  const position = source.split(":", 1)[0] ?? source;
  return POSITION_LABELS[position] ?? source;
}

function interpretationNote(kind: RelationKind): string {
  if (kind === "stem_combine") {
    return "已识别五合配对；是否合化仍需结合相邻、根气、透干及化神条件，当前不自动判定。";
  }
  if (kind === "branch_combine") {
    return "已识别六合配对；是否合化仍需结合相邻、得令、透干及附近冲刑，当前不自动判定。";
  }
  if (kind === "branch_three_harmony" || kind === "branch_three_meeting") {
    return `三支齐见，形成${kind === "branch_three_meeting" ? "三会" : "三合"}结构；是否成局、化局仍需结合月令与全局力量。`;
  }
  if (TENSION_KINDS.has(kind)) {
    return "仅表示原局存在该结构关系；实际强弱、喜忌与现实含义需结合全局判断，不据此直接判吉凶。";
  }
  return "展示五行生克的结构方向；不单独推导强弱、喜忌或具体事件。";
}

export function presentNatalRelations(relations: GanzhiRelation[]): PresentedNatalRelation[] {
  return relations.map((relation) => {
    const group: NatalRelationGroup = COMBINATION_KINDS.has(relation.kind)
      ? "combination"
      : TENSION_KINDS.has(relation.kind) ? "tension" : "elemental";
    const judgment: PresentedNatalRelation["judgment"] = COMBINATION_KINDS.has(relation.kind)
      ? "transformation_review_required"
      : "structure_only";
    return {
      relation,
      group,
      groupLabel: group === "combination" ? "合会候选" : group === "tension" ? "冲刑害破" : "五行生克",
      label: LABELS[relation.kind],
      positions: relation.participants.map((participant) => sourceLabel(participant.source)).join(" · "),
      note: interpretationNote(relation.kind),
      priority: PRIORITY[relation.kind],
      judgment,
    };
  }).sort((left, right) => right.priority - left.priority);
}
