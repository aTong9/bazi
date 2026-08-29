import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

const schemaPath = fileURLToPath(new URL("../schemas/result-item.schema.json", import.meta.url));
const schema: object = JSON.parse(readFileSync(schemaPath, "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

export interface ContractValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateResultItemContract(value: unknown): ContractValidationResult {
  const valid = validate(value);
  if (valid) {
    const item = value as { status: string; value: unknown; confidence: string; conditions: unknown[] };
    const semanticErrors = [
      ...(item.status === "unknown" && item.value !== null ? ["/value unknown result must use null"] : []),
      ...(item.status === "unknown" && item.confidence !== "unknown" ? ["/confidence unknown result must use unknown confidence"] : []),
      ...(item.status === "conditional" && item.conditions.length === 0 ? ["/conditions conditional result requires conditions"] : []),
    ];
    if (semanticErrors.length) return { valid: false, errors: semanticErrors };
  }
  return {
    valid,
    errors: valid ? [] : formatErrors(validate.errors),
  };
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(
    (error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`,
  );
}
