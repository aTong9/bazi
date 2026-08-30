import type { TenGod } from "../../m0-engine/src/m02.js";
import type { M02Result } from "../../m0-engine/src/m02.js";
import type { M09Result } from "../../m0-engine/src/m09.js";
import type { M10Result } from "../../m0-engine/src/m10.js";
import type { M1Result } from "./m1.js";
import { field, unique, type RelationshipRuleCatalog } from "./rule-catalog.js";

export interface M2Result {
  readonly moduleId: "M2.SYNTH"; readonly status: "provisional" | "dependency_pending";
  readonly gate: { readonly dayBranchTenGod: TenGod; readonly themes: readonly string[]; readonly evidence: readonly string[] };
  readonly qualification: { readonly spouseStars: readonly TenGod[]; readonly evidence: readonly string[] };
  readonly selfPosition: { readonly class: "stable" | "conditional" | "strained"; readonly conditions: readonly string[] };
  readonly flow: { readonly start: readonly string[]; readonly bridge: readonly string[]; readonly end: readonly string[] };
  readonly dual: { readonly status: "single" | "parallel" | "pending"; readonly candidates: readonly string[] };
  readonly tempo: { readonly class: "direct_confirmation" | "observe_then_confirm" | "multi_round" | "pending"; readonly evidenceRounds: number; readonly calendarDuration: null };
  readonly synthesis: { readonly summary: readonly string[]; readonly scopeBoundary: readonly string[] };
  readonly dependencyFlags: readonly string[]; readonly ruleTrace: readonly string[];
}
export function analyzeM2(input: { m02: M02Result; m09: M09Result; m10: M10Result; m1: M1Result; rules: RelationshipRuleCatalog }): M2Result {
  const dayBranchTenGod = input.m02.pillars.day.branch.hiddenStems[0]!.tenGod;
  const gateRules = input.rules.getModuleRecords("M2.GATE").filter((record) => field(record, "main_signal").includes(`日支主气${dayBranchTenGod}`));
  const themes = unique(gateRules.map((record) => field(record, "palace_signal")).filter((value) => value && !/待|无/u.test(value)));
  const gateEvidence = unique(gateRules.filter((record) => ["primary_gate", "proof_needed"].includes(field(record, "output_slot"))).map((record) => field(record, "user_explanation")));
  const spouseStars = input.m1.prototypes.map((prototype) => prototype.tenGod);
  const coreRules = input.rules.getModuleRecords("M2.CORE").filter((record) => spouseStars.some((god) => field(record, "main_signal").includes(god)));
  const qualificationEvidence = unique(coreRules.filter((record) => ["primary_gate", "proof_needed"].includes(field(record, "output_slot"))).map((record) => field(record, "user_explanation")));
  const selfClass = input.m09.strengthCandidate === "strong_candidate" ? "stable" : input.m09.strengthCandidate === "weak_candidate" ? "strained" : "conditional";
  const selfRules = input.rules.getModuleRecords("M2.SELF").filter((record) => ["module_definition", "self_dimension_map", "self_position"].includes(field(record, "output_slot"))).slice(0, 12);
  const start = unique([...themes, ...spouseStars.map(String)]); const bridge = unique([...gateEvidence.slice(0, 2), ...qualificationEvidence.slice(0, 2)]); const end = unique(qualificationEvidence.length ? qualificationEvidence.slice(0, 2) : gateEvidence.slice(0, 2));
  const flowRules = input.rules.getModuleRecords("M2.FLOW").filter((record) => ["module_definition", "flow_structure", "proof_needed"].includes(field(record, "output_slot"))).slice(0, 12);
  const dualCandidates = unique([...themes, ...spouseStars]); const dualStatus = dualCandidates.length > 1 ? "parallel" : dualCandidates.length === 1 ? "single" : "pending";
  const dualRules = input.rules.getModuleRecords("M2.DUAL").filter((record) => ["module_definition", "proof_threshold"].includes(field(record, "output_slot"))).slice(0, 10);
  const evidenceRounds = Math.max(1, Number(gateEvidence.length > 0) + Number(qualificationEvidence.length > 0) + Number(selfClass !== "stable"));
  const tempoClass = evidenceRounds >= 3 ? "multi_round" : evidenceRounds === 2 ? "observe_then_confirm" : "direct_confirmation";
  const tempoRules = input.rules.getModuleRecords("M2.TEMPO").filter((record) => ["module_definition", "tempo_start"].includes(field(record, "output_slot"))).slice(0, 10);
  const synthRules = input.rules.getModuleRecords("M2.SYNTH").filter((record) => ["module_definition", "scope_guard"].includes(field(record, "output_slot"))).slice(0, 10);
  const trace = unique([...gateRules, ...coreRules, ...selfRules, ...flowRules, ...dualRules, ...tempoRules, ...synthRules].map((record) => record.id));
  const dependencies = [...(input.m1.status === "dependency_pending" ? ["M1_TRADITIONAL_ROLE_BASIS_REQUIRED"] : []), ...(end.length === 0 ? ["M2_CONFIRMATION_END_MISSING"] : [])];
  return { moduleId: "M2.SYNTH", status: dependencies.length ? "dependency_pending" : "provisional", gate: { dayBranchTenGod, themes, evidence: gateEvidence }, qualification: { spouseStars: Object.freeze(spouseStars), evidence: qualificationEvidence }, selfPosition: { class: selfClass, conditions: Object.freeze(["NOT_A_PERSONALITY_OR_CONSENT_INFERENCE"]) }, flow: { start, bridge, end }, dual: { status: dualStatus, candidates: dualCandidates }, tempo: { class: dependencies.length ? "pending" : tempoClass, evidenceRounds, calendarDuration: null }, synthesis: { summary: unique([...gateEvidence.slice(0, 1), ...qualificationEvidence.slice(0, 1)]), scopeBoundary: Object.freeze(["只解释关系选择机制", "不判断对象好坏或关系结果", "不预测具体时间"]) }, dependencyFlags: Object.freeze(dependencies), ruleTrace: trace };
}
