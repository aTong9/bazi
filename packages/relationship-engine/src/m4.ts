import type { M3Result } from "./m3.js";
import type { RelationshipRuleCatalog } from "./rule-catalog.js";

export interface M4Observation {
  readonly id: string;
  readonly chainId: string;
  readonly source: string;
  readonly context: string;
  readonly direction: "supports" | "contradicts";
}
export interface M4RiskChain {
  readonly id: string;
  readonly structuralCandidate: string;
  readonly realityStatus: "unconfirmed" | "mixed_evidence" | "observed_pattern" | "contradicted";
  readonly evidenceIds: readonly string[];
  readonly repair: { readonly chainId: string; readonly actions: readonly string[] };
  readonly buffer: { readonly chainId: string; readonly conditions: readonly string[] };
}
export interface M4Result {
  readonly moduleId: "M4.SYNTH";
  readonly status: "provisional";
  readonly stageOrder: readonly ["BASE", "MISREAD", "OVERUSE", "TRIGGER", "LOOP", "REPAIR", "BUFFER", "SYNTH"];
  readonly riskChains: readonly M4RiskChain[];
  readonly stages: {
    readonly base: { readonly status: "candidate"; readonly candidates: readonly string[] };
    readonly misread: { readonly status: "candidate"; readonly hypotheses: readonly string[] };
    readonly overuse: { readonly status: "candidate"; readonly modifiers: readonly string[] };
    readonly trigger: { readonly status: "candidate"; readonly conditions: readonly string[] };
    readonly loop: { readonly status: "unconfirmed" | "observed" | "mixed" | "contradicted"; readonly chainIds: readonly string[] };
    readonly repair: { readonly status: "candidate"; readonly routes: readonly { readonly chainId: string; readonly actions: readonly string[] }[] };
    readonly buffer: { readonly status: "candidate"; readonly protections: readonly { readonly chainId: string; readonly conditions: readonly string[] }[] };
    readonly synth: { readonly status: "provisional"; readonly observedCount: number; readonly unconfirmedCount: number };
  };
  readonly boundaries: readonly string[];
  readonly ruleTrace: readonly string[];
}

export function analyzeM4(input: { readonly m3: M3Result; readonly observations?: readonly M4Observation[]; readonly rules?: RelationshipRuleCatalog }): M4Result {
  const candidates = [
    input.m3.channels.boundary.statements[0] ?? "边界信号可能未被明确确认",
    input.m3.channels.conflict.statements[0] ?? "压力下冲突循环可能被放大",
  ];
  const observations = dedupeObservations(input.observations ?? []);
  const riskChains = candidates.map((structuralCandidate, index): M4RiskChain => {
    const id = `M4-C0${index + 1}`;
    const evidence = observations.filter((item) => item.chainId === id);
    const supports = evidence.filter((item) => item.direction === "supports");
    const contradicts = evidence.filter((item) => item.direction === "contradicts");
    const independentSupport = new Set(supports.map((item) => `${item.source}\u0000${item.context}`)).size;
    const realityStatus = contradicts.length && supports.length ? "mixed_evidence" : contradicts.length ? "contradicted" : independentSupport >= 2 ? "observed_pattern" : "unconfirmed";
    return Object.freeze({ id, structuralCandidate, realityStatus, evidenceIds: Object.freeze(evidence.map((item) => item.id)), repair: Object.freeze({ chainId: id, actions: input.m3.repair.steps }), buffer: Object.freeze({ chainId: id, conditions: Object.freeze(["明确同意", "允许暂停", "观察行为变化"]) }) });
  });
  const stageTrace = ["BASE", "MISREAD", "OVERUSE", "TRIGGER", "LOOP", "REPAIR", "BUFFER", "SYNTH"].flatMap((stage) => input.rules?.getModuleRecords(`M4.${stage}`).slice(0, 8).map((record) => record.id) ?? []);
  const loopStatuses = riskChains.map((chain) => chain.realityStatus);
  const loopStatus = loopStatuses.includes("observed_pattern") ? "observed" : loopStatuses.includes("mixed_evidence") ? "mixed" : loopStatuses.includes("contradicted") ? "contradicted" : "unconfirmed";
  const stages = Object.freeze({
    base: Object.freeze({ status: "candidate" as const, candidates: Object.freeze(candidates) }),
    misread: Object.freeze({ status: "candidate" as const, hypotheses: Object.freeze(candidates.map((candidate) => `可能误读：${candidate}`)) }),
    overuse: Object.freeze({ status: "candidate" as const, modifiers: input.m3.state.modifiers }),
    trigger: Object.freeze({ status: "candidate" as const, conditions: Object.freeze([input.m3.repair.trigger, ...input.m3.repair.stopConditions]) }),
    loop: Object.freeze({ status: loopStatus, chainIds: Object.freeze(riskChains.map((chain) => chain.id)) }),
    repair: Object.freeze({ status: "candidate" as const, routes: Object.freeze(riskChains.map((chain) => chain.repair)) }),
    buffer: Object.freeze({ status: "candidate" as const, protections: Object.freeze(riskChains.map((chain) => chain.buffer)) }),
    synth: Object.freeze({ status: "provisional" as const, observedCount: riskChains.filter((chain) => chain.realityStatus === "observed_pattern").length, unconfirmedCount: riskChains.filter((chain) => chain.realityStatus === "unconfirmed").length }),
  });
  return Object.freeze({ moduleId: "M4.SYNTH", status: "provisional", stageOrder: Object.freeze(["BASE", "MISREAD", "OVERUSE", "TRIGGER", "LOOP", "REPAIR", "BUFFER", "SYNTH"] as const), stages, riskChains: Object.freeze(riskChains), boundaries: Object.freeze(["结构风险不等于现实伤害", "单次陈述不确认重复模式", "保护因素只有改变同一风险链才有效", "安全风险优先进入现实闸门"]), ruleTrace: Object.freeze([...new Set([...input.m3.ruleTrace, ...stageTrace])]) });
}

function dedupeObservations(values: readonly M4Observation[]): readonly M4Observation[] {
  const seen = new Map<string, string>();
  return Object.freeze(values.filter((value) => {
    const fingerprint = JSON.stringify(value);
    const previous = seen.get(value.id);
    if (previous && previous !== fingerprint) throw new Error(`Conflicting observation: ${value.id}`);
    if (previous) return false;
    seen.set(value.id, fingerprint);
    return true;
  }));
}
