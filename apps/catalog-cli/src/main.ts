import path from "node:path";

import {
  type DocumentPackageReport,
  verifyDocumentPackage,
} from "../../../packages/catalog/src/verify-document-package.js";
import {
  type SourcePackageLockReport,
  verifySourcePackageLock,
} from "../../../packages/catalog/src/verify-source-package-lock.js";

const command = process.argv[2];

if (command === "verify-doc-package") {
  await runDocumentPackageVerification();
} else if (command === "verify-source-package-lock") {
  await runSourcePackageLockVerification();
} else {
  process.stderr.write(
    `Unknown command: ${command ?? "(missing)"}\nAvailable commands: verify-doc-package, verify-source-package-lock\n`,
  );
  process.exitCode = 2;
}

async function runDocumentPackageVerification(): Promise<void> {
  const packageRoot = path.resolve(
    "docs/八字关系分析系统_M0-M5开发整合包_V1.0",
  );
  const report = await verifyDocumentPackage({ packageRoot });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!isDocumentPackageValid(report)) process.exitCode = 1;
}

async function runSourcePackageLockVerification(): Promise<void> {
  const report = await verifySourcePackageLock({
    repositoryRoot: path.resolve("."),
    lockFile: path.resolve("data/source-package.lock.json"),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!isSourcePackageLockValid(report)) process.exitCode = 1;
}

function isDocumentPackageValid(report: DocumentPackageReport): boolean {
  return (
    report.manifestEntries === 160 &&
    report.packageFiles === 161 &&
    report.missingFiles.length === 0 &&
    report.unexpectedFiles.length === 0 &&
    report.sizeMismatches.length === 0 &&
    report.hashMismatches.length === 0 &&
    report.jsonErrors.length === 0 &&
    report.csvErrors.length === 0 &&
    report.zipErrors.length === 0
  );
}

function isSourcePackageLockValid(report: SourcePackageLockReport): boolean {
  return (
    report.integrationCoreFiles === 6 &&
    report.m0SemanticSources === 1 &&
    report.m1M5SemanticSources === 29 &&
    report.overlays >= 1 &&
    report.missingFiles.length === 0 &&
    report.hashMismatches.length === 0 &&
    report.roleErrors.length === 0 &&
    report.deniedPrefixErrors.length === 0 &&
    report.schemaErrors.length === 0
  );
}
