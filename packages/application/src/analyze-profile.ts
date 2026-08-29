import type { CatalogSnapshot } from "../../catalog/src/open-catalog-snapshot.js";
import type { M02Result } from "../../m0-engine/src/m02.js";
import type { M09Result } from "../../m0-engine/src/m09.js";
import type { M10Result } from "../../m0-engine/src/m10.js";
import { analyzeM1, type TraditionalRoleBasis } from "../../relationship-engine/src/m1.js";
import { analyzeM2 } from "../../relationship-engine/src/m2.js";
import { analyzeM3 } from "../../relationship-engine/src/m3.js";
import { analyzeM0, type AnalyzeM0Command } from "./analyze-m0.js";

export function analyzeProfile(command: AnalyzeM0Command & { readonly roleBasis: TraditionalRoleBasis }, catalog: CatalogSnapshot) {
  const m0 = analyzeM0(command, catalog);
  if (!m0.ok) return m0;
  const modules = m0.response.m0.modules;
  const m02 = modules["M0.M02"] as M02Result; const m09 = modules["M0.M09"] as M09Result; const m10 = modules["M0.M10"] as M10Result;
  const m1 = analyzeM1({ roleBasis: command.roleBasis, m10, rules: catalog });
  const m2 = analyzeM2({ m02, m09, m10, m1, rules: catalog });
  const m3 = analyzeM3({ m02, m09, m10, rules: catalog });
  return { ok: true as const, httpStatus: 200 as const, response: { ...m0.response, relationship: { status: m1.status === "dependency_pending" || m2.status === "dependency_pending" ? "dependency_pending" as const : "provisional" as const, roleBasis: command.roleBasis, m1, m2, m3, dependencyFlags: Object.freeze([...new Set([...m1.dependencyFlags, ...m2.dependencyFlags, ...m3.dependencyFlags])]), ruleTrace: Object.freeze([...new Set([...m1.ruleTrace, ...m2.ruleTrace, ...m3.ruleTrace])].sort()) } } };
}
