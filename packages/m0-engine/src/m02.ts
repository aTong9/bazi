import type { EarthlyBranch, HeavenlyStem, Pillar } from "../../domain/src/birth-input.js";

export type FiveElement = "木" | "火" | "土" | "金" | "水";
export type YinYang = "yin" | "yang";
export type TenGod = "比肩" | "劫财" | "食神" | "伤官" | "偏财" | "正财" | "七杀" | "正官" | "偏印" | "正印";
export type PillarPosition = "year" | "month" | "day" | "hour";

interface StemDefinition { element: FiveElement; yinYang: YinYang; ruleId: string }
interface HiddenStemDefinition { stem: HeavenlyStem; level: "main" | "middle" | "residual" }
interface BranchDefinition {
  element: FiveElement;
  yinYang: YinYang;
  hiddenStems: readonly HiddenStemDefinition[];
  ruleId: string;
}

export interface M02StemFact extends StemDefinition {
  readonly stem: HeavenlyStem;
  readonly tenGod: TenGod;
  readonly visible: true;
}

export interface M02HiddenStemFact extends StemDefinition {
  readonly stem: HeavenlyStem;
  readonly level: "main" | "middle" | "residual";
  readonly tenGod: TenGod;
  readonly exposed: boolean;
}

export interface M02BranchFact {
  readonly branch: EarthlyBranch;
  readonly element: FiveElement;
  readonly yinYang: YinYang;
  readonly hiddenStems: readonly M02HiddenStemFact[];
  readonly ruleId: string;
}

export interface M02PillarFact {
  readonly position: PillarPosition;
  readonly stem: M02StemFact;
  readonly branch: M02BranchFact;
}

export interface M02Result {
  readonly moduleId: "M0.M02";
  readonly status: "complete" | "limited";
  readonly dayMaster: HeavenlyStem;
  readonly pillars: Readonly<{
    year: M02PillarFact;
    month: M02PillarFact;
    day: M02PillarFact;
    hour: M02PillarFact | null;
  }>;
  readonly matchedRuleIds: readonly string[];
  readonly forbiddenConclusions: readonly ["strength", "favorability", "pattern", "useful_god"];
}

const STEMS: Record<HeavenlyStem, StemDefinition> = {
  甲: { element: "木", yinYang: "yang", ruleId: "M02-TG-0001-V1.0" },
  乙: { element: "木", yinYang: "yin", ruleId: "M02-TG-0002-V1.0" },
  丙: { element: "火", yinYang: "yang", ruleId: "M02-TG-0003-V1.0" },
  丁: { element: "火", yinYang: "yin", ruleId: "M02-TG-0004-V1.0" },
  戊: { element: "土", yinYang: "yang", ruleId: "M02-TG-0005-V1.0" },
  己: { element: "土", yinYang: "yin", ruleId: "M02-TG-0006-V1.0" },
  庚: { element: "金", yinYang: "yang", ruleId: "M02-TG-0007-V1.0" },
  辛: { element: "金", yinYang: "yin", ruleId: "M02-TG-0008-V1.0" },
  壬: { element: "水", yinYang: "yang", ruleId: "M02-TG-0009-V1.0" },
  癸: { element: "水", yinYang: "yin", ruleId: "M02-TG-0010-V1.0" },
};

const BRANCHES: Record<EarthlyBranch, BranchDefinition> = {
  子: branch("水", "yang", [["癸", "main"]], "M02-DZ-0011-V1.0"),
  丑: branch("土", "yin", [["己", "main"], ["癸", "middle"], ["辛", "residual"]], "M02-DZ-0012-V1.0"),
  寅: branch("木", "yang", [["甲", "main"], ["丙", "middle"], ["戊", "residual"]], "M02-DZ-0013-V1.0"),
  卯: branch("木", "yin", [["乙", "main"]], "M02-DZ-0014-V1.0"),
  辰: branch("土", "yang", [["戊", "main"], ["乙", "middle"], ["癸", "residual"]], "M02-DZ-0015-V1.0"),
  巳: branch("火", "yin", [["丙", "main"], ["戊", "middle"], ["庚", "residual"]], "M02-DZ-0016-V1.0"),
  午: branch("火", "yang", [["丁", "main"], ["己", "middle"]], "M02-DZ-0017-V1.0"),
  未: branch("土", "yin", [["己", "main"], ["丁", "middle"], ["乙", "residual"]], "M02-DZ-0018-V1.0"),
  申: branch("金", "yang", [["庚", "main"], ["壬", "middle"], ["戊", "residual"]], "M02-DZ-0019-V1.0"),
  酉: branch("金", "yin", [["辛", "main"]], "M02-DZ-0020-V1.0"),
  戌: branch("土", "yang", [["戊", "main"], ["辛", "middle"], ["丁", "residual"]], "M02-DZ-0021-V1.0"),
  亥: branch("水", "yin", [["壬", "main"], ["甲", "middle"]], "M02-DZ-0022-V1.0"),
};

