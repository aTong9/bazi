import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { parse } from "csv-parse/sync";

test("every native lifecycle and confidence value has an explicit canonical mapping", async () => {
  const mappings = JSON.parse(
    await readFile("data/migrations/integration-v1.0-canonical-mappings.json", "utf8"),
  ) as {
    lifecycleStatus: { nativeToCanonical: Record<string, string> };
    confidence: { nativeToCanonical: Record<string, string> };
    traditionalSpouseStarPolicy: { identityBinding: string };
  };
  const packageRoot = "docs/八字关系分析系统_M0-M5开发整合包_V1.0/02_运行时核心";
  const m0 = await csvRows(path.join(packageRoot, "M0_标准化记录_V1.0.csv"));
  const m1M5 = await csvRows(path.join(packageRoot, "M1-M5_原子规则总表_V1.0.csv"));

  const statuses = new Set([...m0.map((row) => row.validation_status ?? ""), ...m1M5.map((row) => row.validation_status ?? "")]);
  const confidence = new Set([...m0.map((row) => row.confidence ?? ""), ...m1M5.map((row) => row.confidence_base ?? "")]);
  for (const value of statuses) assert.ok(value in mappings.lifecycleStatus.nativeToCanonical, `unmapped status: ${value}`);
  for (const value of confidence) assert.ok(value in mappings.confidence.nativeToCanonical, `unmapped confidence: ${value}`);
  assert.equal(mappings.traditionalSpouseStarPolicy.identityBinding, "never_inferred");
});

async function csvRows(file: string): Promise<Array<Record<string, string>>> {
  return parse(await readFile(file, "utf8"), { bom: true, columns: true, skip_empty_lines: true }) as Array<Record<string, string>>;
}
