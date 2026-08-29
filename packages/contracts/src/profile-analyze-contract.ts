import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { AnalyzeM0Command } from "../../application/src/analyze-m0.js";
import type { TraditionalRoleBasis } from "../../relationship-engine/src/m1.js";
import { parseM0AnalyzeRequest } from "./m0-analyze-contract.js";

const validate = new Ajv2020({ allErrors: true, strict: true }).compile(JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/profile-analyze-request.schema.json", import.meta.url)), "utf8")) as object);
export type ParsedProfileRequest = { readonly valid: true; readonly command: AnalyzeM0Command & { readonly roleBasis: TraditionalRoleBasis } } | { readonly valid: false; readonly errors: readonly string[] };
export function parseProfileAnalyzeRequest(value: unknown): ParsedProfileRequest {
  if (!validate(value)) return { valid: false, errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`) };
  const wire = value as { analysis_mode: unknown; role_basis: TraditionalRoleBasis; subject: unknown; requested_sections: string[] };
  const parsed = parseM0AnalyzeRequest({ analysis_mode: wire.analysis_mode, subject: wire.subject, requested_sections: ["m0"] });
  if (!parsed.valid) return parsed;
  return { valid: true, command: { ...parsed.command, requestedSections: Object.freeze([...wire.requested_sections]), roleBasis: wire.role_basis } };
}
