import type { AnalysisMode, CrossStateDraft, CrossStateKey, EarthlyBranch, HeavenlyStem, ObservationDraft, Pillar, RealityGateDraft, RoleBasis, SubjectDraft } from "./types";

export const HEAVENLY_STEMS: readonly HeavenlyStem[] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
export const EARTHLY_BRANCHES: readonly EarthlyBranch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
export const JIAZI: readonly string[] = Array.from({ length: 60 }, (_, index) => `${HEAVENLY_STEMS[index % 10]}${EARTHLY_BRANCHES[index % 12]}`);

export function inactiveSecondarySubject(): SubjectDraft {
  return { subjectId: "另一方", year: "己巳", month: "丙寅", day: "乙卯", hour: "丙子", birthTimeStatus: "exact", dataQuality: "high", birthInput: { method: "manual_four_pillars" } };
}

export function formatSubjectPillars(subject: SubjectDraft): string {
  return [subject.year, subject.month, subject.day, subject.birthTimeStatus === "unknown" ? "时柱未知" : subject.hour].join(" · ");
}

export function formatBirthInputSource(subject: SubjectDraft): string {
  const input = subject.birthInput;
  if (!input || input.method === "manual_four_pillars") return "手动四柱";
  return `${input.solarLocalDateTime.replace("T", " ")} · ${input.adapter.civilTimeBasis} · ${input.adapter.id} ${input.adapter.version}`;
}

const TIGER_STARTS: Readonly<Record<HeavenlyStem, HeavenlyStem>> = {
  甲: "丙", 己: "丙", 乙: "戊", 庚: "戊", 丙: "庚", 辛: "庚", 丁: "壬", 壬: "壬", 戊: "甲", 癸: "甲",
};
const RAT_STARTS: Readonly<Record<HeavenlyStem, HeavenlyStem>> = {
  甲: "甲", 己: "甲", 乙: "丙", 庚: "丙", 丙: "戊", 辛: "戊", 丁: "庚", 壬: "庚", 戊: "壬", 癸: "壬",
};

export function parsePillar(value: string): Pillar {
  if (!JIAZI.includes(value)) throw new Error(`无效干支：${value}`);
  return { stem: value[0] as HeavenlyStem, branch: value[1] as EarthlyBranch };
}

export function monthOptions(yearPillar: string): readonly string[] {
  const yearStem = parsePillar(yearPillar).stem;
  const start = HEAVENLY_STEMS.indexOf(TIGER_STARTS[yearStem]);
  const tiger = EARTHLY_BRANCHES.indexOf("寅");
  return EARTHLY_BRANCHES.map((branch) => {
    const offset = (EARTHLY_BRANCHES.indexOf(branch) - tiger + 12) % 12;
    return `${HEAVENLY_STEMS[(start + offset) % 10]}${branch}`;
  });
}

export function hourOptions(dayPillar: string): readonly string[] {
  const dayStem = parsePillar(dayPillar).stem;
  const start = HEAVENLY_STEMS.indexOf(RAT_STARTS[dayStem]);
  return EARTHLY_BRANCHES.map((branch, offset) => `${HEAVENLY_STEMS[(start + offset) % 10]}${branch}`);
}

export function normalizeLinkedPillars(subject: SubjectDraft): SubjectDraft {
  const allowedMonths = monthOptions(subject.year);
  const allowedHours = hourOptions(subject.day);
  const monthBranch = subject.month[1];
  const hourBranch = subject.hour[1];
  return {
    ...subject,
    month: allowedMonths.find((value) => value[1] === monthBranch) ?? allowedMonths[0]!,
    hour: allowedHours.find((value) => value[1] === hourBranch) ?? allowedHours[0]!,
  };
}

export function toWireSubject(subject: SubjectDraft) {
  return {
    input_mode: "four_pillars_provided" as const,
    subject_id: subject.subjectId.trim(),
    four_pillars: {
      year: parsePillar(subject.year),
      month: parsePillar(subject.month),
      day: parsePillar(subject.day),
      hour: subject.birthTimeStatus === "unknown" ? null : parsePillar(subject.hour),
    },
    birth_time_status: subject.birthTimeStatus,
    timezone: "Asia/Shanghai",
    data_quality: subject.dataQuality,
  };
}

