import type { HeavenlyStem, Pillar } from "../../domain/src/birth-input.js";
import type { FiveElement, PillarPosition } from "./m02.js";

export interface StemRelationInstance {
  readonly id: string;
  readonly type: "stem_combine" | "stem_control";
  readonly positions: readonly [PillarPosition, PillarPosition];
  readonly stems: readonly [HeavenlyStem, HeavenlyStem];
  readonly ruleId: string;
  readonly distance: "adjacent" | "separated" | "remote";
  readonly candidateElement?: FiveElement;
  readonly status: "recognized";
}

export interface StemContention {
  readonly id: string;
  readonly type: "combine_contention";
  readonly stems: readonly [HeavenlyStem, HeavenlyStem];
  readonly positions: readonly PillarPosition[];
  readonly ruleId: string;
  readonly status: "candidate";
}

export interface M04Result {
  readonly moduleId: "M0.M04";
  readonly status: "complete";
  readonly relations: readonly StemRelationInstance[];
  readonly contentions: readonly StemContention[];
  readonly matchedRuleIds: readonly string[];
  readonly forbiddenConclusions: readonly ["combination_transformed", "strength_change"];
}

interface CombineDefinition {
  pair: readonly [HeavenlyStem, HeavenlyStem];
  element: FiveElement;
  combineRule: string;
  candidateRule: string;
  contentionRule: string;
}

const COMBINES: readonly CombineDefinition[] = [
  combine("甲", "己", "土", 1, 32, 37), combine("乙", "庚", "金", 2, 33, 38),
  combine("丙", "辛", "水", 3, 34, 39), combine("丁", "壬", "木", 4, 35, 40),
  combine("戊", "癸", "火", 5, 36, 41),
];
const POSITION_RULES: Record<string, string> = {
  "year:month": "M04-POS-0026-V1.0", "month:day": "M04-POS-0027-V1.0",
  "day:hour": "M04-POS-0028-V1.0", "year:day": "M04-POS-0029-V1.0",
  "month:hour": "M04-POS-0030-V1.0", "year:hour": "M04-POS-0031-V1.0",
};
const CONTROL_RULES = controlRules();
const POSITIONS: readonly PillarPosition[] = ["year", "month", "day", "hour"];
const ELEMENT: Record<HeavenlyStem, FiveElement> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

export function analyzeM04(fourPillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }): M04Result {
  const nodes = POSITIONS.flatMap((position) => {
    const pillar = fourPillars[position];
    return pillar ? [{ position, stem: pillar.stem }] : [];
  });
  const relations: StemRelationInstance[] = [];
  const matched = new Set<string>(["M04-BOUND-0047-V1.0", "M04-BOUND-0048-V1.0", "M04-BOUND-0049-V1.0", "M04-BOUND-0050-V1.0"]);
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex];
      const right = nodes[rightIndex];
      if (!left || !right) continue;
      const positionKey = `${left.position}:${right.position}`;
      const positionRule = POSITION_RULES[positionKey];
      if (positionRule) matched.add(positionRule);
      const combination = COMBINES.find(({ pair }) => sameUnorderedPair(pair, [left.stem, right.stem]));
      if (combination) {
        relations.push(relation("stem_combine", left, right, combination.combineRule, combination.element));
        matched.add(combination.combineRule);
        matched.add(combination.candidateRule);
      }
      const directional = controls(ELEMENT[left.stem], ELEMENT[right.stem])
        ? [left, right] as const
        : controls(ELEMENT[right.stem], ELEMENT[left.stem])
          ? [right, left] as const
          : null;
      if (directional) {
        const ruleId = CONTROL_RULES[`${directional[0].stem}>${directional[1].stem}`];
        if (!ruleId) throw new Error(`Missing control rule for ${directional[0].stem}>${directional[1].stem}`);
        relations.push(relation("stem_control", directional[0], directional[1], ruleId));
        matched.add(ruleId);
      }
      if (combination && directional) matched.add("M04-OVER-0046-V1.0");
    }
  }
  const contentions: StemContention[] = [];
  for (const definition of COMBINES) {
    const participants = nodes.filter((node) => definition.pair.includes(node.stem));
    const leftCount = participants.filter((node) => node.stem === definition.pair[0]).length;
    const rightCount = participants.filter((node) => node.stem === definition.pair[1]).length;
    if (leftCount >= 1 && rightCount >= 1 && (leftCount > 1 || rightCount > 1)) {
      const positions = participants.map((node) => node.position);
      contentions.push({
        id: `M04:contention:${definition.pair.join("")}:${positions.join("-")}`,
        type: "combine_contention",
        stems: definition.pair,
        positions: Object.freeze(positions),
        ruleId: definition.contentionRule,
        status: "candidate",
      });
      matched.add(definition.contentionRule);
      matched.add("M04-ZHENG-0042-V1.0");
    }
  }
  return {
    moduleId: "M0.M04",
    status: "complete",
    relations: Object.freeze(relations.sort((a, b) => {
      const left = POSITIONS.indexOf(a.positions[0]) * 10 + POSITIONS.indexOf(a.positions[1]);
      const right = POSITIONS.indexOf(b.positions[0]) * 10 + POSITIONS.indexOf(b.positions[1]);
      return left - right || a.type.localeCompare(b.type);
    })),
    contentions: Object.freeze(contentions),
    matchedRuleIds: Object.freeze([...matched].sort()),
    forbiddenConclusions: ["combination_transformed", "strength_change"],
  };
}

