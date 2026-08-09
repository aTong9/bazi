import type {
  EarthlyBranch,
  FourPillarsChart,
  HeavenlyStem,
} from "./domain.js";

export const GANZHI_RELATIONS_VERSION = "mainstream-ganzhi-v1";

export type RelationKind =
  | "stem_generate"
  | "stem_overcome"
  | "stem_combine"
  | "stem_clash"
  | "branch_combine"
  | "branch_clash"
  | "branch_harm"
  | "branch_break"
  | "branch_punishment"
  | "branch_self_punishment"
  | "branch_three_harmony"
  | "branch_three_meeting";

export interface RelationParticipant {
  source: string;
  value: HeavenlyStem | EarthlyBranch;
}

export interface GanzhiRelation {
  algorithmVersion: typeof GANZHI_RELATIONS_VERSION;
  kind: RelationKind;
  participants: RelationParticipant[];
  resultElement?: string;
  description: string;
}

function relation(value: Omit<GanzhiRelation, "algorithmVersion">): GanzhiRelation {
  return { algorithmVersion: GANZHI_RELATIONS_VERSION, ...value };
}

const STEM_ELEMENT: Record<HeavenlyStem, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

const ELEMENT_GENERATES: Record<string, string> = {
  木: "火", 火: "土", 土: "金", 金: "水", 水: "木",
};

const ELEMENT_OVERCOMES: Record<string, string> = {
  木: "土", 土: "水", 水: "火", 火: "金", 金: "木",
};

const STEM_COMBINES: Array<[HeavenlyStem, HeavenlyStem, string]> = [
  ["甲", "己", "土"], ["乙", "庚", "金"], ["丙", "辛", "水"],
  ["丁", "壬", "木"], ["戊", "癸", "火"],
];

// A commonly used modern Zi Ping convention. Some classical schools only
// describe these as directional overcoming, so clients can distinguish the
// explicit clash label from the simultaneously returned stem_overcome result.
const STEM_CLASHES: Array<[HeavenlyStem, HeavenlyStem]> = [
  ["甲", "庚"], ["乙", "辛"], ["丙", "壬"], ["丁", "癸"],
];

const BRANCH_PAIRS: Record<
  "branch_combine" | "branch_clash" | "branch_harm" | "branch_break",
  Array<[EarthlyBranch, EarthlyBranch]>
> = {
  branch_combine: [["子", "丑"], ["寅", "亥"], ["卯", "戌"], ["辰", "酉"], ["巳", "申"], ["午", "未"]],
  branch_clash: [["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"]],
  branch_harm: [["子", "未"], ["丑", "午"], ["寅", "巳"], ["卯", "辰"], ["申", "亥"], ["酉", "戌"]],
  branch_break: [["子", "酉"], ["丑", "辰"], ["寅", "亥"], ["卯", "午"], ["巳", "申"], ["未", "戌"]],
};

const THREE_GROUPS: Array<{
  kind: "branch_three_harmony" | "branch_three_meeting" | "branch_punishment";
  branches: EarthlyBranch[];
  resultElement?: string;
}> = [
  { kind: "branch_three_harmony", branches: ["申", "子", "辰"], resultElement: "水" },
  { kind: "branch_three_harmony", branches: ["亥", "卯", "未"], resultElement: "木" },
  { kind: "branch_three_harmony", branches: ["寅", "午", "戌"], resultElement: "火" },
  { kind: "branch_three_harmony", branches: ["巳", "酉", "丑"], resultElement: "金" },
  { kind: "branch_three_meeting", branches: ["亥", "子", "丑"], resultElement: "水" },
  { kind: "branch_three_meeting", branches: ["寅", "卯", "辰"], resultElement: "木" },
  { kind: "branch_three_meeting", branches: ["巳", "午", "未"], resultElement: "火" },
  { kind: "branch_three_meeting", branches: ["申", "酉", "戌"], resultElement: "金" },
  { kind: "branch_punishment", branches: ["寅", "巳", "申"] },
  { kind: "branch_punishment", branches: ["丑", "未", "戌"] },
];

const TWO_PUNISHMENTS: Array<[EarthlyBranch, EarthlyBranch]> = [["子", "卯"]];
const SELF_PUNISHMENTS: EarthlyBranch[] = ["辰", "午", "酉", "亥"];

function pairMatches<T extends string>(a: T, b: T, pair: [T, T]): boolean {
  return (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0]);
}

