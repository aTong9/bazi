import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import type { M02Result } from "../../m0-engine/src/m02.js";
import type { M09Result } from "../../m0-engine/src/m09.js";
import type { M10Result } from "../../m0-engine/src/m10.js";
import { analyzeM1, type TraditionalRoleBasis } from "../../relationship-engine/src/m1.js";
import { analyzeM2 } from "../../relationship-engine/src/m2.js";
import { analyzeM3 } from "../../relationship-engine/src/m3.js";
import { analyzeM4, type M4Observation } from "../../relationship-engine/src/m4.js";
import { analyzeM5 } from "../../relationship-engine/src/m5.js";
import type { RealityGateAssessment } from "../../relationship-engine/src/reality-gates.js";
import { analyzeM0, type AnalyzeM0Command } from "./analyze-m0.js";

export type AnalyzeProfileCommand = AnalyzeM0Command & {
  readonly roleBasis: TraditionalRoleBasis;
  readonly relationshipMode?: "single_chart_relationship_profile" | "specific_partner_with_reality_data";
  readonly observations?: readonly M4Observation[];
  readonly gateAssessments?: readonly RealityGateAssessment[];
  readonly crossStateValidation?: { readonly steady: boolean; readonly pressure: boolean; readonly repair: boolean; readonly turningPoint: boolean; readonly counterevidenceReviewed: boolean };
};
export function analyzeProfile(command: AnalyzeProfileCommand, catalog: CatalogSnapshot) {
  const m0 = analyzeM0(command, catalog);
  if (!m0.ok) return m0;
  const modules = m0.response.m0.modules;
  const m02 = modules["M0.M02"] as M02Result; const m09 = modules["M0.M09"] as M09Result; const m10 = modules["M0.M10"] as M10Result;
  const m1 = analyzeM1({ roleBasis: command.roleBasis, m10, rules: catalog });
  const m2 = analyzeM2({ m02, m09, m10, m1, rules: catalog });
  const m3 = analyzeM3({ m02, m09, m10, rules: catalog });
  const m4 = analyzeM4({ m3, rules: catalog, ...(command.observations ? { observations: command.observations } : {}) });
  const m5 = analyzeM5({ mode: command.relationshipMode ?? "single_chart_relationship_profile", m4, rules: catalog, ...(command.gateAssessments ? { gateAssessments: command.gateAssessments } : {}), ...(command.crossStateValidation ? { crossStateValidation: command.crossStateValidation } : {}) });
  return { ok: true as const, httpStatus: 200 as const, response: { ...m0.response, relationship: { status: m1.status === "dependency_pending" || m2.status === "dependency_pending" ? "dependency_pending" as const : "provisional" as const, roleBasis: command.roleBasis, m1, m2, m3, m4, m5, dependencyFlags: Object.freeze([...new Set([...m1.dependencyFlags, ...m2.dependencyFlags, ...m3.dependencyFlags])]), ruleTrace: Object.freeze([...new Set([...m1.ruleTrace, ...m2.ruleTrace, ...m3.ruleTrace])].sort()) } } };
}
