export type ResultStatus =
  | "not_assessed"
  | "unknown"
  | "candidate"
  | "supported"
  | "conditional"
  | "contradicted"
  | "stopped";

export type ApplicabilityStatus = "applicable" | "not_applicable";
export type ModuleStatus =
  | "not_run"
  | "partial"
  | "complete"
  | "limited"
  | "stopped"
  | "dependency_pending";
export type ConfidenceLevel =
  | "high"
  | "medium_high"
  | "medium"
  | "medium_low"
  | "low"
  | "not_applicable"
  | "unknown";
export type EvidenceScheme = "PV" | "XV" | "BV" | "FV" | "HV" | "GE";
export type EvidenceLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface EvidenceDepth {
  readonly scheme: EvidenceScheme;
  readonly level: EvidenceLevel;
}

export interface ResultItem<T> {
  readonly applicability: ApplicabilityStatus;
  readonly status: ResultStatus;
  readonly value: T | null;
  readonly confidence: ConfidenceLevel;
  readonly evidence: EvidenceDepth | null;
  readonly ruleIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly eventIds: readonly string[];
  readonly conditions: readonly string[];
  readonly counterevidence: readonly string[];
  readonly notes?: string;
}

export interface DomainIssue {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly stage: "request" | "birth_input" | "ruleset" | "module" | "publication";
  readonly message: string;
  readonly jsonPointer?: string;
  readonly moduleId?: string;
  readonly ruleIds?: readonly string[];
  readonly retryable: boolean;
}

export interface ModuleRun<TOutputs> {
  readonly moduleId: string;
  readonly moduleVersion: string;
  readonly status: ModuleStatus;
  readonly outputs: TOutputs;
  readonly matchedRuleIds: readonly string[];
  readonly dependencyFlags: readonly string[];
  readonly issues: readonly DomainIssue[];
}

export function createResultItem<T>(input: ResultItem<T>): Readonly<ResultItem<T>> {
  if (input.status === "unknown") {
    if (input.value !== null) throw new Error("unknown result must have value=null");
    if (input.confidence !== "unknown") throw new Error("unknown result must have confidence=unknown");
    if (input.conditions.length === 0) throw new Error("unknown result must record a reason");
  }
  if (input.status === "conditional" && input.conditions.length === 0) throw new Error("conditional result must record conditions");
  if (input.applicability === "not_applicable") {
    if (input.status !== "not_assessed" || input.value !== null || input.confidence !== "not_applicable") {
      throw new Error("not_applicable result must use the V1.0 compatibility projection");
    }
    if (!input.conditions.includes("NOT_APPLICABLE")) {
      throw new Error("not_applicable result must record NOT_APPLICABLE");
    }
  }
  return Object.freeze({
    ...input,
    ruleIds: Object.freeze([...input.ruleIds]),
    sourceIds: Object.freeze([...input.sourceIds]),
    eventIds: Object.freeze([...input.eventIds]),
    conditions: Object.freeze([...input.conditions]),
    counterevidence: Object.freeze([...input.counterevidence]),
  });
}
