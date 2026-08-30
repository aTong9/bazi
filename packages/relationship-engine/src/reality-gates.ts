export const REALITY_GATE_IDS = ["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"] as const;
export type RealityGateId = typeof REALITY_GATE_IDS[number];
export type RealityGateStatus = "pass" | "conditional" | "fail" | "unknown" | "not_assessed";

export interface RealityGateAssessment {
  readonly id: RealityGateId;
  readonly status: RealityGateStatus;
  readonly evidenceIds: readonly string[];
  readonly note?: string;
}

const LABELS: Readonly<Record<RealityGateId, string>> = {
  RG01: "安全、同意与尊重", RG02: "关系意图与承诺", RG03: "价值观与人生目标", RG04: "时间、地点与生活节奏",
  RG05: "金钱、资源与劳动", RG06: "家庭、生育与照护责任", RG07: "身体、亲密、隐私与健康", RG08: "冲突、修复与学习意愿",
};

export interface NormalizedRealityGate extends RealityGateAssessment { readonly label: string }

export function normalizeRealityGates(
  assessments: readonly RealityGateAssessment[] | undefined,
  fallback: "unknown" | "not_assessed",
): readonly NormalizedRealityGate[] {
  const byId = new Map<RealityGateId, RealityGateAssessment>();
  for (const assessment of assessments ?? []) {
    if (byId.has(assessment.id)) throw new Error(`Duplicate reality gate: ${assessment.id}`);
    byId.set(assessment.id, assessment);
  }
  return Object.freeze(REALITY_GATE_IDS.map((id) => {
    const value = byId.get(id);
    const evidenceIds = [...new Set((value?.evidenceIds ?? []).map((evidenceId) => evidenceId.trim()).filter(Boolean))];
    const submittedStatus = value?.status ?? fallback;
    const unsupportedNonNeutral = ["pass", "conditional", "fail"].includes(submittedStatus) && evidenceIds.length === 0;
    const conservativeSafetyFailure = submittedStatus === "fail" && (id === "RG01" || id === "RG07");
    const status = unsupportedNonNeutral && !conservativeSafetyFailure ? "unknown" : submittedStatus;
    const note = value?.note?.trim();
    return Object.freeze({ id, label: LABELS[id], status, evidenceIds: Object.freeze(evidenceIds), ...(note ? { note } : {}) });
  }));
}
