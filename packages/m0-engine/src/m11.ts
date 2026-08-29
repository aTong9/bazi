import type { TenGod } from "./m02.js";
import type { M09Result } from "./m09.js";
import type { M10Result } from "./m10.js";

export interface TenGodCombination {
  readonly name: "食神制杀" | "杀印相生" | "官印相生" | "伤官配印" | "食伤生财" | "财生官";
  readonly participants: readonly TenGod[];
  readonly status: "candidate";
  readonly conditions: readonly string[];
  readonly ruleId: string;
}
export interface M11Result { readonly moduleId: "M0.M11"; readonly status: "complete" | "limited"; readonly combinations: readonly TenGodCombination[]; readonly matchedRuleIds: readonly string[]; readonly patternDeclared: false }

const DEFINITIONS: readonly [TenGodCombination["name"], readonly TenGod[], string][] = [
  ["食神制杀", ["食神", "七杀"], "M11-SHIZHI-0011-V1.0"], ["杀印相生", ["七杀", "偏印"], "M11-SHAYIN-0021-V1.0"],
  ["官印相生", ["正官", "正印"], "M11-GUANYIN-0029-V1.0"], ["伤官配印", ["伤官", "正印"], "M11-SHANGYIN-0037-V1.0"],
  ["食伤生财", ["食神", "偏财"], "M11-SHENGCAI-0047-V1.0"], ["财生官", ["正财", "正官"], "M11-CAIGUAN-0057-V1.0"],
];
export function analyzeM11(m10: M10Result, m09: M09Result): M11Result {
  const combinations = DEFINITIONS.flatMap(([name, participants, ruleId]) => participants.every((god) => m10.tenGods[god].presence !== "absent" && m10.tenGods[god].effectivePower !== "weak_candidate") ? [{ name, participants, status: "candidate" as const, conditions: Object.freeze([`DAY_MASTER:${m09.strengthCandidate}`, "PATH_AND_BALANCE_REQUIRE_CONFIRMATION"]), ruleId }] : []);
  const matched = ["M11-GEN-0001-V1.0", "M11-BOUND-0101-V1.0", "M11-BOUND-0102-V1.0", ...combinations.map((item) => item.ruleId)];
  return { moduleId: "M0.M11", status: m10.status, combinations: Object.freeze(combinations), matchedRuleIds: Object.freeze([...new Set(matched)].sort()), patternDeclared: false };
}
