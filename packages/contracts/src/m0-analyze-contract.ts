import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

import type { AnalyzeM0Command } from "../../application/src/analyze-m0.js";
import type { EarthlyBranch, HeavenlyStem } from "../../domain/src/birth-input.js";

const schemaPath = fileURLToPath(new URL("../schemas/m0-analyze-request.schema.json", import.meta.url));
const schema: object = JSON.parse(readFileSync(schemaPath, "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const responseSchemaPath = fileURLToPath(new URL("../schemas/m0-analyze-response.schema.json", import.meta.url));
const resultItemSchemaPath = fileURLToPath(new URL("../schemas/result-item.schema.json", import.meta.url));
const responseAjv = new Ajv2020({ allErrors: true, strict: true });
responseAjv.addSchema(JSON.parse(readFileSync(resultItemSchemaPath, "utf8")));
const validateResponse = responseAjv.compile(JSON.parse(readFileSync(responseSchemaPath, "utf8")) as object);

interface WirePillar { stem: HeavenlyStem; branch: EarthlyBranch }
interface WireRequest {
  analysis_mode: "test" | "production";
  subject: {
    input_mode: "four_pillars_provided";
    subject_id: string;
    four_pillars: { year: WirePillar; month: WirePillar; day: WirePillar; hour: WirePillar | null };
    birth_time_status: "exact" | "approximate" | "unknown";
    timezone?: string;
    data_quality: "high" | "medium" | "low" | "unknown";
    synthetic_fixture?: boolean;
  };
  requested_sections: string[];
}

export type ParsedM0Request =
  | { readonly valid: true; readonly command: AnalyzeM0Command }
  | { readonly valid: false; readonly errors: readonly string[] };

export function parseM0AnalyzeRequest(value: unknown): ParsedM0Request {
  if (!validate(value)) return { valid: false, errors: formatErrors(validate.errors) };
  const wire = value as WireRequest;
  return {
    valid: true,
    command: {
      analysisMode: wire.analysis_mode,
      subject: {
        inputMode: wire.subject.input_mode,
        subjectId: wire.subject.subject_id,
        fourPillars: wire.subject.four_pillars,
        birthTimeStatus: wire.subject.birth_time_status,
        ...(wire.subject.timezone === undefined ? {} : { timezone: wire.subject.timezone }),
        dataQuality: wire.subject.data_quality,
        ...(wire.subject.synthetic_fixture === undefined ? {} : { syntheticFixture: wire.subject.synthetic_fixture }),
      },
      requestedSections: Object.freeze([...wire.requested_sections]),
    },
  };
}

export function validateM0AnalyzeResponse(value: unknown): readonly string[] {
  return validateResponse(value) ? [] : formatErrors(validateResponse.errors);
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`);
}
