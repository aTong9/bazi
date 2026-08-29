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
