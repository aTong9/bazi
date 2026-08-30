import type { M02Result } from "./m02.js";
import type { M03Result } from "./m03.js";
import type { M08Result } from "./m08.js";
import { controllerOf, outputOf, producerOf, wealthOf } from "./element-cycle.js";

export interface M09Result {
  readonly moduleId: "M0.M09";
  readonly status: "complete" | "limited";
  readonly dayMasterElement: M02Result["pillars"]["day"]["stem"]["element"];
  readonly strengthCandidate: "weak_candidate" | "balanced_candidate" | "strong_candidate";
  readonly supportEvidence: readonly string[];
  readonly burdenEvidence: readonly string[];
  readonly matchedRuleIds: readonly string[];
  readonly finalVerdict: false;
}

export function analyzeM09(m02: M02Result, m03: M03Result, m08: M08Result): M09Result {
  const element = m02.pillars.day.stem.element;
  const support = [
    ...(m03.seasonalStates[element] === "prosperous" || m03.seasonalStates[element] === "supported" ? [`SEASON:${m03.seasonalStates[element]}`] : []),
    ...m03.dayMasterRoots.map((root) => `ROOT:${root.position}:${root.level}`),
    ...(m08.elements[producerOf(element)].effectiveStrengthCandidate === "strong_candidate" ? [`RESOURCE:${producerOf(element)}`] : []),
  ];
  const burden = [
    ...(m08.elements[controllerOf(element)].effectiveStrengthCandidate !== "weak_candidate" ? [`CONTROL:${controllerOf(element)}`] : []),
    ...(m08.elements[outputOf(element)].effectiveStrengthCandidate === "strong_candidate" ? [`OUTPUT:${outputOf(element)}`] : []),
    ...(m08.elements[wealthOf(element)].effectiveStrengthCandidate === "strong_candidate" ? [`DRAIN:${wealthOf(element)}`] : []),
  ];
  const candidate = support.length >= 2 && burden.length === 0 ? "strong_candidate"
    : burden.length >= 2 && support.length === 0 ? "weak_candidate" : "balanced_candidate";
  const matched = new Set<string>(["M09-SYN-0063-V1.0", "M09-GRADE-0073-V1.0", "M09-BOUND-0081-V1.0", "M09-BOUND-0082-V1.0", "M09-BOUND-0083-V1.0", "M09-BOUND-0084-V1.0"]);
  if (support.some((item) => item.startsWith("SEASON:"))) matched.add("M09-LING-0001-V1.0");
  if (m03.dayMasterRoots.length > 0) matched.add("M09-DI-0011-V1.0");
  if (support.some((item) => item.startsWith("RESOURCE:"))) matched.add("M09-SHENG-0033-V1.0");
  if (burden.some((item) => item.startsWith("CONTROL:"))) matched.add("M09-KE-0041-V1.0");
  if (burden.some((item) => item.startsWith("OUTPUT:"))) matched.add("M09-XIE-0049-V1.0");
  if (burden.some((item) => item.startsWith("DRAIN:"))) matched.add("M09-HAO-0057-V1.0");
  return { moduleId: "M0.M09", status: m02.status === "complete" ? "complete" : "limited", dayMasterElement: element, strengthCandidate: candidate, supportEvidence: Object.freeze(support), burdenEvidence: Object.freeze(burden), matchedRuleIds: Object.freeze([...matched].sort()), finalVerdict: false };
}
