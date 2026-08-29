import { performance } from "node:perf_hooks";
import { validateReportLanguage } from "../../reporting/src/build-report.js";
import type { DevelopmentTestDefinition } from "./read-development-test-matrix.js";

export interface MatrixAssertionExecution {
  readonly testId: string;
  readonly passed: boolean;
  readonly actualSummary: string;
  readonly durationMs: number;
}

export function executeReportLanguageMatrix(definitions: readonly DevelopmentTestDefinition[]): readonly MatrixAssertionExecution[] {
  return Object.freeze(definitions.filter((definition) => definition.suite === "07_报告语言测试").map((definition) => {
    const startedAt = performance.now();
    const source = definition.fields["原始输出"] ?? "";
    const violations = validateReportLanguage(source);
    return Object.freeze({ testId: definition.testId, passed: violations.length > 0, actualSummary: JSON.stringify({ sourceRejected: violations.length > 0, violationCodes: violations }), durationMs: performance.now() - startedAt });
  }));
}
