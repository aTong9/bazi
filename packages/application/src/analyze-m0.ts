import { randomUUID } from "node:crypto";

import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import { validateBirthInput, type FourPillarsProvidedInput } from "../../domain/src/birth-input.js";
import type { DomainIssue } from "../../domain/src/index.js";
import { analyzeM02 } from "../../m0-engine/src/m02.js";
import { analyzeM03 } from "../../m0-engine/src/m03.js";
import { analyzeM04 } from "../../m0-engine/src/m04.js";
import { analyzeM05 } from "../../m0-engine/src/m05.js";
import { analyzeM06 } from "../../m0-engine/src/m06.js";
import { projectM19 } from "../../m0-engine/src/m19.js";

export interface AnalyzeM0Command {
  readonly analysisMode: "test" | "production";
  readonly subject: FourPillarsProvidedInput;
  readonly requestedSections: readonly ["m0"] | readonly string[];
}

export type AnalyzeM0Result =
  | { readonly ok: false; readonly httpStatus: 422 | 409 | 503 | 500; readonly issues: readonly DomainIssue[] }
  | { readonly ok: true; readonly httpStatus: 200; readonly response: M0AnalysisResponse };

export interface M0AnalysisResponse {
  readonly requestId: string;
  readonly generatedAt: string;
  readonly rulesetDigest: string;
  readonly versionManifest: {
    readonly integrationVersion: string;
    readonly modelVersions: Readonly<Record<string, string>>;
    readonly compilerVersion: string;
  };
  readonly m0: {
    readonly status: "partial";
    readonly modules: Readonly<Record<string, unknown>>;
    readonly fields: Readonly<Record<string, unknown>>;
    readonly dependencyFlags: readonly string[];
    readonly issues: readonly DomainIssue[];
  };
  readonly ruleTrace: readonly string[];
  readonly sourceIds: readonly string[];
  readonly discardLog: readonly never[];
}

export function analyzeM0(command: AnalyzeM0Command, catalog: CatalogSnapshot): AnalyzeM0Result {
  if (command.subject.syntheticFixture && command.analysisMode !== "test") {
    return failure("E_SYNTHETIC_FIXTURE_FORBIDDEN", "synthetic_fixture is allowed only in test mode");
  }
  const validation = validateBirthInput(command.subject);
  if (!validation.ok) return { ok: false, httpStatus: 422, issues: validation.issues };
  const m02 = analyzeM02(validation.value.fourPillars);
  const m03 = analyzeM03(m02);
  const m04 = analyzeM04(validation.value.fourPillars);
  const nodes = (["year", "month", "day", "hour"] as const).flatMap((position) => {
    const pillar = validation.value.fourPillars[position];
    return pillar ? [{ position, branch: pillar.branch }] : [];
  });
  const m05 = analyzeM05(nodes);
  const m06 = analyzeM06(m03, m04, m05);
  const contracts = catalog.getOutputContracts();
  const m19 = projectM19({ contracts, birthTimeStatus: validation.value.birthTimeStatus, m02, m03, m04, m05, m06 });
  if (m19.issues.length > 0) return { ok: false, httpStatus: 500, issues: m19.issues };
  const ruleTrace = [...new Set([
    ...m02.matchedRuleIds, ...m03.matchedRuleIds, ...m04.matchedRuleIds,
    ...m05.matchedRuleIds, ...m06.matchedRuleIds,
  ])].sort();
  const traceIssues = validateRuleTrace(ruleTrace, catalog);
  if (traceIssues.length > 0) return { ok: false, httpStatus: 500, issues: traceIssues };
  const dependencyFlags = [
    ...Array.from({ length: 12 }, (_, index) => `M0.M${String(index + 7).padStart(2, "0")}_NOT_RUN`),
    ...(validation.value.birthTimeStatus === "unknown" ? ["HOUR_UNKNOWN"] : []),
  ];
  return {
    ok: true,
    httpStatus: 200,
    response: {
      requestId: randomUUID(),
      generatedAt: new Date().toISOString(),
      rulesetDigest: catalog.manifest.rulesetDigest,
      versionManifest: {
        integrationVersion: catalog.manifest.integrationVersion,
        modelVersions: catalog.manifest.modelVersions,
        compilerVersion: catalog.manifest.compilerVersion,
      },
      m0: {
        status: "partial",
        modules: Object.freeze({ "M0.M02": m02, "M0.M03": m03, "M0.M04": m04, "M0.M05": m05, "M0.M06": m06 }),
        fields: m19.fields,
        dependencyFlags: Object.freeze(dependencyFlags),
        issues: Object.freeze([]),
      },
      ruleTrace: Object.freeze(ruleTrace),
      sourceIds: Object.freeze(ruleTrace),
      discardLog: Object.freeze([]),
    },
  };
}

function validateRuleTrace(ruleIds: readonly string[], catalog: CatalogSnapshot): DomainIssue[] {
  return ruleIds.flatMap((ruleId) => {
    const record = catalog.getRecord(ruleId);
    if (!record) return [issue("E_RULE_NOT_IN_SNAPSHOT", `Rule ${ruleId} is not in the current snapshot`)];
    if (!["M0.M02", "M0.M03", "M0.M04", "M0.M05", "M0.M06"].includes(record.moduleId)) {
      return [issue("E_RULE_MODULE_MISMATCH", `Rule ${ruleId} belongs to ${record.moduleId}`)];
    }
    return [];
  });
}

function failure(code: string, message: string): AnalyzeM0Result {
  return { ok: false, httpStatus: 422, issues: [issue(code, message)] };
}
function issue(code: string, message: string): DomainIssue {
  return { code, severity: "error", stage: "publication", message, retryable: false };
}
