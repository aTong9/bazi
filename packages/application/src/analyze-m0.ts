import { randomUUID } from "node:crypto";

import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import { validateBirthInput, type FourPillarsProvidedInput } from "../../domain/src/birth-input.js";
import type { DomainIssue } from "../../domain/src/index.js";
import { analyzeM02 } from "../../m0-engine/src/m02.js";
import { analyzeM03 } from "../../m0-engine/src/m03.js";
import { analyzeM04 } from "../../m0-engine/src/m04.js";
import { analyzeM05 } from "../../m0-engine/src/m05.js";
import { analyzeM06 } from "../../m0-engine/src/m06.js";
import { analyzeM07 } from "../../m0-engine/src/m07.js";
import { analyzeM08 } from "../../m0-engine/src/m08.js";
import { analyzeM09 } from "../../m0-engine/src/m09.js";
import { analyzeM10 } from "../../m0-engine/src/m10.js";
import { analyzeM11 } from "../../m0-engine/src/m11.js";
import { analyzeM12 } from "../../m0-engine/src/m12.js";
import { analyzeM13 } from "../../m0-engine/src/m13.js";
import { analyzeM14 } from "../../m0-engine/src/m14.js";
import { analyzeM15 } from "../../m0-engine/src/m15.js";
import { analyzeM16 } from "../../m0-engine/src/m16.js";
import { analyzeM17 } from "../../m0-engine/src/m17.js";
import { analyzeM18 } from "../../m0-engine/src/m18.js";
import { projectM19 } from "../../m0-engine/src/m19.js";

export interface AnalyzeM0Command {
  readonly analysisMode: "test" | "production";
  readonly subject: FourPillarsProvidedInput;
  readonly requestedSections: readonly string[];
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
    readonly status: "complete" | "limited";
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
  if (command.requestedSections.includes("dynamic_timing")) {
    return failure("E_DYNAMIC_MODEL_REQUIRED", "dynamic timing requires the D0 model and cannot be inferred from the static M0 chain");
  }
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
  const m07 = analyzeM07(m02, m03);
  const m08 = analyzeM08(m07, m06);
  const m09 = analyzeM09(m02, m03, m08);
  const m10 = analyzeM10(m02, m08, m09);
  const m11 = analyzeM11(m10, m09);
  const m12 = analyzeM12(m08);
  const m13 = analyzeM13(m02, m08);
  const m14 = analyzeM14(m02, m09, m10, m11);
  const m15 = analyzeM15(m14, m10, m11);
  const m16 = analyzeM16(m09, m12, m13, m15);
  const m17 = analyzeM17(m09, m12, m13, m15, m16);
  const m18 = analyzeM18(m17, m15, m16);
  const contracts = catalog.getOutputContracts();
  const m19 = projectM19({ contracts, birthTimeStatus: validation.value.birthTimeStatus, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12, m13, m14, m15, m16, m17, m18 });
  if (m19.issues.length > 0) return { ok: false, httpStatus: 500, issues: m19.issues };
  const ruleTrace = [...new Set([
    ...m02.matchedRuleIds, ...m03.matchedRuleIds, ...m04.matchedRuleIds,
    ...m05.matchedRuleIds, ...m06.matchedRuleIds, ...m07.matchedRuleIds, ...m08.matchedRuleIds,
    ...m09.matchedRuleIds, ...m10.matchedRuleIds, ...m11.matchedRuleIds, ...m12.matchedRuleIds,
    ...m13.matchedRuleIds, ...m14.matchedRuleIds, ...m15.matchedRuleIds, ...m16.matchedRuleIds,
    ...m17.matchedRuleIds, ...m18.matchedRuleIds,
  ])].sort();
  const traceIssues = validateRuleTrace(ruleTrace, catalog);
  if (traceIssues.length > 0) return { ok: false, httpStatus: 500, issues: traceIssues };
  const dependencyFlags = validation.value.birthTimeStatus === "unknown"
    ? ["HOUR_UNKNOWN"]
    : validation.value.birthTimeStatus === "approximate"
      ? ["HOUR_APPROXIMATE"]
      : [];
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
        status: validation.limited ? "limited" : "complete",
        modules: Object.freeze({ "M0.M02": m02, "M0.M03": m03, "M0.M04": m04, "M0.M05": m05, "M0.M06": m06, "M0.M07": m07, "M0.M08": m08, "M0.M09": m09, "M0.M10": m10, "M0.M11": m11, "M0.M12": m12, "M0.M13": m13, "M0.M14": m14, "M0.M15": m15, "M0.M16": m16, "M0.M17": m17, "M0.M18": m18 }),
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
    if (!/^M0\.M(?:0[2-9]|1[0-8])$/u.test(record.moduleId)) {
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
