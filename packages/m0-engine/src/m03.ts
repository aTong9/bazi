import type { EarthlyBranch, HeavenlyStem } from "../../domain/src/birth-input.js";
import type { FiveElement, M02Result, PillarPosition } from "./m02.js";

export interface RootEvidence {
  readonly branch: EarthlyBranch;
  readonly position: PillarPosition;
  readonly hiddenStem: HeavenlyStem;
  readonly kind: "direct" | "same_element";
  readonly hiddenLevel: "main" | "middle" | "residual";
  readonly level: "strong" | "medium" | "weak";
  readonly exposed: boolean;
  readonly ruleIds: readonly string[];
}

export interface M03Result {
  readonly moduleId: "M0.M03";
  readonly status: "limited";
  readonly calendarVerified: false;
  readonly seasonElement: FiveElement;
  readonly seasonalStates: Readonly<Record<FiveElement, "prosperous" | "supported" | "resting" | "confined" | "dead">>;
  readonly dayMasterRoots: readonly RootEvidence[];
  readonly rootStatus: "rooted" | "same_element_only" | "no_direct_root";
  readonly matchedRuleIds: readonly string[];
  readonly conditions: readonly string[];
  readonly forbiddenConclusions: readonly ["day_master_strength", "element_final_strength"];
}

const SEASON: Record<EarthlyBranch, { element: FiveElement; ruleId: string }> = {
  寅: { element: "木", ruleId: "M03-ML-0001-V1.0" }, 卯: { element: "木", ruleId: "M03-ML-0002-V1.0" },
  辰: { element: "土", ruleId: "M03-ML-0003-V1.0" }, 巳: { element: "火", ruleId: "M03-ML-0004-V1.0" },
  午: { element: "火", ruleId: "M03-ML-0005-V1.0" }, 未: { element: "土", ruleId: "M03-ML-0006-V1.0" },
  申: { element: "金", ruleId: "M03-ML-0007-V1.0" }, 酉: { element: "金", ruleId: "M03-ML-0008-V1.0" },
  戌: { element: "土", ruleId: "M03-ML-0009-V1.0" }, 亥: { element: "水", ruleId: "M03-ML-0010-V1.0" },
  子: { element: "水", ruleId: "M03-ML-0011-V1.0" }, 丑: { element: "土", ruleId: "M03-ML-0012-V1.0" },
};

const DIRECT_ROOT_RULE: Record<HeavenlyStem, string> = {
  甲: "M03-TGRT-0024-V1.0", 乙: "M03-TGRT-0025-V1.0", 丙: "M03-TGRT-0026-V1.0",
  丁: "M03-TGRT-0027-V1.0", 戊: "M03-TGRT-0028-V1.0", 己: "M03-TGRT-0029-V1.0",
  庚: "M03-TGRT-0030-V1.0", 辛: "M03-TGRT-0031-V1.0", 壬: "M03-TGRT-0032-V1.0",
  癸: "M03-TGRT-0033-V1.0",
};
const LEVEL_RULE = {
  main: "M03-RTLV-0034-V1.0",
  middle: "M03-RTLV-0035-V1.0",
  residual: "M03-RTLV-0036-V1.0",
} as const;
const LEVEL = { main: "strong", middle: "medium", residual: "weak" } as const;
const ELEMENTS: readonly FiveElement[] = ["木", "火", "土", "金", "水"];

export function analyzeM03(m02: M02Result): M03Result {
  const season = SEASON[m02.pillars.month.branch.branch];
  const dayMasterDefinition = m02.pillars.day.stem;
  const matched = new Set<string>([
    season.ruleId,
    "M03-WXR-0013-V1.0", "M03-WXR-0014-V1.0", "M03-WXR-0015-V1.0",
    "M03-WXR-0016-V1.0", "M03-WXR-0017-V1.0", "M03-PROC-0018-V1.0",
    "M03-PROC-0020-V1.0", "M03-PROC-0021-V1.0", "M03-PROC-0022-V1.0",
    "M03-PROC-0023-V1.0", "M03-RTEF-0046-V1.0", "M03-RTEF-0047-V1.0",
    "M03-RTEF-0048-V1.0", "M03-RTEF-0049-V1.0", "M03-DIM-0054-V1.0",
    "M03-DIM-0055-V1.0", "M03-DIM-0056-V1.0", "M03-DIM-0057-V1.0",
    "M03-EDGE-0058-V1.0", "M03-EDGE-0059-V1.0", "M03-EDGE-0060-V1.0",
  ]);
  const roots: RootEvidence[] = [];
  for (const position of ["year", "month", "day", "hour"] as const) {
    const pillar = m02.pillars[position];
    if (!pillar) continue;
    const branch = pillar.branch;
    for (const hidden of branch.hiddenStems) {
      const direct = hidden.stem === m02.dayMaster;
      const sameElement = hidden.element === dayMasterDefinition.element;
      if (!direct && !sameElement) continue;
      const kind = direct ? "direct" : "same_element";
      const ruleIds = direct
        ? [DIRECT_ROOT_RULE[m02.dayMaster], LEVEL_RULE[hidden.level]]
        : ["M03-RTLV-0037-V1.0", "M03-RTLV-0038-V1.0", LEVEL_RULE[hidden.level]];
      for (const ruleId of ruleIds) matched.add(ruleId);
      if (position === "month") matched.add("M03-RTCT-0042-V1.0");
      if (position === "day") matched.add("M03-RTCT-0043-V1.0");
      if (position === "year" || position === "hour") matched.add("M03-RTCT-0044-V1.0");
      if (hidden.exposed) matched.add("M03-RTEF-0052-V1.0");
      roots.push({
        branch: branch.branch,
        position,
        hiddenStem: hidden.stem,
        kind,
        hiddenLevel: hidden.level,
        level: LEVEL[hidden.level],
        exposed: hidden.exposed,
        ruleIds: Object.freeze(ruleIds),
      });
    }
  }
  if (roots.length === 0) matched.add("M03-RTLV-0039-V1.0");
  if (roots.length === 1 && roots[0]?.level === "weak") matched.add("M03-RTCT-0040-V1.0");
  if (roots.length > 1) matched.add("M03-RTCT-0041-V1.0");
  const hasDirect = roots.some((root) => root.kind === "direct");
  return {
    moduleId: "M0.M03",
    status: "limited",
    calendarVerified: false,
    seasonElement: season.element,
    seasonalStates: Object.freeze(Object.fromEntries(ELEMENTS.map((element) => [element, seasonalState(element, season.element)])) as Record<FiveElement, "prosperous" | "supported" | "resting" | "confined" | "dead">),
    dayMasterRoots: Object.freeze(roots),
    rootStatus: hasDirect ? "rooted" : roots.length > 0 ? "same_element_only" : "no_direct_root",
    matchedRuleIds: Object.freeze([...matched].sort()),
    conditions: Object.freeze(["CALENDAR_NOT_REVERIFIED_FROM_FOUR_PILLARS"]),
    forbiddenConclusions: ["day_master_strength", "element_final_strength"],
  };
}

function seasonalState(element: FiveElement, season: FiveElement): "prosperous" | "supported" | "resting" | "confined" | "dead" {
  if (element === season) return "prosperous";
  if (produces(season, element)) return "supported";
  if (produces(element, season)) return "resting";
  if (controls(element, season)) return "confined";
  return "dead";
}

function produces(source: FiveElement, target: FiveElement): boolean {
  return ({ 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" } as const)[source] === target;
}
function controls(source: FiveElement, target: FiveElement): boolean {
  return ({ 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" } as const)[source] === target;
}
