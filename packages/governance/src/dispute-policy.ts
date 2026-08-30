export interface ImplementedDisputePolicy {
  readonly testId: string;
  readonly targetRuleId: string;
  readonly disposition: "parameterized_only" | "conditional_no_fixed_weight";
  readonly invariant: string;
}

export const IMPLEMENTED_DISPUTE_POLICIES: Readonly<Record<string, ImplementedDisputePolicy>> = Object.freeze({
  "M20-DISPUTE-0149-V1.0": Object.freeze({
    testId: "M20-DISPUTE-0149-V1.0",
    targetRuleId: "M14-JIANREN-0048-V1.0",
    disposition: "parameterized_only",
    invariant: "阴干羊刃不得成为跨流派硬规则；未显式选择流派时只保留条件候选，不改变最终格局。",
  }),
  "M20-DISPUTE-0150-V1.0": Object.freeze({
    testId: "M20-DISPUTE-0150-V1.0",
    targetRuleId: "M13-BOUND-0068-V1.0",
    disposition: "conditional_no_fixed_weight",
    invariant: "辰丑增湿、未戌增燥仅作为基础证据，必须由全局寒暖、燥湿、合冲和有效五行修正，不使用固定权重。",
  }),
});

export function validateImplementedDisputePolicy(testId: string, targetRuleIds: readonly string[]): readonly string[] {
  const policy = IMPLEMENTED_DISPUTE_POLICIES[testId];
  if (!policy) return Object.freeze(["DISPUTE_POLICY_NOT_IMPLEMENTED"]);
  if (!targetRuleIds.includes(policy.targetRuleId)) return Object.freeze(["DISPUTE_POLICY_TARGET_MISMATCH"]);
  return Object.freeze([]);
}
