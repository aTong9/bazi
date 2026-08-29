import type { FiveElement, M02Result, PillarPosition } from "./m02.js";
import type { M03Result } from "./m03.js";
import { FIVE_ELEMENTS, producerOf } from "./element-cycle.js";

export type ElementStrengthCandidate = "weak_candidate" | "balanced_candidate" | "strong_candidate";
export interface M07ElementEvidence {
  readonly element: FiveElement;
  readonly seasonalState: M03Result["seasonalStates"][FiveElement];
  readonly visibleStemPositions: readonly PillarPosition[];
  readonly rootPositions: readonly PillarPosition[];
  readonly hiddenStemPositions: readonly PillarPosition[];
  readonly sourceElements: readonly FiveElement[];
  readonly allyCount: number;
  readonly rawStrengthCandidate: ElementStrengthCandidate;
  readonly evidence: readonly string[];
}
export interface M07Result {
  readonly moduleId: "M0.M07";
  readonly status: "complete" | "limited";
  readonly elements: Readonly<Record<FiveElement, M07ElementEvidence>>;
  readonly matchedRuleIds: readonly string[];
  readonly finalStrengthDeclared: false;
}

export function analyzeM07(m02: M02Result, m03: M03Result): M07Result {
  const pillars = Object.values(m02.pillars).filter((value): value is NonNullable<typeof value> => value !== null);
  const matched = new Set<string>(["M07-AGG-0071-V1.0", "M07-AGG-0076-V1.0", "M07-BOUND-0077-V1.0", "M07-BOUND-0078-V1.0", "M07-BOUND-0079-V1.0", "M07-BOUND-0080-V1.0"]);
  const entries = FIVE_ELEMENTS.map((element): [FiveElement, M07ElementEvidence] => {
    const visible = pillars.filter((pillar) => pillar.stem.element === element).map((pillar) => pillar.position);
    const roots = pillars.filter((pillar) => pillar.branch.element === element).map((pillar) => pillar.position);
    const hidden = pillars.filter((pillar) => pillar.branch.hiddenStems.some((stem) => stem.element === element)).map((pillar) => pillar.position);
    const seasonalState = m03.seasonalStates[element];
    const sourceElement = producerOf(element);
    const sources = pillars.some((pillar) => pillar.stem.element === sourceElement || pillar.branch.hiddenStems.some((stem) => stem.element === sourceElement)) ? [sourceElement] : [];
    const evidence = [
      `SEASON:${seasonalState}`, ...visible.map((position) => `VISIBLE:${position}`),
      ...roots.map((position) => `ROOT:${position}`), ...hidden.map((position) => `HIDDEN:${position}`),
      ...sources.map((source) => `SOURCE:${source}`),
    ];
    if (seasonalState === "prosperous") matched.add("M07-SEAS-0001-V1.0");
    if (roots.length > 0) matched.add("M07-ROOT-0011-V1.0");
    if (visible.length > 0) matched.add("M07-STEM-0027-V1.0");
    if (sources.length > 0) matched.add("M07-SOURCE-0037-V1.0");
    if (visible.length + roots.length > 1) matched.add("M07-ALLY-0047-V1.0");
    const strongSupport = (seasonalState === "prosperous" || seasonalState === "supported") && (roots.length > 0 || visible.length > 0);
    const weakEvidence = (seasonalState === "dead" || seasonalState === "confined") && roots.length === 0 && visible.length === 0;
    return [element, Object.freeze({
      element, seasonalState, visibleStemPositions: Object.freeze(visible), rootPositions: Object.freeze(roots),
      hiddenStemPositions: Object.freeze(hidden), sourceElements: Object.freeze(sources), allyCount: visible.length + roots.length,
      rawStrengthCandidate: strongSupport ? "strong_candidate" : weakEvidence ? "weak_candidate" : "balanced_candidate",
      evidence: Object.freeze(evidence),
    })];
  });
  return { moduleId: "M0.M07", status: m02.status === "complete" ? "complete" : "limited", elements: Object.freeze(Object.fromEntries(entries) as Record<FiveElement, M07ElementEvidence>), matchedRuleIds: Object.freeze([...matched].sort()), finalStrengthDeclared: false };
}
