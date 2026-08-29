import type { DomainIssue } from "../../domain/src/index.js";
import type { CanonicalCatalogRecord } from "./import-catalog.js";

export function validateCatalogSemantics(
  records: readonly CanonicalCatalogRecord[],
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  const outputContracts = records.filter(
    (record) => record.model === "M0" && record.recordClass === "output_contract",
  );
  if (outputContracts.length !== 45) {
    issues.push(issue("E_M19_FIELD_COUNT", `M19 requires exactly 45 output contracts; got ${outputContracts.length}`));
  }
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) issues.push(issue("E_DUPLICATE_RECORD_ID", `Duplicate record ID: ${record.id}`));
    ids.add(record.id);
    if (record.runtimeEligible && (record.moduleId === "M0.M20" || record.moduleId === "M0.M21")) {
      issues.push(issue("E_GOVERNANCE_IN_RUNTIME", `${record.moduleId} record ${record.id} is runtime eligible`));
    }
    if (record.disposition === "unsupported_with_reason" && !record.unsupportedReason) {
      issues.push(issue("E_UNSUPPORTED_REASON_REQUIRED", `${record.id} has no unsupported reason`));
    }
    if (!/^[a-f0-9]{64}$/u.test(record.source.sourceHash)) {
      issues.push(issue("E_SOURCE_HASH", `${record.id} has an invalid source hash`));
    }
  }
  return issues;
}

function issue(code: string, message: string): DomainIssue {
  return {
    code,
    severity: "error",
    stage: "ruleset",
    message,
    retryable: false,
  };
}
