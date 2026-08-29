import type { AnalysisResponse, RealityGateId, RealityGateStatus, ResultItem } from "../types";

interface AnalysisFixtureOptions {
  safetyStop?: boolean;
  includeOrdinarySectionDuringStop?: boolean;
  gateStatuses?: Partial<Record<RealityGateId, RealityGateStatus>>;
}

const gateIds: readonly RealityGateId[] = ["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"];

function resultItem(value: unknown, status = "supported", confidence = "medium"): ResultItem {
  return { value, status, confidence, conditions: [], ruleIds: [] };
}

export function makeAnalysisResponse(options: AnalysisFixtureOptions = {}): AnalysisResponse {
  const isSafetyStop = options.safetyStop ?? false;
  const fields: Record<string, ResultItem> = {
    day_master_and_season: resultItem({ dayMaster: "甲", element: "木", yinYang: "阳", monthBranch: "寅", seasonElement: "木" }),
    day_master_strength: resultItem("balanced_candidate"),
    temperature_state: resultItem({ state: "balanced", evidence: [], candidateElements: [] }),
    moisture_state: resultItem({ state: "balanced", evidence: [], candidateElements: [] }),
    primary_and_auxiliary_use: resultItem({ primary: [], auxiliary: [] }),
  };
  const gates = gateIds.map((id) => ({
    id,
    label: `${id} 现实闸门`,
    status: options.gateStatuses?.[id] ?? (isSafetyStop && id === "RG01" ? "fail" : "pass"),
    evidenceIds: id === "RG01" ? ["event-01"] : [],
  }));
  const reportSections = isSafetyStop
    ? [
        { id: "safety", title: "安全与边界", body: "现实安全事实优先，普通适配叙事停止。" },
        ...(options.includeOrdinarySectionDuringStop ? [{ id: "profile", title: "不应显示", body: "ORDINARY-CONTENT-MUST-STAY-HIDDEN" }] : []),
      ]
    : [
        { id: "profile", title: "关系结构候选", body: "结构候选正文" },
        { id: "risk", title: "风险与现实核验", body: "现实核验正文" },
      ];

  return {
    requestId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-08-30T08:00:00.000Z",
    rulesetDigest: "a".repeat(64),
    sourceIds: [],
    ruleTrace: [],
    m0: { status: "complete", fields, dependencyFlags: [] },
    relationship: {
      status: "provisional",
      roleBasis: "female_traditional",
      dependencyFlags: [],
      ruleTrace: [],
      structuralSupplement: {
        available: false,
        scope: "structural_auxiliary_only",
        replacesRealityEvidence: false,
        replacesRealityGates: false,
        fields: null,
      },
      m1: {
        status: "provisional",
        prototypes: [],
        synthesis: { primarySignals: ["正官"], statements: [] },
      },
      m2: {
        status: "provisional",
        gate: { dayBranchTenGod: "比肩", themes: ["边界"], evidence: [] },
        selfPosition: { class: "conditional" },
        tempo: { class: "observe_then_confirm", evidenceRounds: 2 },
        synthesis: { summary: ["需要多轮现实核验"], scopeBoundary: ["不判断关系结果"] },
      },
      m3: {
        status: "provisional",
        state: { activeState: "steady", modifiers: [] },
        synthesis: { primaryChannels: ["boundary"], statements: ["先确认边界"] },
        repair: { trigger: "MISALIGNMENT", steps: ["PAUSE"], stopConditions: ["CONSENT_WITHDRAWN"] },
        boundaries: ["不推断人格"],
      },
      m4: {
        status: "provisional",
        riskChains: [{ id: "M4-C01", structuralCandidate: "结构风险候选", realityStatus: "unconfirmed", evidenceIds: [], repair: { actions: ["暂停"] }, buffer: { conditions: ["明确同意"] } }],
        boundaries: ["候选不等于事实"],
      },
      m5: {
        mode: "specific_partner_with_reality_data",
        reportStatus: isSafetyStop ? "stop" : "limited",
        safetyStatus: isSafetyStop ? "safety_stop" : "standard",
        realityGates: gates,
        crossStateEvidence: [],
        observationPlan: isSafetyStop ? [] : [{ gateId: "RG04", observe: "观察生活节奏", directive: false }],
        fit: {
          grade: isSafetyStop ? "FG0" : "FG2",
          assessment: isSafetyStop ? "AF09" : "AF02",
          residualRisks: [],
          decisionCodes: [],
          isSuccessProbability: false,
        },
        boundaries: ["不是成功概率"],
      },
    },
    report: {
      reportStatus: isSafetyStop ? "stop" : "limited",
      safetyStatus: isSafetyStop ? "safety_stop" : "standard",
      evidenceGrade: isSafetyStop ? "FG0" : "FG2",
      assessment: isSafetyStop ? "AF09" : "AF02",
      fields,
      sections: reportSections,
      realityGates: gates,
      observationPlan: isSafetyStop ? [] : [{ gateId: "RG04", observe: "观察生活节奏", directive: false }],
      boundaries: [{ code: "NOT_FATE", hard: true, text: "本报告不是命定结果。" }],
      trace: { ruleIds: [], sourceIds: [], eventIds: [] },
    },
  };
}
