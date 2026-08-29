export type HeavenlyStem = "甲" | "乙" | "丙" | "丁" | "戊" | "己" | "庚" | "辛" | "壬" | "癸";
export type EarthlyBranch = "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";
export type BirthTimeStatus = "exact" | "approximate" | "unknown";
export type DataQuality = "high" | "medium" | "low" | "unknown";
export type RoleBasis = "female_traditional" | "male_traditional" | "unspecified";
export type AnalysisMode = "profile" | "evaluate";
export type RealityGateStatus = "pass" | "conditional" | "fail" | "unknown" | "not_assessed";
export type RealityGateId = "RG01" | "RG02" | "RG03" | "RG04" | "RG05" | "RG06" | "RG07" | "RG08";
export type CrossStateKey = "steady" | "pressure" | "repair" | "turningPoint" | "counterevidenceReviewed";
export type ReportStatus = "complete" | "limited" | "stop";
export type SafetyStatus = "standard" | "safety_stop" | "insufficient_data" | "core_gate_stop";
export type EvidenceGrade = "FG0" | "FG1" | "FG2" | "FG3" | "FG4";
export type AssessmentFlag = "AF01" | "AF02" | "AF03" | "AF04" | "AF05" | "AF06" | "AF07" | "AF08" | "AF09";

export interface Pillar { stem: HeavenlyStem; branch: EarthlyBranch }
export interface SubjectDraft {
  subjectId: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  birthTimeStatus: BirthTimeStatus;
  dataQuality: DataQuality;
}
export interface RealityGateDraft { id: RealityGateId; label: string; status: RealityGateStatus; note: string }
export interface CrossStateDraft {
  steady: boolean;
  pressure: boolean;
  repair: boolean;
  turningPoint: boolean;
  counterevidenceReviewed: boolean;
  evidence: Record<CrossStateKey, string>;
}
export interface ObservationDraft {
  chainId: string;
  slot: 0 | 1;
  source: "self_report" | "partner_report" | "joint_record" | "third_party_record";
  context: string;
  direction: "supports" | "contradicts";
  basisFingerprint: string;
  candidateFingerprint: string;
  basisRequestId: string;
}

export interface ResultItem<T = unknown> {
  status: string;
  confidence: string;
  value: T;
  conditions: string[];
  ruleIds: string[];
}

export interface RealityGateResult { id: RealityGateId; label: string; status: RealityGateStatus; evidenceIds: string[]; note?: string }
export interface CrossStateEvidenceResult { state: CrossStateKey; note: string; evidenceIds: string[] }
export interface ReportSection { id: string; title: string; body: string }
export interface AnalysisResponse {
  requestId: string;
  generatedAt: string;
  rulesetDigest: string;
  sourceIds: string[];
  ruleTrace: string[];
  m0: {
    status: string;
    fields: Record<string, ResultItem>;
    dependencyFlags: string[];
  };
  relationship: {
    status: string;
    roleBasis: RoleBasis;
    dependencyFlags: string[];
    ruleTrace: string[];
    structuralSupplement: {
      available: boolean;
      scope: "structural_auxiliary_only";
      replacesRealityEvidence: false;
      replacesRealityGates: false;
      fields: Record<string, ResultItem> | null;
    };
    m1: {
      status: string;
      prototypes: Array<{ tenGod: string; presence: string; effectivePower: string; attractionStatements: string[]; observableTriggers: string[] }>;
      synthesis: { primarySignals: string[]; statements: string[] };
    };
    m2: {
      status: string;
      gate: { dayBranchTenGod: string; themes: string[]; evidence: string[] };
      selfPosition: { class: string };
      tempo: { class: string; evidenceRounds: number };
      synthesis: { summary: string[]; scopeBoundary: string[] };
    };
    m3: {
      status: string;
      state: { activeState: string; modifiers: string[] };
      synthesis: { primaryChannels: string[]; statements: string[] };
      repair: { trigger: string; steps: string[]; stopConditions: string[] };
      boundaries: string[];
    };
    m4: {
      status: string;
      riskChains: Array<{ id: string; structuralCandidate: string; realityStatus: string; evidenceIds: string[]; repair: { actions: string[] }; buffer: { conditions: string[] } }>;
      boundaries: string[];
    };
    m5: {
      mode: string;
      reportStatus: ReportStatus;
      safetyStatus: SafetyStatus;
      realityGates: RealityGateResult[];
      crossStateEvidence: CrossStateEvidenceResult[];
      observationPlan: Array<{ gateId: string; observe: string; directive: false }>;
      fit: { grade: EvidenceGrade; assessment: AssessmentFlag; residualRisks: string[]; decisionCodes: string[]; isSuccessProbability: false };
      boundaries: string[];
    };
  };
  report: {
    reportStatus: ReportStatus;
    safetyStatus: SafetyStatus;
    evidenceGrade: EvidenceGrade;
    assessment: AssessmentFlag;
    fields: Record<string, ResultItem>;
    sections: ReportSection[];
    realityGates: RealityGateResult[];
    observationPlan: Array<{ gateId: string; observe: string; directive: false }>;
    boundaries: Array<{ code: string; hard: true; text: string }>;
    trace: { ruleIds: string[]; sourceIds: string[]; eventIds: string[] };
  };
}

export interface ApiIssue { code: string; message: string; jsonPointer?: string }
export interface ApiErrorBody { issues?: ApiIssue[] }
export interface HealthResponse {
  status: "ready";
  catalog: { rulesetDigest: string; loadedRecords: number; compiledRecords: number; activeModules: string[] };
}
