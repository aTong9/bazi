import type { FiveElement, M02Result, PillarPosition, TenGod } from "./m02.js";
import type { M08Result } from "./m08.js";
import type { M09Result } from "./m09.js";

const TEN_GODS: readonly TenGod[] = ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"];
export interface TenGodState {
  readonly tenGod: TenGod;
  readonly element: FiveElement | null;
  readonly presence: "absent" | "hidden" | "visible";
  readonly visiblePositions: readonly PillarPosition[];
  readonly hiddenPositions: readonly PillarPosition[];
  readonly effectivePower: "weak_candidate" | "balanced_candidate" | "strong_candidate" | "not_present";
  readonly purity: "pure" | "mixed" | "not_applicable";
  readonly functionStatus: "candidate" | "not_present";
  readonly favorability: "pending";
}
export interface M10Result {
  readonly moduleId: "M0.M10";
  readonly status: "complete" | "limited";
  readonly tenGods: Readonly<Record<TenGod, TenGodState>>;
  readonly matchedRuleIds: readonly string[];
  readonly nameCountUsedAsVerdict: false;
}

export function analyzeM10(m02: M02Result, m08: M08Result, _m09: M09Result): M10Result {
  const pillars = Object.values(m02.pillars).filter((pillar): pillar is NonNullable<typeof pillar> => pillar !== null);
  const matched = new Set<string>(["M10-BOUND-0115-V1.0", "M10-BOUND-0116-V1.0", "M10-BOUND-0117-V1.0", "M10-BOUND-0118-V1.0", "M10-BOUND-0119-V1.0", "M10-BOUND-0120-V1.0"]);
  const entries = TEN_GODS.map((tenGod): [TenGod, TenGodState] => {
    const visibleFacts = pillars.filter((pillar) => pillar.stem.tenGod === tenGod);
    const hiddenFacts = pillars.filter((pillar) => pillar.branch.hiddenStems.some((stem) => stem.tenGod === tenGod));
    const element = visibleFacts[0]?.stem.element ?? pillars.flatMap((pillar) => pillar.branch.hiddenStems).find((stem) => stem.tenGod === tenGod)?.element ?? null;
    const presence = visibleFacts.length > 0 ? "visible" : hiddenFacts.length > 0 ? "hidden" : "absent";
    if (presence === "visible") matched.add("M10-PRES-0001-V1.0");
    else if (presence === "hidden") matched.add("M10-PRES-0002-V1.0");
    const power = element ? m08.elements[element].effectiveStrengthCandidate : "not_present";
    const forms = Number(visibleFacts.length > 0) + Number(hiddenFacts.length > 0);
    const purity = presence === "absent" ? "not_applicable" : forms === 1 ? "pure" : "mixed";
    if (presence !== "absent") matched.add("M10-POWER-0013-V1.0");
    if (purity === "pure") matched.add("M10-PURE-0025-V1.0");
    return [tenGod, Object.freeze({ tenGod, element, presence, visiblePositions: Object.freeze(visibleFacts.map((pillar) => pillar.position)), hiddenPositions: Object.freeze(hiddenFacts.map((pillar) => pillar.position)), effectivePower: power, purity, functionStatus: presence === "absent" ? "not_present" : "candidate", favorability: "pending" })];
  });
  return { moduleId: "M0.M10", status: m02.status === "complete" ? "complete" : "limited", tenGods: Object.freeze(Object.fromEntries(entries) as Record<TenGod, TenGodState>), matchedRuleIds: Object.freeze([...matched].sort()), nameCountUsedAsVerdict: false };
}