function pairDescription(kind: RelationKind, a: string, b: string): string {
  const labels: Record<string, string> = {
    stem_generate: "相生", stem_overcome: "相克", stem_combine: "五合", stem_clash: "相冲",
    branch_combine: "六合", branch_clash: "六冲", branch_harm: "六害",
    branch_break: "六破", branch_punishment: "相刑", branch_self_punishment: "自刑",
  };
  return `${a}${b}${labels[kind] ?? kind}`;
}

export function analyzeStemPair(
  left: RelationParticipant,
  right: RelationParticipant,
): GanzhiRelation[] {
  const a = left.value as HeavenlyStem;
  const b = right.value as HeavenlyStem;
  const relations: GanzhiRelation[] = [];
  const combination = STEM_COMBINES.find((pair) => pairMatches(a, b, [pair[0], pair[1]]));
  if (combination) {
    relations.push(relation({
      kind: "stem_combine",
      participants: [left, right],
      resultElement: combination[2],
      description: `${a}${b}合${combination[2]}`,
    }));
  }
  if (STEM_CLASHES.some((pair) => pairMatches(a, b, pair))) {
    relations.push(relation({ kind: "stem_clash", participants: [left, right], description: `${a}${b}天干冲` }));
  }
  const aElement = STEM_ELEMENT[a];
  const bElement = STEM_ELEMENT[b];
  if (ELEMENT_GENERATES[aElement] === bElement) {
    relations.push(relation({ kind: "stem_generate", participants: [left, right], description: `${a}生${b}` }));
  } else if (ELEMENT_GENERATES[bElement] === aElement) {
    relations.push(relation({ kind: "stem_generate", participants: [right, left], description: `${b}生${a}` }));
  }
  if (ELEMENT_OVERCOMES[aElement] === bElement) {
    relations.push(relation({ kind: "stem_overcome", participants: [left, right], description: `${a}克${b}` }));
  } else if (ELEMENT_OVERCOMES[bElement] === aElement) {
    relations.push(relation({ kind: "stem_overcome", participants: [right, left], description: `${b}克${a}` }));
  }
  return relations;
}

export function analyzeBranchPair(
  left: RelationParticipant,
  right: RelationParticipant,
): GanzhiRelation[] {
  const a = left.value as EarthlyBranch;
  const b = right.value as EarthlyBranch;
  const relations: GanzhiRelation[] = [];
  for (const [kind, pairs] of Object.entries(BRANCH_PAIRS) as Array<
    [keyof typeof BRANCH_PAIRS, Array<[EarthlyBranch, EarthlyBranch]>]
  >) {
    if (pairs.some((pair) => pairMatches(a, b, pair))) {
      relations.push(relation({ kind, participants: [left, right], description: pairDescription(kind, a, b) }));
    }
  }
  if (TWO_PUNISHMENTS.some((pair) => pairMatches(a, b, pair))) {
    relations.push(relation({ kind: "branch_punishment", participants: [left, right], description: `${a}${b}无礼之刑` }));
  }
  if (a === b && SELF_PUNISHMENTS.includes(a)) {
    relations.push(relation({ kind: "branch_self_punishment", participants: [left, right], description: `${a}${b}自刑` }));
  }
  return relations;
}

export function analyzeBranchGroups(participants: RelationParticipant[]): GanzhiRelation[] {
  return THREE_GROUPS.flatMap((group) => {
    const matched = group.branches.map((branch) => participants.find((item) => item.value === branch));
    if (matched.some((item) => !item)) return [];
    const values = group.branches.join("");
    const label = group.kind === "branch_three_harmony" ? "三合" : group.kind === "branch_three_meeting" ? "三会" : "三刑";
    return [relation({
      kind: group.kind,
      participants: matched as RelationParticipant[],
      ...(group.resultElement ? { resultElement: group.resultElement } : {}),
      description: `${values}${label}${group.resultElement ?? ""}`,
    })];
  });
}

export function analyzeChartRelations(chart: FourPillarsChart): GanzhiRelation[] {
  const entries = Object.entries(chart.pillars) as Array<[string, FourPillarsChart["pillars"][keyof FourPillarsChart["pillars"]]]>;
  const stems = entries.map(([source, pillar]) => ({ source, value: pillar.stem }));
  const branches = entries.map(([source, pillar]) => ({ source, value: pillar.branch }));
  const relations: GanzhiRelation[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      relations.push(...analyzeStemPair(stems[i]!, stems[j]!));
      relations.push(...analyzeBranchPair(branches[i]!, branches[j]!));
    }
  }
  relations.push(...analyzeBranchGroups(branches));
  return relations;
}
