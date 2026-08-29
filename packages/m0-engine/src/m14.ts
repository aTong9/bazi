import type { M02Result, TenGod } from "./m02.js";
import type { M09Result } from "./m09.js";
import type { M10Result } from "./m10.js";
import type { M11Result } from "./m11.js";

export interface PatternCandidate { readonly id: string; readonly name: string; readonly category: "ordinary" | "special"; readonly keyGods: readonly TenGod[]; readonly status: "candidate"; readonly evidence: readonly string[]; readonly vetoes: readonly string[] }
export interface M14Result { readonly moduleId: "M0.M14"; readonly status: "complete" | "limited"; readonly candidates: readonly PatternCandidate[]; readonly matchedRuleIds: readonly string[]; readonly finalPatternDeclared: false }
const PATTERNS: Partial<Record<TenGod, { name: string; ruleId: string }>> = {
  正官: { name: "正官格候选", ruleId: "M14-GUAN-0009-V1.0" }, 七杀: { name: "七杀格候选", ruleId: "M14-SHA-0015-V1.0" },
  正印: { name: "印格候选", ruleId: "M14-YIN-0021-V1.0" }, 偏印: { name: "印格候选", ruleId: "M14-YIN-0021-V1.0" },
  正财: { name: "财格候选", ruleId: "M14-CAI-0027-V1.0" }, 偏财: { name: "财格候选", ruleId: "M14-CAI-0027-V1.0" },
  食神: { name: "食神格候选", ruleId: "M14-SHISHANG-0033-V1.0" }, 伤官: { name: "伤官格候选", ruleId: "M14-SHISHANG-0033-V1.0" },
  比肩: { name: "建禄格候选", ruleId: "M14-JIANREN-0041-V1.0" }, 劫财: { name: "羊刃格候选", ruleId: "M14-JIANREN-0041-V1.0" },
};
export function analyzeM14(m02: M02Result, m09: M09Result, m10: M10Result, m11: M11Result): M14Result {
  const monthGods = [...new Set(m02.pillars.month.branch.hiddenStems.map((stem) => stem.tenGod))];
  const candidates = monthGods.flatMap((god, index) => {
    const definition = PATTERNS[god]; if (!definition || m10.tenGods[god].presence === "absent") return [];
    return [{ id: `M14:${index}:${god}`, name: definition.name, category: "ordinary" as const, keyGods: [god], status: "candidate" as const, evidence: Object.freeze([`MONTH_QI:${god}`, `POWER:${m10.tenGods[god].effectivePower}`, `DAY_MASTER:${m09.strengthCandidate}`, ...(m11.combinations.some((item) => item.participants.includes(god)) ? ["COMBINATION_SUPPORT"] : [])]), vetoes: Object.freeze(m10.tenGods[god].effectivePower === "weak_candidate" ? ["KEY_GOD_WEAK"] : []) }];
  });
  const rules = candidates.map((candidate) => PATTERNS[candidate.keyGods[0]!]?.ruleId).filter((id): id is string => Boolean(id));
  return { moduleId: "M0.M14", status: m02.status === "complete" ? "complete" : "limited", candidates: Object.freeze(candidates), matchedRuleIds: Object.freeze([...new Set(["M14-GEN-0001-V1.0", "M14-RANK-0071-V1.0", "M14-BOUND-0077-V1.0", "M14-BOUND-0078-V1.0", ...rules])].sort()), finalPatternDeclared: false };
}
