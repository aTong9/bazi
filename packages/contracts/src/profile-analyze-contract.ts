import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { AnalyzeM0Command } from "../../application/src/analyze-m0.js";
import type { TraditionalRoleBasis } from "../../relationship-engine/src/m1.js";
import type { M4Observation } from "../../relationship-engine/src/m4.js";
import type { RealityGateAssessment } from "../../relationship-engine/src/reality-gates.js";
import { parseM0AnalyzeRequest } from "./m0-analyze-contract.js";

const validate = new Ajv2020({ allErrors: true, strict: true }).compile(JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/profile-analyze-request.schema.json", import.meta.url)), "utf8")) as object);
export type ParsedProfileRequest = { readonly valid: true; readonly command: AnalyzeM0Command & { readonly roleBasis: TraditionalRoleBasis; readonly subjectB?: AnalyzeM0Command["subject"] | null; readonly legacyPayloads?: Readonly<Record<string, unknown>> }; readonly observations?: readonly M4Observation[]; readonly gateAssessments?: readonly RealityGateAssessment[]; readonly crossStateValidation?: { readonly steady: boolean; readonly pressure: boolean; readonly repair: boolean; readonly turningPoint: boolean; readonly counterevidenceReviewed: boolean } } | { readonly valid: false; readonly errors: readonly string[] };
export function parseProfileAnalyzeRequest(value: unknown): ParsedProfileRequest {
  if (!validate(value)) return { valid: false, errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`) };
  const wire = value as { analysis_mode: unknown; role_basis: TraditionalRoleBasis; subject: unknown; subject_b?: unknown; legacy_payloads?: Readonly<Record<string, unknown>>; requested_sections: string[]; observations?: readonly M4Observation[]; reality_gates?: readonly RealityGateAssessment[]; cross_state_validation?: { readonly steady: boolean; readonly pressure: boolean; readonly repair: boolean; readonly turningPoint: boolean; readonly counterevidenceReviewed: boolean } };
  const parsed = parseM0AnalyzeRequest({ analysis_mode: wire.analysis_mode, subject: wire.subject, requested_sections: ["m0"] });
  if (!parsed.valid) return parsed;
  const parsedSubjectB = wire.subject_b == null ? null : parseM0AnalyzeRequest({ analysis_mode: wire.analysis_mode, subject: wire.subject_b, requested_sections: ["m0"] });
  if (parsedSubjectB && !parsedSubjectB.valid) return { valid: false, errors: parsedSubjectB.errors.map((error) => `/subject_b${error}`) };
  if (wire.reality_gates && new Set(wire.reality_gates.map((gate) => gate.id)).size !== wire.reality_gates.length) return { valid: false, errors: ["/reality_gates contains duplicate gate ids"] };
  return { valid: true, command: { ...parsed.command, requestedSections: Object.freeze([...wire.requested_sections]), roleBasis: wire.role_basis, ...(wire.subject_b !== undefined ? { subjectB: parsedSubjectB ? parsedSubjectB.command.subject : null } : {}), ...(wire.legacy_payloads ? { legacyPayloads: Object.freeze({ ...wire.legacy_payloads }) } : {}) }, ...(wire.observations ? { observations: wire.observations } : {}), ...(wire.reality_gates ? { gateAssessments: wire.reality_gates } : {}), ...(wire.cross_state_validation ? { crossStateValidation: wire.cross_state_validation } : {}) };
}
