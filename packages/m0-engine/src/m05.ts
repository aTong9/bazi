import type { EarthlyBranch } from "../../domain/src/birth-input.js";
import type { PillarPosition } from "./m02.js";

export type BranchRelationType =
  | "six_harmony" | "three_harmony" | "half_harmony" | "arch_harmony"
  | "three_meeting" | "three_meeting_partial" | "clash" | "local_punishment"
  | "three_punishment" | "self_punishment" | "harm" | "break";

export interface BranchNode { readonly position: PillarPosition; readonly branch: EarthlyBranch }
export interface BranchRelationInstance {
  readonly id: string;
  readonly type: BranchRelationType;
  readonly positions: readonly PillarPosition[];
  readonly branches: readonly EarthlyBranch[];
  readonly completeness: "pair" | "partial" | "complete";
  readonly ruleId: string;
  readonly status: "recognized" | "candidate";
}
export interface M05Result {
  readonly moduleId: "M0.M05";
  readonly status: "complete";
  readonly relations: readonly BranchRelationInstance[];
  readonly matchedRuleIds: readonly string[];
  readonly forbiddenConclusions: readonly ["transformation", "strength_change", "priority"];
}

interface Definition {
  type: BranchRelationType;
  members: readonly EarthlyBranch[];
  ruleId: string;
  completeness: BranchRelationInstance["completeness"];
  absent?: EarthlyBranch;
}

const DEFINITIONS: readonly Definition[] = [
  ...pairs("six_harmony", [["子","丑"],["寅","亥"],["卯","戌"],["辰","酉"],["巳","申"],["午","未"]], "LIUHE", 1),
  ...triples("three_harmony", [["申","子","辰"],["亥","卯","未"],["寅","午","戌"],["巳","酉","丑"]], "SANHE", 7),
  ...conditionalPairs("half_harmony", [["申","子","辰"],["子","辰","申"],["亥","卯","未"],["卯","未","亥"],["寅","午","戌"],["午","戌","寅"],["巳","酉","丑"],["酉","丑","巳"]], "BANHE", 11),
  ...conditionalPairs("arch_harmony", [["申","辰","子"],["亥","未","卯"],["寅","戌","午"],["巳","丑","酉"]], "GONGHE", 19),
  ...triples("three_meeting", [["亥","子","丑"],["寅","卯","辰"],["巳","午","未"],["申","酉","戌"]], "SANHUI", 23),
  ...pairs("clash", [["子","午"],["丑","未"],["寅","申"],["卯","酉"],["辰","戌"],["巳","亥"]], "CHONG", 27),
  ...conditionalPairs("local_punishment", [["寅","巳","申"],["巳","申","寅"],["寅","申","巳"],["丑","戌","未"],["戌","未","丑"],["丑","未","戌"]], "XING", 33),
  ...triples("three_punishment", [["寅","巳","申"],["丑","未","戌"]], "XING", 36, [0,4]),
  { type: "local_punishment", members: ["子","卯"], ruleId: "M05-XING-0041-V1.0", completeness: "pair" },
  ...selfPairs([["辰",42],["午",43],["酉",44],["亥",45]]),
  ...pairs("harm", [["子","未"],["丑","午"],["寅","巳"],["卯","辰"],["申","亥"],["酉","戌"]], "HAI", 46),
  ...pairs("break", [["子","酉"],["丑","辰"],["寅","亥"],["卯","午"],["巳","申"],["未","戌"]], "PO", 52),
];

const MEETING_GROUPS: readonly EarthlyBranch[][] = [["亥","子","丑"],["寅","卯","辰"],["巳","午","未"],["申","酉","戌"]];
const POSITION_RULES: Record<string, string> = {
  "year:month": "M05-POS-0058-V1.0", "month:day": "M05-POS-0059-V1.0", "day:hour": "M05-POS-0060-V1.0",
  "year:day": "M05-POS-0061-V1.0", "month:hour": "M05-POS-0062-V1.0", "year:hour": "M05-POS-0063-V1.0",
};
const POSITIONS: readonly PillarPosition[] = ["year", "month", "day", "hour"];

