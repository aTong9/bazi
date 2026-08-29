import type { FiveElement } from "./m02.js";
import type { M09Result } from "./m09.js";
import type { M12Result } from "./m12.js";
import type { M13Result } from "./m13.js";
import type { M15Result } from "./m15.js";
import { controllerOf, producerOf } from "./element-cycle.js";

export interface StructuralProblem { readonly id: string; readonly type: "weakness" | "excess" | "flow" | "climate" | "pattern"; readonly rootCause: string; readonly surfaceSymptom: string; readonly severity: "primary" | "secondary" }
export interface MedicineCandidate { readonly element: FiveElement; readonly problemIds: readonly string[]; readonly mechanism: string; readonly routeStatus: "direct" | "conditional"; readonly overdoseRisk: string }
export interface M16Result { readonly moduleId: "M0.M16"; readonly status: "complete" | "limited"; readonly problems: readonly StructuralProblem[]; readonly medicines: readonly MedicineCandidate[]; readonly matchedRuleIds: readonly string[] }
export function analyzeM16(m09: M09Result, m12: M12Result, m13: M13Result, m15: M15Result): M16Result {
  const problems: StructuralProblem[] = [];
  if (m09.strengthCandidate === "weak_candidate") problems.push({ id: "dm-weak", type: "weakness", rootCause: "DAY_MASTER_SUPPORT_INSUFFICIENT", surfaceSymptom: "日主承载候选偏弱", severity: "primary" });
  if (m09.strengthCandidate === "strong_candidate") problems.push({ id: "dm-strong", type: "excess", rootCause: "DAY_MASTER_RELEASE_INSUFFICIENT", surfaceSymptom: "日主有效力量候选偏强", severity: "primary" });
  for (const path of m12.paths.filter((item) => item.blockPoint)) problems.push({ id: `flow-${path.source}`, type: "flow", rootCause: `${path.blockPoint?.toUpperCase()}_WEAK`, surfaceSymptom: `${path.source}→${path.bridge}→${path.end}流通受阻`, severity: "secondary" });
  if (["cold", "hot"].includes(m13.temperature.state) || ["dry", "humid"].includes(m13.humidity.state)) problems.push({ id: "climate", type: "climate", rootCause: "CLIMATE_AXIS_EXTREME", surfaceSymptom: `${m13.temperature.state}/${m13.humidity.state}`, severity: "secondary" });
  for (const item of m15.evaluations.filter((evaluation) => evaluation.formation === "rejected")) problems.push({ id: `pattern-${item.candidateId}`, type: "pattern", rootCause: item.damage.join("|") || "PATTERN_PATH_INVALID", surfaceSymptom: `${item.name}不成立`, severity: "secondary" });
  if (problems.length === 0) problems.push({ id: "balance-watch", type: "flow", rootCause: "NO_PRIMARY_DISEASE_PROVEN", surfaceSymptom: "仅保留平衡观察", severity: "secondary" });
  const candidates = new Map<FiveElement, string[]>();
  const add = (element: FiveElement, problem: string) => candidates.set(element, [...(candidates.get(element) ?? []), problem]);
  for (const problem of problems) {
    if (problem.id === "dm-weak") add(producerOf(m09.dayMasterElement), problem.id);
    else if (problem.id === "dm-strong") add(controllerOf(m09.dayMasterElement), problem.id);
    else if (problem.id === "climate") for (const element of [...m13.temperature.candidateElements, ...m13.humidity.candidateElements]) add(element, problem.id);
    else if (problem.id.startsWith("flow-")) { const path = m12.paths.find((item) => problem.id === `flow-${item.source}`); if (path) add(path.bridge, problem.id); }
  }
  const medicines = [...candidates].map(([element, ids]): MedicineCandidate => ({ element, problemIds: Object.freeze([...new Set(ids)]), mechanism: "DIRECTLY_ADDRESS_IDENTIFIED_ROOT_OR_PATH", routeStatus: ids.length > 0 ? "direct" : "conditional", overdoseRisk: "EXCESS_CAN_CREATE_SECONDARY_IMBALANCE" }));
  return { moduleId: "M0.M16", status: m09.status, problems: Object.freeze(problems), medicines: Object.freeze(medicines), matchedRuleIds: Object.freeze(["M16-GEN-0001-V1.0", "M16-MED-0077-V1.0", "M16-DOSE-0087-V1.0", "M16-RANK-0097-V1.0", "M16-BOUND-0107-V1.0"] ) };
}
