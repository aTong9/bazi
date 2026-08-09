#!/usr/bin/env node
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(root, "review/wenzhen-observations.json");
const output = resolve(root, "test/fixtures/wenzhen-public-api-golden.json");
const review = JSON.parse(await readFile(input, "utf8"));
if (!Array.isArray(review.cases) || review.cases.some(item => item.wenzhenObserved?.evidenceSource !== "public_api")) {
  throw new Error("All promoted observations must come from the Wenzhen public API");
}
const fixture = {
  schemaVersion: "wenzhen-public-api-golden-v1",
  provenance: {
    observedAt: "2026-08-09",
    endpoint: "https://bzapi4.iwzbz.com/getbasebz8.php",
    purpose: "Synthetic-input compatibility replay; not an authoritative calendar or human-life case set.",
    omitted: ["raw API payload", "local reviewer identity", "local evidence paths"],
  },
  cases: review.cases.map(item => ({
    caseId: item.caseId,
    dimension: item.dimension,
    boundary: item.boundary,
    input: item.input,
    settings: item.settings,
    observed: {
      adjustedTime: item.wenzhenObserved.adjustedTime,
      fourPillars: item.wenzhenObserved.fourPillars,
      dayun: item.wenzhenObserved.dayun,
      qiyunStartsAt: item.wenzhenObserved.qiyunStartsAt,
    },
    compatibility: {
      fourPillars: item.wenzhenObserved.fourPillarsMatch,
      dayun: item.wenzhenObserved.dayunMatch,
      qiyunWithin20Minutes: item.wenzhenObserved.qiyunMatch,
      overall: item.match,
    },
    differenceReason: item.differenceReason,
  })),
};
const temporary = `${output}.tmp`;
await writeFile(temporary, `${JSON.stringify(fixture, null, 2)}\n`);
await rename(temporary, output);
process.stdout.write(`Promoted ${fixture.cases.length} sanitized observations to ${output}\n`);