export function analyzeM05(nodesInput: readonly BranchNode[]): M05Result {
  const nodes = [...nodesInput].sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position));
  const present = new Set(nodes.map((node) => node.branch));
  const relations: BranchRelationInstance[] = [];
  const matched = new Set<string>([
    "M05-BOUND-0064-V1.0", "M05-BOUND-0065-V1.0", "M05-BOUND-0066-V1.0", "M05-BOUND-0067-V1.0",
    "M05-OVER-0068-V1.0", "M05-OVER-0069-V1.0", "M05-BOUND-0070-V1.0", "M05-BOUND-0074-V1.0",
    "M05-BOUND-0075-V1.0", "M05-BOUND-0076-V1.0", "M05-BOUND-0077-V1.0", "M05-BOUND-0078-V1.0",
    "M05-BOUND-0079-V1.0", "M05-BOUND-0080-V1.0", "M05-BOUND-0087-V1.0", "M05-BOUND-0089-V1.0",
    "M05-BOUND-0090-V1.0",
  ]);
  for (const definition of DEFINITIONS) {
    if (definition.absent && present.has(definition.absent)) continue;
    if (!definition.members.every((member) => present.has(member))) continue;
    for (const participants of participantSets(nodes, definition.members)) {
      const positions = participants.map((node) => node.position);
      const branches = participants.map((node) => node.branch);
      relations.push({
        id: `M05:${definition.type}:${positions.join("-")}:${branches.join("")}`,
        type: definition.type,
        positions: Object.freeze(positions),
        branches: Object.freeze(branches),
        completeness: definition.completeness,
        ruleId: definition.ruleId,
        status: definition.completeness === "partial" ? "candidate" : "recognized",
      });
      matched.add(definition.ruleId);
      if (positions.length === 2) {
        const key = [...positions].sort((a, b) => POSITIONS.indexOf(a) - POSITIONS.indexOf(b)).join(":");
        const positionRule = POSITION_RULES[key];
        if (positionRule) matched.add(positionRule);
      }
    }
  }
  for (const group of MEETING_GROUPS) {
    const available = group.filter((branch) => present.has(branch));
    if (available.length === 2) {
      for (const participants of participantSets(nodes, available)) {
        const positions = participants.map((node) => node.position);
        relations.push({
          id: `M05:three_meeting_partial:${positions.join("-")}:${available.join("")}`,
          type: "three_meeting_partial",
          positions: Object.freeze(positions), branches: Object.freeze([...available]),
          completeness: "partial", ruleId: "M05-BOUND-0088-V1.0", status: "candidate",
        });
        matched.add("M05-BOUND-0088-V1.0");
      }
    }
  }
  addOverlapRules(relations, matched);
  const unique = new Map(relations.map((relation) => [relation.id, relation]));
  return {
    moduleId: "M0.M05",
    status: "complete",
    relations: Object.freeze([...unique.values()].sort((a, b) => a.id.localeCompare(b.id))),
    matchedRuleIds: Object.freeze([...matched].sort()),
    forbiddenConclusions: ["transformation", "strength_change", "priority"],
  };
}

function participantSets(nodes: readonly BranchNode[], members: readonly EarthlyBranch[]): BranchNode[][] {
  if (members.length === 2 && members[0] === members[1]) {
    const candidates = nodes.filter((node) => node.branch === members[0]);
    const pairsResult: BranchNode[][] = [];
    for (let left = 0; left < candidates.length; left += 1) for (let right = left + 1; right < candidates.length; right += 1) {
      const a = candidates[left]; const b = candidates[right]; if (a && b) pairsResult.push([a, b]);
    }
    return pairsResult;
  }
  let result: BranchNode[][] = [[]];
  for (const member of members) {
    const matches = nodes.filter((node) => node.branch === member);
    result = result.flatMap((partial) => matches.map((node) => [...partial, node]));
  }
  return result;
}

function pairs(type: BranchRelationType, values: readonly (readonly [EarthlyBranch,EarthlyBranch])[], prefix: string, start: number): Definition[] {
  return values.map((members, index) => ({ type, members, ruleId: rule(prefix, start + index), completeness: "pair" }));
}
function triples(type: BranchRelationType, values: readonly (readonly [EarthlyBranch,EarthlyBranch,EarthlyBranch])[], prefix: string, start: number, offsets?: readonly number[]): Definition[] {
  return values.map((members, index) => ({ type, members, ruleId: rule(prefix, start + (offsets?.[index] ?? index)), completeness: "complete" }));
}
function conditionalPairs(type: BranchRelationType, values: readonly (readonly [EarthlyBranch,EarthlyBranch,EarthlyBranch])[], prefix: string, start: number): Definition[] {
  return values.map(([left,right,absent], index) => ({ type, members: [left,right], absent, ruleId: rule(prefix, start + index), completeness: type === "local_punishment" ? "pair" : "partial" }));
}
function selfPairs(values: readonly (readonly [EarthlyBranch,number])[]): Definition[] {
  return values.map(([member,index]) => ({ type: "self_punishment", members: [member,member], ruleId: rule("ZIXING",index), completeness: "pair" }));
}
function rule(prefix: string, index: number): string { return `M05-${prefix}-${String(index).padStart(4,"0")}-V1.0`; }

function addOverlapRules(relations: readonly BranchRelationInstance[], matched: Set<string>): void {
  const typesFor = (a: EarthlyBranch, b: EarthlyBranch) => new Set(relations.filter((r) => r.branches.includes(a) && r.branches.includes(b)).map((r) => r.type));
  if (typesFor("巳","申").size >= 3) matched.add("M05-OVER-0081-V1.0");
  if (typesFor("寅","申").has("clash") && typesFor("寅","申").has("local_punishment")) matched.add("M05-OVER-0082-V1.0");
  if (typesFor("丑","未").has("clash") && typesFor("丑","未").has("local_punishment")) matched.add("M05-OVER-0083-V1.0");
  if (typesFor("寅","巳").has("harm") && typesFor("寅","巳").has("local_punishment")) matched.add("M05-OVER-0084-V1.0");
  if (typesFor("寅","亥").has("six_harmony") && typesFor("寅","亥").has("break")) matched.add("M05-OVER-0085-V1.0");
  if (typesFor("未","戌").has("local_punishment") && typesFor("未","戌").has("break")) matched.add("M05-OVER-0086-V1.0");
}
