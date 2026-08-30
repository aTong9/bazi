import type { M02Result, TenGod } from "../../m0-engine/src/m02.js";
import type { M09Result } from "../../m0-engine/src/m09.js";
import type { M10Result } from "../../m0-engine/src/m10.js";
import { field, unique, type RelationshipRuleCatalog } from "./rule-catalog.js";

type ChannelKey = "base" | "expression" | "care" | "boundary" | "conflict";
export interface M3Channel { readonly moduleId: string; readonly anchorTenGod: TenGod; readonly statements: readonly string[]; readonly outputSlots: readonly string[]; readonly ruleIds: readonly string[]; readonly status: "provisional" | "limited" }
export interface M3Result {
  readonly moduleId: "M3.SYNTH"; readonly status: "provisional" | "limited";
  readonly channels: Readonly<Record<ChannelKey, M3Channel>>;
  readonly state: { readonly activeState: "steady" | "pressure"; readonly modifiers: readonly string[]; readonly preservesBaseline: true };
  readonly repair: { readonly trigger: string; readonly steps: readonly string[]; readonly stopConditions: readonly string[] };
  readonly synthesis: { readonly primaryChannels: readonly ChannelKey[]; readonly statements: readonly string[] };
  readonly dependencyFlags: readonly string[]; readonly boundaries: readonly string[]; readonly ruleTrace: readonly string[];
  readonly calibration?: { readonly stateRepairSynthesis: "dependency_pending"; readonly requiredAsset: "M3_CASE_CALIBRATION" };
}
const MODULES: Readonly<Record<ChannelKey, string>> = { base: "M3.BASE", expression: "M3.EXPR", care: "M3.CARE", boundary: "M3.BOUND", conflict: "M3.CONFLICT" };
export function analyzeM3(input: { m02: M02Result; m09: M09Result; m10: M10Result; rules: RelationshipRuleCatalog }): M3Result {
  const status = input.m02.status === "limited" || input.m09.status === "limited" || input.m10.status === "limited" ? "limited" as const : "provisional" as const;
  const anchorTenGod = input.m02.pillars.day.branch.hiddenStems[0]!.tenGod;
  const channelEntries = (Object.entries(MODULES) as Array<[ChannelKey, string]>).map(([key, moduleId]): [ChannelKey, M3Channel] => {
    const records = input.rules.getModuleRecords(moduleId);
    const definitions = records.filter((record) => ["定义", "边界"].includes(field(record, "rule_type"))).slice(0, 2);
    const anchored = records.filter((record) => field(record, "main_signal").includes(anchorTenGod) || field(record, "required_conditions").includes(`日支${anchorTenGod}`)).slice(0, 12);
    const selected = [...definitions, ...anchored];
    const statements = unique(selected.map((record) => field(record, "user_explanation")).filter(Boolean)).slice(0, 5);
    return [key, Object.freeze({ moduleId, anchorTenGod, statements: Object.freeze(statements), outputSlots: unique(selected.map((record) => field(record, "output_slot"))), ruleIds: unique(selected.map((record) => record.id)), status })];
  });
  const channels = Object.freeze(Object.fromEntries(channelEntries) as Record<ChannelKey, M3Channel>);
  const pressure = input.m09.burdenEvidence.length > input.m09.supportEvidence.length || input.m09.strengthCandidate === "weak_candidate";
  const state = Object.freeze({ activeState: pressure ? "pressure" as const : "steady" as const, modifiers: Object.freeze(pressure ? ["REDUCE_CHANNEL_FLUENCY", "INCREASE_EXPLICIT_CONFIRMATION", "PRESERVE_PAUSE_OPTION"] : ["BASELINE_CHANNELS_AVAILABLE"]), preservesBaseline: true as const });
  const repair = Object.freeze({ trigger: pressure ? "PRESSURE_OR_CHANNEL_BREAK" : "DISAGREEMENT_OR_MISALIGNMENT", steps: Object.freeze(["PAUSE_WITHOUT_WITHDRAWAL_INFERENCE", "NAME_THE_ACTIVE_CHANNEL_AND_NEED", "MAKE_ONE_OBSERVABLE_REQUEST", "CONFIRM_RESPONSE_AND_BOUNDARY", "RESUME_OR_RENEGOTIATE"]), stopConditions: Object.freeze(["CONSENT_WITHDRAWN", "SAFETY_RISK_REQUIRES_M4", "EVIDENCE_INSUFFICIENT"]) });
  const primaryChannels = (Object.keys(channels) as ChannelKey[]).sort((a, b) => channels[b].statements.length - channels[a].statements.length).slice(0, 3);
  const synthesisStatements = unique(primaryChannels.flatMap((key) => channels[key].statements.slice(0, 1)));
  return { moduleId: "M3.SYNTH", status, channels, state, repair, synthesis: { primaryChannels: Object.freeze(primaryChannels), statements: synthesisStatements }, dependencyFlags: status === "limited" ? ["M3_HOUR_DEPENDENCY_LIMITED"] : [], calibration: Object.freeze({ stateRepairSynthesis: "dependency_pending", requiredAsset: "M3_CASE_CALIBRATION" }), boundaries: Object.freeze(["只描述关系建立后的互动机制", "不推断人格或依恋类型", "不判断关系结果或适配", "风险转M4，适配转M5"]), ruleTrace: unique(Object.values(channels).flatMap((channel) => channel.ruleIds)) };
}

export function unavailableM3Projection(): M3Result {
  const makeChannel = (moduleId: string): M3Channel => Object.freeze({ moduleId, anchorTenGod: "比肩", statements: Object.freeze([]), outputSlots: Object.freeze([]), ruleIds: Object.freeze([]), status: "limited" });
  return Object.freeze({ moduleId: "M3.SYNTH", status: "limited", channels: Object.freeze({ base: makeChannel("M3.BASE"), expression: makeChannel("M3.EXPR"), care: makeChannel("M3.CARE"), boundary: makeChannel("M3.BOUND"), conflict: makeChannel("M3.CONFLICT") }), state: Object.freeze({ activeState: "steady", modifiers: Object.freeze([]), preservesBaseline: true }), repair: Object.freeze({ trigger: "M3_MODULE_UNAVAILABLE", steps: Object.freeze([]), stopConditions: Object.freeze(["DEPENDENCY_PENDING"]) }), synthesis: Object.freeze({ primaryChannels: Object.freeze([]), statements: Object.freeze([]) }), dependencyFlags: Object.freeze(["M3_MODULE_UNAVAILABLE"]), calibration: Object.freeze({ stateRepairSynthesis: "dependency_pending", requiredAsset: "M3_CASE_CALIBRATION" }), boundaries: Object.freeze(["M3不可用时不得伪造相处、风险或修复结论"]), ruleTrace: Object.freeze([]) });
}