function relation(
  type: StemRelationInstance["type"],
  left: { position: PillarPosition; stem: HeavenlyStem },
  right: { position: PillarPosition; stem: HeavenlyStem },
  ruleId: string,
  candidateElement?: FiveElement,
): StemRelationInstance {
  const positionDistance = Math.abs(POSITIONS.indexOf(left.position) - POSITIONS.indexOf(right.position));
  return {
    id: `M04:${type}:${left.position}-${right.position}:${left.stem}-${right.stem}`,
    type,
    positions: [left.position, right.position],
    stems: [left.stem, right.stem],
    ruleId,
    distance: positionDistance === 1 ? "adjacent" : positionDistance === 2 ? "separated" : "remote",
    ...(candidateElement ? { candidateElement } : {}),
    status: "recognized",
  };
}

function combine(a: HeavenlyStem, b: HeavenlyStem, element: FiveElement, combineIndex: number, candidateIndex: number, contentionIndex: number): CombineDefinition {
  return {
    pair: [a, b], element,
    combineRule: `M04-HE-${String(combineIndex).padStart(4, "0")}-V1.0`,
    candidateRule: `M04-HHC-${String(candidateIndex).padStart(4, "0")}-V1.0`,
    contentionRule: `M04-ZHENG-${String(contentionIndex).padStart(4, "0")}-V1.0`,
  };
}

function sameUnorderedPair(expected: readonly HeavenlyStem[], actual: readonly HeavenlyStem[]): boolean {
  return expected.includes(actual[0]!) && expected.includes(actual[1]!) && actual[0] !== actual[1];
}

function controls(source: FiveElement, target: FiveElement): boolean {
  return ({ 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" } as const)[source] === target;
}

function controlRules(): Record<string, string> {
  const ordered: Array<[HeavenlyStem, HeavenlyStem]> = [
    ["甲", "戊"], ["甲", "己"], ["乙", "戊"], ["乙", "己"], ["丙", "庚"], ["丙", "辛"],
    ["丁", "庚"], ["丁", "辛"], ["戊", "壬"], ["戊", "癸"], ["己", "壬"], ["己", "癸"],
    ["庚", "甲"], ["庚", "乙"], ["辛", "甲"], ["辛", "乙"], ["壬", "丙"], ["壬", "丁"],
    ["癸", "丙"], ["癸", "丁"],
  ];
  return Object.fromEntries(ordered.map(([source, target], index) => [
    `${source}>${target}`,
    `M04-KE-${String(index + 6).padStart(4, "0")}-V1.0`,
  ]));
}
