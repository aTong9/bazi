import type { EarthlyBranch } from "../../domain/src/birth-input.js";
import type { FiveElement, M02Result } from "./m02.js";
import type { M08Result } from "./m08.js";

export interface M13Result {
  readonly moduleId: "M0.M13"; readonly status: "complete" | "limited";
  readonly temperature: { readonly baseline: "cold" | "cool" | "balanced" | "warm" | "hot"; readonly state: "cold" | "cool" | "balanced" | "warm" | "hot"; readonly candidateElements: readonly FiveElement[] };
  readonly humidity: { readonly baseline: "dry" | "balanced" | "humid"; readonly state: "dry" | "balanced" | "humid"; readonly candidateElements: readonly FiveElement[] };
  readonly conflicts: readonly string[]; readonly matchedRuleIds: readonly string[]; readonly finalUsefulGodDeclared: false;
}
const TEMP: Record<EarthlyBranch, M13Result["temperature"]["baseline"]> = { 寅: "cool", 卯: "balanced", 辰: "balanced", 巳: "warm", 午: "hot", 未: "hot", 申: "warm", 酉: "cool", 戌: "cool", 亥: "cold", 子: "cold", 丑: "cold" };
const HUMID: Record<EarthlyBranch, M13Result["humidity"]["baseline"]> = { 寅: "balanced", 卯: "balanced", 辰: "humid", 巳: "dry", 午: "dry", 未: "dry", 申: "balanced", 酉: "dry", 戌: "dry", 亥: "humid", 子: "humid", 丑: "humid" };
export function analyzeM13(m02: M02Result, m08: M08Result): M13Result {
  const month = m02.pillars.month.branch.branch; const baselineTemp = TEMP[month]; const baselineHumidity = HUMID[month];
  const waterStrong = materiallyPresent(m08, "水"); const fireStrong = materiallyPresent(m08, "火");
  const temperatureState = baselineTemp === "cold" && fireStrong ? "cool" : baselineTemp === "hot" && waterStrong ? "warm" : baselineTemp;
  const humidityState = baselineHumidity === "humid" && fireStrong ? "balanced" : baselineHumidity === "dry" && waterStrong ? "balanced" : baselineHumidity;
  const temperatureCandidates: FiveElement[] = temperatureState === "cold" || temperatureState === "cool" ? ["火"] : temperatureState === "hot" || temperatureState === "warm" ? ["水"] : [];
  const humidityCandidates: FiveElement[] = humidityState === "humid" ? ["火", "土"] : humidityState === "dry" ? ["水", "木"] : [];
  return { moduleId: "M0.M13", status: m02.status === "complete" ? "complete" : "limited", temperature: Object.freeze({ baseline: baselineTemp, state: temperatureState, candidateElements: Object.freeze(temperatureCandidates) }), humidity: Object.freeze({ baseline: baselineHumidity, state: humidityState, candidateElements: Object.freeze(humidityCandidates) }), conflicts: Object.freeze(temperatureCandidates.filter((element) => humidityCandidates.includes(element)).length === 0 && temperatureCandidates.length && humidityCandidates.length ? ["TEMPERATURE_HUMIDITY_CANDIDATES_DIVERGE"] : []), matchedRuleIds: Object.freeze(["M13-GEN-0001-V1.0", "M13-SEASON-0009-V1.0", "M13-TEMP-0021-V1.0", "M13-HUMID-0031-V1.0", "M13-BOUND-0065-V1.0", "M13-BOUND-0066-V1.0"]), finalUsefulGodDeclared: false };
}

function materiallyPresent(m08: M08Result, element: FiveElement): boolean {
  const state = m08.elements[element];
  const independentPresence = state.retainedEvidence.filter((item) => item.startsWith("VISIBLE:") || item.startsWith("ROOT:")).length;
  return state.effectiveStrengthCandidate === "strong_candidate" || (state.effectiveStrengthCandidate !== "weak_candidate" && independentPresence >= 2);
}
