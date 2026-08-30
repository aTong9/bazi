import type { TenGod } from "../../m0-engine/src/m02.js";
import type { M10Result } from "../../m0-engine/src/m10.js";
import { field, unique, type RelationshipRuleCatalog } from "./rule-catalog.js";

export type TraditionalRoleBasis = "female_traditional" | "male_traditional" | "unspecified";
export interface AttractionPrototype {
  readonly tenGod: TenGod; readonly presence: M10Result["tenGods"][TenGod]["presence"];
  readonly effectivePower: M10Result["tenGods"][TenGod]["effectivePower"];
  readonly attractionStatements: readonly string[]; readonly observableTriggers: readonly string[];
  readonly conditions: readonly string[]; readonly ruleIds: readonly string[];
}
export interface M1Result {
  readonly moduleId: "M1.SYNTH"; readonly status: "provisional" | "dependency_pending";
  readonly roleBasis: TraditionalRoleBasis; readonly prototypes: readonly AttractionPrototype[];
  readonly synthesis: { readonly primarySignals: readonly TenGod[]; readonly statements: readonly string[]; readonly boundary: "ATTRACTION_ENTRY_ONLY" };
  readonly compatibilityFields: { readonly self_strength_status: null; readonly spouse_star_status: null; readonly palace_signal: null; readonly flow_path: null; readonly distance_level: null };
  readonly dependencyFlags: readonly string[]; readonly ruleTrace: readonly string[];
  readonly forbiddenInferences: readonly ["relationship_outcome", "partner_identity", "partner_quality", "event_timing"];
}
export function analyzeM1(input: { roleBasis: TraditionalRoleBasis; m10: M10Result; rules: RelationshipRuleCatalog }): M1Result {
  const compatibilityFields = Object.freeze({ self_strength_status: null, spouse_star_status: null, palace_signal: null, flow_path: null, distance_level: null });
  if (input.roleBasis === "unspecified") return { moduleId: "M1.SYNTH", status: "dependency_pending", roleBasis: input.roleBasis, prototypes: [], synthesis: { primarySignals: [], statements: [], boundary: "ATTRACTION_ENTRY_ONLY" }, compatibilityFields, dependencyFlags: ["M1_TRADITIONAL_ROLE_BASIS_REQUIRED"], ruleTrace: [], forbiddenInferences: ["relationship_outcome", "partner_identity", "partner_quality", "event_timing"] };
  const spouseGods: readonly TenGod[] = input.roleBasis === "female_traditional" ? ["正官", "七杀"] : ["正财", "偏财"];
  const group = input.roleBasis === "female_traditional" ? "女命" : "男命";
  const records = input.rules.getModuleRecords("M1.CORE");
  const prototypes = spouseGods.flatMap((tenGod): AttractionPrototype[] => {
    const state = input.m10.tenGods[tenGod]; if (state.presence === "absent") return [];
    const selected = records.filter((record) => [group, "通用"].includes(field(record, "applicable_group")) && (field(record, "main_signal").includes(tenGod) || field(record, "secondary_signal").includes(tenGod)));
    const attraction = selected.filter((record) => field(record, "output_slot") === "primary_attraction").map((record) => field(record, "user_explanation"));
    const triggers = selected.filter((record) => /trigger|proof|observable/u.test(field(record, "output_slot"))).map((record) => field(record, "user_explanation"));
    return [{ tenGod, presence: state.presence, effectivePower: state.effectivePower, attractionStatements: unique(attraction), observableTriggers: unique(triggers), conditions: Object.freeze(["TRADITIONAL_ROLE_BASIS_EXPLICIT", "PROVISIONAL_PENDING_CASE_CALIBRATION"]), ruleIds: unique(selected.map((record) => record.id)) }];
  });
  return { moduleId: "M1.SYNTH", status: "provisional", roleBasis: input.roleBasis, prototypes: Object.freeze(prototypes), synthesis: { primarySignals: Object.freeze(prototypes.map((prototype) => prototype.tenGod)), statements: unique(prototypes.flatMap((prototype) => prototype.attractionStatements).slice(0, 3)), boundary: "ATTRACTION_ENTRY_ONLY" }, compatibilityFields, dependencyFlags: [], ruleTrace: unique(prototypes.flatMap((prototype) => prototype.ruleIds)), forbiddenInferences: ["relationship_outcome", "partner_identity", "partner_quality", "event_timing"] };
}
