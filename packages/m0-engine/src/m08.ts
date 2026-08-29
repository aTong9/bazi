import type { FiveElement, PillarPosition } from "./m02.js";
import type { M06Result } from "./m06.js";
import type { ElementStrengthCandidate, M07Result } from "./m07.js";
import { FIVE_ELEMENTS } from "./element-cycle.js";

export interface M08ElementState {
  readonly element: FiveElement;
  readonly effectiveStrengthCandidate: ElementStrengthCandidate;
  readonly appliedEffects: readonly string[];
  readonly retainedEvidence: readonly string[];
}
export interface M08Result {
  readonly moduleId: "M0.M08";
  readonly status: "complete" | "limited";
  readonly elements: Readonly<Record<FiveElement, M08ElementState>>;
  readonly pendingEffectIds: readonly string[];
  readonly matchedRuleIds: readonly string[];
  readonly fixedPercentageAdjustmentUsed: false;
}

export function analyzeM08(m07: M07Result, m06: M06Result): M08Result {
  const pending = m06.effects.filter((effect) => effect.status === "candidate" || effect.status === "conditional").map((effect) => effect.id);
  const appliedByPosition = new Map<PillarPosition, string[]>();
  for (const effect of m06.effects.filter((item) => item.status === "supported")) {
    const values = appliedByPosition.get(effect.objectRef) ?? [];
    values.push(effect.id);
    appliedByPosition.set(effect.objectRef, values);
  }
  const matched = new Set<string>(["M08-AGG-0101-V1.0", "M08-AGG-0106-V1.0", "M08-BOUND-0107-V1.0", "M08-BOUND-0108-V1.0", "M08-BOUND-0109-V1.0", "M08-BOUND-0110-V1.0"]);
  const entries = FIVE_ELEMENTS.map((element): [FiveElement, M08ElementState] => {
    const original = m07.elements[element];
    const applied = [...new Set([...original.visibleStemPositions, ...original.rootPositions].flatMap((position) => appliedByPosition.get(position) ?? []))];
    if (applied.length > 0) matched.add("M08-ROOT-0001-V1.0");
    if (pending.length > 0) matched.add("M08-REL-0075-V1.0");
    const destructive = m06.effects.some((effect) => applied.includes(effect.id) && effect.effect === "root_damage_candidate");
    const candidate = destructive && original.rawStrengthCandidate === "strong_candidate" ? "balanced_candidate" : original.rawStrengthCandidate;
    return [element, Object.freeze({ element, effectiveStrengthCandidate: candidate, appliedEffects: Object.freeze(applied), retainedEvidence: original.evidence })];
  });
  return { moduleId: "M0.M08", status: m07.status, elements: Object.freeze(Object.fromEntries(entries) as Record<FiveElement, M08ElementState>), pendingEffectIds: Object.freeze(pending), matchedRuleIds: Object.freeze([...matched].sort()), fixedPercentageAdjustmentUsed: false };
}
