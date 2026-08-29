import type { FiveElement } from "./m02.js";
import type { M15Result } from "./m15.js";
import type { M16Result } from "./m16.js";
import type { M17Result } from "./m17.js";
import { FIVE_ELEMENTS } from "./element-cycle.js";

export interface ElementDecision { readonly element: FiveElement; readonly classification: "primary_candidate" | "secondary_candidate" | "conditional" | "avoid" | "neutral"; readonly reasons: readonly string[]; readonly hardConstraints: readonly string[]; readonly doseBoundary: readonly string[] }
export interface M18Result { readonly moduleId: "M0.M18"; readonly status: "complete" | "limited"; readonly decisions: Readonly<Record<FiveElement, ElementDecision>>; readonly decisionLog: readonly string[]; readonly matchedRuleIds: readonly string[] }
export function analyzeM18(m17: M17Result, m15: M15Result, m16: M16Result): M18Result {
  const log = ["ORDER:HARD_CONSTRAINT>ROOT_PROBLEM>PATTERN_AND_PATH>NET_BENEFIT>DOSE"];
  const entries = FIVE_ELEMENTS.map((element): [FiveElement, ElementDecision] => {
    const row = m17.matrix[element]; const hard = row.conflicts.filter((item) => item.includes("PATTERN"));
    const rootBenefit = m16.medicines.some((medicine) => medicine.element === element && medicine.problemIds.some((id) => m16.problems.find((problem) => problem.id === id)?.severity === "primary"));
    const classification = hard.length > 0 ? "avoid" : rootBenefit ? "primary_candidate" : row.benefits.length >= 2 ? "secondary_candidate" : row.benefits.length === 1 ? "conditional" : "neutral";
    log.push(`${element}:${classification}:${hard.length ? "HARD_CONSTRAINT" : rootBenefit ? "ROOT_PROBLEM" : "NET_BENEFIT"}`);
    return [element, Object.freeze({ element, classification, reasons: Object.freeze([...row.benefits, ...row.conflicts]), hardConstraints: Object.freeze(hard), doseBoundary: Object.freeze(["MINIMUM_EFFECTIVE_DOSE", "STOP_IF_SECONDARY_IMBALANCE", "REASSESS_IF_PATTERN_OR_ROUTE_CHANGES"]) })];
  });
  const hasSpecial = m15.evaluations.some((item) => item.name.includes("从") || item.name.includes("化气"));
  return { moduleId: "M0.M18", status: m17.status, decisions: Object.freeze(Object.fromEntries(entries) as Record<FiveElement, ElementDecision>), decisionLog: Object.freeze(log), matchedRuleIds: Object.freeze(["M18-GEN-0001-V1.0", ...(hasSpecial ? ["M18-SPECIAL-0009-V1.0"] : []), "M18-RANK-0069-V1.0", "M18-BOUND-0077-V1.0", "M18-BOUND-0078-V1.0"] ) };
}
