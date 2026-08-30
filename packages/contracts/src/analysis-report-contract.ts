import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";

const validate = new Ajv2020({ allErrors: true, strict: true }).compile(JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/analysis-report.schema.json", import.meta.url)), "utf8")) as object);

export function validateAnalysisReport(value: unknown): readonly string[] {
  if (!validate(value)) return Object.freeze((validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`));
  const report = value as { reportStatus: string; safetyStatus: string; evidenceGrade: string; assessment: string; sections: Array<{ id: string }>; realityGates: Array<{ id: string; status: string }>; boundaries: Array<{ hard: boolean }> };
  const errors: string[] = [];
  if (new Set(report.realityGates.map((gate) => gate.id)).size !== 8) errors.push("realityGates must contain RG01-RG08 exactly once");
  if (report.safetyStatus === "safety_stop" && (report.reportStatus !== "stop" || report.evidenceGrade !== "FG0" || report.assessment !== "AF09")) errors.push("safety_stop requires stop/FG0/AF09");
  if (report.safetyStatus === "safety_stop" && report.sections.some((section) => section.id !== "safety")) errors.push("safety_stop cannot publish ordinary sections");
  if (report.boundaries.some((boundary) => !boundary.hard)) errors.push("all report boundaries must be hard");
  return Object.freeze(errors);
}