export interface ObservationBinding {
  readonly basisFingerprint: string;
  readonly basisRequestId: string;
  readonly candidateFingerprints: ReadonlyMap<string, string>;
}

export function toWireObservations(observations: readonly ObservationDraft[], runId: string, binding?: ObservationBinding) {
  return observations
    .filter((observation) => observation.context.trim().length > 0 && (!binding || (
      observation.basisFingerprint === binding.basisFingerprint
      && observation.basisRequestId === binding.basisRequestId
      && observation.candidateFingerprint === binding.candidateFingerprints.get(observation.chainId)
    )))
    .map((observation) => ({
      id: `ui-${runId}-${observation.chainId}-${observation.slot}`,
      chainId: observation.chainId,
      source: observation.source,
      context: observation.context.trim(),
      direction: observation.direction,
    }));
}

export function toWireRealityGates(gates: readonly RealityGateDraft[], runId: string) {
  return gates.map((gate) => {
    const note = gate.note.trim();
    const status = isNonNeutralGateStatus(gate.status) && !note ? "unknown" as const : gate.status;
    return {
      id: gate.id,
      status,
      evidenceIds: isNonNeutralGateStatus(status) ? [`ui-${runId}-${gate.id}`] : [],
      ...(note ? { note } : {}),
    };
  });
}

export function toWireCrossState(crossState: CrossStateDraft, runId: string) {
  const validation = Object.fromEntries(CROSS_STATE_KEYS.map((state) => [state, crossState[state] && Boolean(crossState.evidence[state].trim())])) as Record<CrossStateKey, boolean>;
  const evidence = CROSS_STATE_KEYS.flatMap((state) => {
    const note = crossState.evidence[state].trim();
    return validation[state] ? [{ state, note, evidenceIds: [`ui-${runId}-cross-${state}`] }] : [];
  });
  return { validation, evidence };
}

export interface AnalysisFingerprintInput {
  readonly analysisMode: AnalysisMode;
  readonly roleBasis: RoleBasis;
  readonly primarySubject: SubjectDraft;
  readonly hasSecondarySubject: boolean;
  readonly secondarySubject: SubjectDraft;
  readonly gates: readonly RealityGateDraft[];
  readonly crossState: CrossStateDraft;
}

export function analysisInputFingerprint(input: AnalysisFingerprintInput): string {
  return JSON.stringify({
    version: 1,
    mode: input.analysisMode,
    roleBasis: input.roleBasis,
    primary: fingerprintSubject(input.primarySubject),
    secondary: input.hasSecondarySubject ? fingerprintSubject(input.secondarySubject) : null,
    gates: input.gates.map(({ id, status, note }) => ({ id, status, note: note.trim() })),
    crossState: CROSS_STATE_KEYS.map((state) => ({ state, checked: input.crossState[state], note: input.crossState.evidence[state].trim() })),
  });
}

export function riskCandidateFingerprint(chain: { readonly id: string; readonly structuralCandidate: string }): string {
  return JSON.stringify({ id: chain.id, structuralCandidate: chain.structuralCandidate });
}

const CROSS_STATE_KEYS = ["steady", "pressure", "repair", "turningPoint", "counterevidenceReviewed"] as const satisfies readonly CrossStateKey[];

function isNonNeutralGateStatus(status: RealityGateDraft["status"]): boolean {
  return status === "pass" || status === "conditional" || status === "fail";
}

function fingerprintSubject(subject: SubjectDraft) {
  return {
    subjectId: subject.subjectId.trim(),
    year: subject.year,
    month: subject.month,
    day: subject.day,
    hour: subject.hour,
    birthTimeStatus: subject.birthTimeStatus,
    dataQuality: subject.dataQuality,
    birthInput: subject.birthInput ?? { method: "manual_four_pillars" },
  };
}

export function resultValue<T>(fields: Record<string, { value: unknown }>, key: string): T | null {
  return (fields[key]?.value as T | undefined) ?? null;
}

export function shortDigest(value: string): string { return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "—"; }
