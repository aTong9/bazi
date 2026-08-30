import type { FiveElement } from "./m02.js";
import type { M09Result } from "./m09.js";
import type { M12Result } from "./m12.js";
import type { M13Result } from "./m13.js";
import type { M15Result } from "./m15.js";
import type { M16Result } from "./m16.js";
import { FIVE_ELEMENTS, controllerOf, producerOf } from "./element-cycle.js";

type Dimension = "balance" | "pattern" | "flow" | "climate" | "medicine";
export interface CandidateMatrixRow { readonly element: FiveElement; readonly dimensions: Readonly<Record<Dimension, "benefit" | "conflict" | "neutral" | "unknown">>; readonly benefits: readonly string[]; readonly conflicts: readonly string[]; readonly sideEffects: readonly string[] }
export interface M17Result { readonly moduleId: "M0.M17"; readonly status: "complete" | "limited"; readonly matrix: Readonly<Record<FiveElement, CandidateMatrixRow>>; readonly matchedRuleIds: readonly string[]; readonly finalUsefulGodDeclared: false }
export function analyzeM17(m09: M09Result, m12: M12Result, m13: M13Result, m15: M15Result, m16: M16Result): M17Result {
  const entries = FIVE_ELEMENTS.map((element): [FiveElement, CandidateMatrixRow] => {
    const benefits: string[] = []; const conflicts: string[] = []; const dimensions: Record<Dimension, "benefit" | "conflict" | "neutral" | "unknown"> = { balance: "neutral", pattern: "unknown", flow: "neutral", climate: "neutral", medicine: "neutral" };
    if (m09.strengthCandidate === "weak_candidate" && element === producerOf(m09.dayMasterElement)) { dimensions.balance = "benefit"; benefits.push("SUPPORT_WEAK_DAY_MASTER"); }
    if (m09.strengthCandidate === "strong_candidate" && element === controllerOf(m09.dayMasterElement)) { dimensions.balance = "benefit"; benefits.push("CONTROL_EXCESS_DAY_MASTER"); }
    if (m12.bridgeCandidates.includes(element)) { dimensions.flow = "benefit"; benefits.push("BRIDGE_BLOCKED_PATH"); }
    if ([...m13.temperature.candidateElements, ...m13.humidity.candidateElements].includes(element)) { dimensions.climate = "benefit"; benefits.push("IMPROVE_CLIMATE_AXIS"); }
    if (m16.medicines.some((medicine) => medicine.element === element)) { dimensions.medicine = "benefit"; benefits.push("ADDRESS_ROOT_PROBLEM"); }
    if (m15.evaluations.some((evaluation) => evaluation.formation === "basic" && evaluation.damage.includes(`ELEMENT:${element}`))) { dimensions.pattern = "conflict"; conflicts.push("DAMAGES_FORMED_PATTERN"); }
    return [element, Object.freeze({ element, dimensions: Object.freeze(dimensions), benefits: Object.freeze(benefits), conflicts: Object.freeze(conflicts), sideEffects: Object.freeze(["DOSE_DEPENDENT", "RECHECK_ALL_FIVE_DIMENSIONS"]) })];
  });
  return { moduleId: "M0.M17", status: m09.status, matrix: Object.freeze(Object.fromEntries(entries) as Record<FiveElement, CandidateMatrixRow>), matchedRuleIds: Object.freeze(["M17-GEN-0001-V1.0", "M17-WUXING-0065-V1.0", "M17-RANK-0085-V1.0", "M17-BOUND-0093-V1.0", "M17-BOUND-0094-V1.0"]), finalUsefulGodDeclared: false };
}
