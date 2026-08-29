type ReportStatus = "complete" | "limited" | "stop";
type SafetyStatus = "standard" | "safety_stop" | "insufficient_data" | "core_gate_stop";
type FitGrade = "FG0" | "FG1" | "FG2" | "FG3" | "FG4";
type AssessmentFlag = `AF0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

export interface ReportProjectionInput {
  readonly analysisRunId: string;
  readonly rulesetDigest: string;
  readonly reportStatus: ReportStatus;
  readonly safetyStatus: SafetyStatus;
  readonly fit: { readonly grade: FitGrade; readonly assessment: AssessmentFlag };
  readonly m0Fields: Readonly<Record<string, unknown>>;
  readonly profileStatements: readonly string[];
  readonly riskChains: readonly { readonly id: string; readonly candidate: string; readonly realityStatus: string }[];
  readonly realityGates: readonly { readonly id: string; readonly label: string; readonly status: string; readonly evidenceIds: readonly string[] }[];
  readonly ruleIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly eventIds: readonly string[];
  readonly dedupLog: readonly string[];
  readonly conflictLog: readonly string[];
  readonly discardedCandidates: readonly string[];
  readonly safetyReason?: string;
}

export function buildAnalysisReport(input: ReportProjectionInput) {
  const stopped = input.reportStatus === "stop" || input.safetyStatus === "safety_stop";
  const sections = stopped
    ? [{ id: "safety" as const, title: "安全与边界", body: input.safetyReason ?? "现实资料触发安全停止；普通适配叙事已停止。" }]
    : [
        { id: "profile" as const, title: "关系结构候选", body: input.profileStatements.join("；") || "当前没有足够资料形成结构候选。" },
        { id: "risk" as const, title: "风险与现实核验", body: input.riskChains.map((chain) => `${chain.candidate}（${chain.realityStatus}）`).join("；") || "暂无已确认风险模式。" },
        { id: "reality" as const, title: "现实闸门", body: input.realityGates.map((gate) => `${gate.id} ${gate.label}：${gate.status}`).join("；") },
      ];
  for (const section of sections) {
    const violations = validateReportLanguage(section.body);
    if (violations.length) throw new Error(`Unsafe report language: ${violations.join(",")}`);
  }
  return Object.freeze({
    schemaVersion: "1.0" as const,
    analysisRunId: input.analysisRunId,
    rulesetDigest: input.rulesetDigest,
    reportStatus: input.reportStatus,
    safetyStatus: input.safetyStatus,
    evidenceGrade: input.fit.grade,
    assessment: input.fit.assessment,
    fields: input.m0Fields,
    sections: Object.freeze(sections.map((section) => Object.freeze(section))),
    realityGates: input.realityGates,
    observationPlan: Object.freeze(stopped ? [] : input.realityGates.filter((gate) => gate.status !== "pass").map((gate) => Object.freeze({ gateId: gate.id, observe: gate.label, directive: false as const }))),
    trace: Object.freeze({ ruleIds: unique(input.ruleIds), sourceIds: unique(input.sourceIds), eventIds: unique(input.eventIds) }),
    logs: Object.freeze({ dedup: unique(input.dedupLog), conflicts: unique(input.conflictLog), discardedCandidates: unique(input.discardedCandidates) }),
    boundaries: Object.freeze([
      Object.freeze({ code: "NOT_FATE", hard: true as const, text: "本报告不是命定结果。" }),
      Object.freeze({ code: "NOT_SUCCESS_PROBABILITY", hard: true as const, text: "FG 是证据发布等级，不是关系成功概率。" }),
      Object.freeze({ code: "NOT_DIRECTIVE", hard: true as const, text: "报告不替代当事人的同意、安全判断和现实决定。" }),
      Object.freeze({ code: "STRUCTURE_NOT_HARM", hard: true as const, text: "结构风险候选不等于现实伤害事实。" }),
    ]),
  });
}

const FORBIDDEN: readonly [RegExp, string][] = [
  [/(唯一|命中注定).{0,4}(正缘|伴侣)/u, "DETERMINISTIC_PARTNER"],
  [/(必然|一定|注定).{0,5}(结婚|离婚|分手|复合)/u, "DETERMINISTIC_OUTCOME"],
  [/(患有|确诊|诊断为).{0,8}(症|病|障碍)/u, "MEDICAL_DIAGNOSIS"],
  [/(必须|应该立即|务必).{0,8}(分手|结婚|离婚|复合)/u, "COERCIVE_DIRECTIVE"],
  [/(成功率|结婚概率|离婚概率).{0,4}\d+%/u, "PROBABILITY_CLAIM"],
];

export function validateReportLanguage(text: string): readonly string[] {
  return Object.freeze(FORBIDDEN.filter(([pattern]) => pattern.test(text)).map(([, code]) => code));
}

function unique(values: readonly string[]): readonly string[] { return Object.freeze([...new Set(values)].filter(Boolean)); }