const ELEMENT_RULES: Record<FiveElement, string> = {
  木: "M02-WX-0023-V1.0", 火: "M02-WX-0024-V1.0", 土: "M02-WX-0025-V1.0",
  金: "M02-WX-0026-V1.0", 水: "M02-WX-0027-V1.0",
};
const TEN_GOD_RULES: Record<TenGod, string> = {
  比肩: "M02-SS-0028-V1.0", 劫财: "M02-SS-0029-V1.0", 食神: "M02-SS-0030-V1.0",
  伤官: "M02-SS-0031-V1.0", 偏财: "M02-SS-0032-V1.0", 正财: "M02-SS-0033-V1.0",
  七杀: "M02-SS-0034-V1.0", 正官: "M02-SS-0035-V1.0", 偏印: "M02-SS-0036-V1.0",
  正印: "M02-SS-0037-V1.0",
};

export function analyzeM02(fourPillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }): M02Result {
  const dayMaster = fourPillars.day.stem;
  const visibleStems = new Set(Object.values(fourPillars).flatMap((pillar) => pillar ? [pillar.stem] : []));
  const matched = new Set<string>(["M02-META-0038-V1.0", "M02-META-0039-V1.0", "M02-META-0040-V1.0"]);
  const makeFact = (position: PillarPosition, pillar: Pillar): M02PillarFact => {
      const stemDefinition = STEMS[pillar.stem];
      const branchDefinition = BRANCHES[pillar.branch];
      const stemTenGod = tenGodFor(dayMaster, pillar.stem);
      matched.add(stemDefinition.ruleId);
      matched.add(branchDefinition.ruleId);
      matched.add(ELEMENT_RULES[stemDefinition.element]);
      matched.add(ELEMENT_RULES[branchDefinition.element]);
      matched.add(TEN_GOD_RULES[stemTenGod]);
      const hiddenStems = branchDefinition.hiddenStems.map(({ stem, level }) => {
        const definition = STEMS[stem];
        const tenGod = tenGodFor(dayMaster, stem);
        matched.add(definition.ruleId);
        matched.add(TEN_GOD_RULES[tenGod]);
        return { stem, level, element: definition.element, yinYang: definition.yinYang, tenGod, exposed: visibleStems.has(stem), ruleId: definition.ruleId };
      });
      return {
        position,
        stem: { stem: pillar.stem, ...stemDefinition, tenGod: stemTenGod, visible: true as const },
        branch: { branch: pillar.branch, element: branchDefinition.element, yinYang: branchDefinition.yinYang, hiddenStems, ruleId: branchDefinition.ruleId },
      };
  };
  const facts = {
    year: makeFact("year", fourPillars.year),
    month: makeFact("month", fourPillars.month),
    day: makeFact("day", fourPillars.day),
    hour: fourPillars.hour ? makeFact("hour", fourPillars.hour) : null,
  };
  return {
    moduleId: "M0.M02",
    status: fourPillars.hour ? "complete" : "limited",
    dayMaster,
    pillars: Object.freeze(facts),
    matchedRuleIds: Object.freeze([...matched].sort()),
    forbiddenConclusions: ["strength", "favorability", "pattern", "useful_god"],
  };
}

export function tenGodFor(dayMaster: HeavenlyStem, other: HeavenlyStem): TenGod {
  const day = STEMS[dayMaster];
  const target = STEMS[other];
  const samePolarity = day.yinYang === target.yinYang;
  if (day.element === target.element) return samePolarity ? "比肩" : "劫财";
  if (produces(day.element, target.element)) return samePolarity ? "食神" : "伤官";
  if (controls(day.element, target.element)) return samePolarity ? "偏财" : "正财";
  if (controls(target.element, day.element)) return samePolarity ? "七杀" : "正官";
  return samePolarity ? "偏印" : "正印";
}

function branch(
  element: FiveElement,
  yinYang: YinYang,
  hiddenStems: readonly [HeavenlyStem, "main" | "middle" | "residual"][],
  ruleId: string,
): BranchDefinition {
  return { element, yinYang, hiddenStems: hiddenStems.map(([stem, level]) => ({ stem, level })), ruleId };
}

function produces(source: FiveElement, target: FiveElement): boolean {
  return ({ 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" } as const)[source] === target;
}

function controls(source: FiveElement, target: FiveElement): boolean {
  return ({ 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" } as const)[source] === target;
}
