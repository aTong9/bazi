import type { M10Result } from "./m10.js";
import type { M11Result } from "./m11.js";
import type { M14Result } from "./m14.js";

export interface PatternEvaluation { readonly candidateId: string; readonly name: string; readonly formation: "basic" | "conditional" | "rejected"; readonly damage: readonly string[]; readonly rescue: readonly string[]; readonly purity: "pure" | "mixed" | "pending"; readonly conditions: readonly string[] }
export interface M15Result { readonly moduleId: "M0.M15"; readonly status: "complete" | "limited"; readonly evaluations: readonly PatternEvaluation[]; readonly matchedRuleIds: readonly string[] }
export function analyzeM15(m14: M14Result, m10: M10Result, m11: M11Result): M15Result {
  const evaluations = m14.candidates.map((candidate): PatternEvaluation => {
    const states = candidate.keyGods.map((god) => m10.tenGods[god]);
    const damage = [...candidate.vetoes]; const rescue = m11.combinations.filter((item) => item.participants.some((god) => candidate.keyGods.includes(god))).map((item) => item.name);
    const formation = damage.includes("KEY_GOD_WEAK") ? rescue.length ? "conditional" : "rejected" : "basic";
    const purity = states.every((state) => state.purity === "pure") ? "pure" : states.some((state) => state.purity === "mixed") ? "mixed" : "pending";
    return { candidateId: candidate.id, name: candidate.name, formation, damage: Object.freeze(damage), rescue: Object.freeze(rescue), purity, conditions: Object.freeze(["FORMATION_IS_SEPARATE_FROM_RANK"]) };
  });
  return { moduleId: "M0.M15", status: m14.status, evaluations: Object.freeze(evaluations), matchedRuleIds: Object.freeze(["M15-GEN-0001-V1.0", "M15-RESCUE-0087-V1.0", "M15-BOUND-0097-V1.0", "M15-BOUND-0098-V1.0"] ) };
}
