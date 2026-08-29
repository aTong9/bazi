import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildCatalogSnapshot } from "../packages/catalog/src/build-catalog-snapshot.js";
import { openCatalogSnapshot } from "../packages/catalog/src/open-catalog-snapshot.js";
import { buildCurrentExecutionEvidence, summarizeExecutionEvidence } from "../packages/testkit/src/execution-evidence.js";
import { readDevelopmentTestMatrix } from "../packages/testkit/src/read-development-test-matrix.js";
import { executeAllM20Fixtures } from "../packages/testkit/src/s3-m20-runner.js";
import { executeReportLanguageMatrix } from "../packages/testkit/src/report-language-runner.js";
import { executeJsonDataMatrix } from "../packages/testkit/src/json-data-runner.js";
import { executeConflictSafetyMatrix } from "../packages/testkit/src/conflict-safety-runner.js";
import { executeM0UnitMatrix } from "../packages/testkit/src/m0-unit-matrix-runner.js";
import { executeInterfaceContractMatrix } from "../packages/testkit/src/interface-contract-runner.js";
import { executeUpstreamModuleMatrix } from "../packages/testkit/src/upstream-module-matrix-runner.js";
import { executeM5RegressionMatrix } from "../packages/testkit/src/m5-regression-runner.js";

const repositoryRoot = path.resolve(".");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "bazi-test-evidence-"));
try {
  const built = await buildCatalogSnapshot({ repositoryRoot, outputRoot: temporaryRoot });
  const catalog = openCatalogSnapshot(built.snapshotPath);
  try {
    const [definitions, m20Records] = await Promise.all([readDevelopmentTestMatrix(repositoryRoot), executeAllM20Fixtures({ repositoryRoot, catalog })]);
    const codeCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
    const environment = `${process.platform}-${process.arch};node-${process.version}`;
    const records = buildCurrentExecutionEvidence({ definitions, m20Records, matrixRecords: [...executeM0UnitMatrix(definitions, catalog), ...executeInterfaceContractMatrix(definitions, catalog), ...executeUpstreamModuleMatrix(definitions, catalog), ...executeConflictSafetyMatrix(definitions, catalog, repositoryRoot), ...executeJsonDataMatrix(definitions, catalog), ...executeReportLanguageMatrix(definitions), ...executeM5RegressionMatrix(definitions)], codeCommit, rulesetDigest: built.rulesetDigest, environment });
    const summary = summarizeExecutionEvidence(records);
    const outputRoot = path.join(repositoryRoot, "artifacts/test-evidence", built.rulesetDigest, codeCommit);
    await mkdir(outputRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(outputRoot, "execution-report.jsonl"), `${records.map((record) => JSON.stringify(record)).join("\n")}\n`),
      writeFile(path.join(outputRoot, "summary.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), codeCommit, rulesetDigest: built.rulesetDigest, environment, ...summary }, null, 2)}\n`),
    ]);
    process.stdout.write(`${JSON.stringify({ outputRoot, ...summary }, null, 2)}\n`);
    if (!summary.releaseReady) process.exitCode = 1;
  } finally { catalog.close(); }
} finally { await rm(temporaryRoot, { recursive: true, force: true }); }
