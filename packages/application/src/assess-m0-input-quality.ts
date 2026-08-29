import type { DomainIssue } from "../../domain/src/index.js";

export interface M0InputQualityAssessment {
  readonly accepted: boolean;
  readonly status: "ready" | "stopped";
  readonly candidateMode: "single" | "dual";
  readonly issues: readonly DomainIssue[];
  readonly ruleTrace: readonly string[];
}

export function assessM0InputQuality(input: { readonly timezoneKnown: boolean; readonly calendarBoundaryCandidates: number }): M0InputQualityAssessment {
  const issues: DomainIssue[] = [];
  const rules: string[] = [];
  if (!input.timezoneKnown) {
    issues.push(issue("E_TIMEZONE_REQUIRED", "timezone is required before a unique static chart can be published"));
    rules.push("M19-META-0001-V1.0");
  }
  if (input.calendarBoundaryCandidates > 1) {
    issues.push(issue("E_CALENDAR_BOUNDARY_UNRESOLVED", "calendar boundary requires dual candidates until the exact transition is verified"));
    rules.push("M03-PROC-0019-V1.0");
  }
  return Object.freeze({ accepted: issues.length === 0, status: issues.length ? "stopped" : "ready", candidateMode: input.calendarBoundaryCandidates > 1 ? "dual" : "single", issues: Object.freeze(issues), ruleTrace: Object.freeze([...new Set(rules)]) });
}

function issue(code: string, message: string): DomainIssue { return Object.freeze({ code, severity: "error", stage: "birth_input", message, retryable: true }); }
