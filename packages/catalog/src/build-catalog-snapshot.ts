import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { importCatalog } from "./import-catalog.js";
import { validateCatalogSemantics } from "./semantic-validator.js";
import { verifySourcePackageLock } from "./verify-source-package-lock.js";
import { verifyM0Enrichment } from "./verify-m0-enrichment.js";
import { openCatalogSnapshot } from "./open-catalog-snapshot.js";

const COMPILER_VERSION = "1.0.0";

interface LockedFile { path: string; sha256: string; modelVersion: string }
interface SourceLock {
  integrationVersion: string;
  integrationCore: LockedFile[];
  semanticSources: { m0: LockedFile[]; m1M5: LockedFile[] };
  overlays: LockedFile[];
}

export interface RulesetManifest {
  readonly schemaId: "https://bazi.local/schemas/ruleset-manifest-v1.json";
  readonly rulesetDigest: string;
  readonly integrationVersion: string;
  readonly modelVersions: Readonly<Record<string, string>>;
  readonly compilerVersion: string;
  readonly inputFiles: readonly { path: string; sha256: string }[];
  readonly sourceRecordCount: number;
  readonly loadedRecordCount: number;
  readonly compiledRecordCount: number;
  readonly silentDrops: number;
  readonly coverage: Readonly<Record<string, number>>;
  readonly moduleCoverage: Readonly<Record<string, { compiled: number; unsupported: number }>>;
  readonly moduleRegistryHash: string;
  readonly fieldAuthorityDigest: string;
  readonly semanticPolicyDigest: string;
  readonly strategyConfigDigest: string;
  readonly schemaDigest: string;
  readonly overlayPatchIds: readonly string[];
  readonly catalogDigest: string;
}

export interface BuiltCatalogSnapshot {
  readonly rulesetDigest: string;
  readonly snapshotPath: string;
  readonly manifest: RulesetManifest;
}

export async function buildCatalogSnapshot(options: {
  repositoryRoot: string;
  outputRoot: string;
}): Promise<BuiltCatalogSnapshot> {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const outputRoot = path.resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const lockReport = await verifySourcePackageLock({
    repositoryRoot,
    lockFile: path.join(repositoryRoot, "data/source-package.lock.json"),
  });
  if (
    lockReport.missingFiles.length > 0 || lockReport.hashMismatches.length > 0 ||
    lockReport.roleErrors.length > 0 || lockReport.deniedPrefixErrors.length > 0 ||
    lockReport.schemaErrors.length > 0
  ) throw new Error(`Source package lock verification failed: ${JSON.stringify(lockReport)}`);
  const enrichmentReport = await verifyM0Enrichment({ repositoryRoot });
  if (enrichmentReport.matchedRows !== 1_745 || enrichmentReport.conflicts.length > 0) {
    throw new Error(`M0 enrichment verification failed: ${JSON.stringify(enrichmentReport)}`);
  }
  const lockPath = path.join(repositoryRoot, "data/source-package.lock.json");
  const mappingsPath = path.join(repositoryRoot, "data/migrations/integration-v1.0-canonical-mappings.json");
  const policyPath = path.join(repositoryRoot, "data/policies/semantic-policy-v1.json");
  const fieldAuthorityPath = path.join(
    repositoryRoot,
    "docs/八字关系分析系统_M0-M5开发整合包_V1.0/04_迁移与治理/字段权威矩阵_V1.0.csv",
  );
  const [lockBytes, mappingBytes, policyBytes, fieldAuthorityBytes] = await Promise.all([
    readFile(lockPath), readFile(mappingsPath), readFile(policyPath), readFile(fieldAuthorityPath),
  ]);
  const schemaDigest = await digestDirectory(path.join(repositoryRoot, "packages/contracts/schemas"));
  const lock = JSON.parse(lockBytes.toString("utf8")) as SourceLock;
  const overlays = await Promise.all(
    lock.overlays.map(async (file) => JSON.parse(await readFile(path.join(repositoryRoot, file.path), "utf8")) as { patchId: string }),
  );
  const digestMaterial = Buffer.concat([
    lockBytes,
    mappingBytes,
    policyBytes,
    fieldAuthorityBytes,
    Buffer.from(schemaDigest, "utf8"),
    Buffer.from(COMPILER_VERSION, "utf8"),
  ]);
  const rulesetDigest = sha256(digestMaterial);
  const snapshotPath = path.join(outputRoot, rulesetDigest);
  const existing = await readExistingSnapshot(snapshotPath);
  if (existing) return existing;

  const catalog = await importCatalog({ repositoryRoot });
  const semanticIssues = validateCatalogSemantics(catalog.records);
  if (semanticIssues.length > 0) {
    throw new Error(`Catalog semantic validation failed: ${JSON.stringify(semanticIssues)}`);
  }
  const allLockedFiles = [
    ...lock.integrationCore,
    ...lock.semanticSources.m0,
    ...lock.semanticSources.m1M5,
    ...lock.overlays,
  ];
  const moduleRegistry = lock.integrationCore.find((file) => file.path.endsWith("统一模块注册表_V1.0.csv"));
  if (!moduleRegistry) throw new Error("Module registry is absent from source lock");
  const manifest: RulesetManifest = {
    schemaId: "https://bazi.local/schemas/ruleset-manifest-v1.json",
    rulesetDigest,
    integrationVersion: lock.integrationVersion,
    modelVersions: modelVersions(lock),
    compilerVersion: COMPILER_VERSION,
    inputFiles: allLockedFiles.map(({ path: filePath, sha256: fileHash }) => ({ path: filePath, sha256: fileHash })),
    sourceRecordCount: catalog.records.length,
    loadedRecordCount: catalog.runtimeRecords.length,
    compiledRecordCount: catalog.coverage.byDisposition.compiled,
    silentDrops: catalog.coverage.silentDrops,
    coverage: catalog.coverage.byDisposition,
    moduleCoverage: moduleCoverage(catalog.records),
    moduleRegistryHash: moduleRegistry.sha256,
    fieldAuthorityDigest: sha256(fieldAuthorityBytes),
    semanticPolicyDigest: sha256(policyBytes),
    strategyConfigDigest: sha256(mappingBytes),
    schemaDigest,
    overlayPatchIds: overlays.map((overlay) => overlay.patchId),
    catalogDigest: rulesetDigest,
  };

  const temporaryPath = await mkdtemp(path.join(outputRoot, ".building-"));
  let published = false;
  try {
    await writeRuntimeDatabase(path.join(temporaryPath, "runtime.sqlite"), catalog.runtimeRecords);
    await mkdir(path.join(temporaryPath, "fixtures"), { recursive: true });
    await mkdir(path.join(temporaryPath, "governance"), { recursive: true });
    await writeJsonLines(path.join(temporaryPath, "fixtures/m20.jsonl"), catalog.fixtures);
    await writeJsonLines(path.join(temporaryPath, "governance/m21.jsonl"), catalog.governance);
    await writeFile(path.join(temporaryPath, "coverage.json"), `${JSON.stringify(catalog.coverage, null, 2)}\n`);
    await writeFile(path.join(temporaryPath, "ruleset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await cp(path.join(repositoryRoot, "packages/contracts/schemas"), path.join(temporaryPath, "schemas"), { recursive: true });
    await rename(temporaryPath, snapshotPath);
    published = true;
    await Promise.all([
      chmod(path.join(snapshotPath, "runtime.sqlite"), 0o444),
      chmod(path.join(snapshotPath, "ruleset-manifest.json"), 0o444),
      chmod(path.join(snapshotPath, "coverage.json"), 0o444),
    ]);
    const reopened = openCatalogSnapshot(snapshotPath);
    reopened.close();
  } catch (error) {
    await rm(published ? snapshotPath : temporaryPath, { recursive: true, force: true });
    throw error;
  }
  return { rulesetDigest, snapshotPath, manifest };
}

async function writeRuntimeDatabase(file: string, records: readonly unknown[]): Promise<void> {
  const database = new DatabaseSync(file);
  try {
    database.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
      CREATE TABLE catalog_records (
        id TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        module_id TEXT NOT NULL,
        record_class TEXT NOT NULL,
        disposition TEXT NOT NULL,
        lifecycle_status TEXT NOT NULL,
        confidence TEXT NOT NULL,
        source_json TEXT NOT NULL,
        record_json TEXT NOT NULL
      ) STRICT;
    `);
    const insert = database.prepare(
      "INSERT INTO catalog_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    database.exec("BEGIN IMMEDIATE");
    for (const value of records) {
      const record = value as {
        id: string; model: string; moduleId: string; recordClass: string; disposition: string;
        lifecycleStatus: string; confidence: string; source: unknown;
      };
      insert.run(
        record.id, record.model, record.moduleId, record.recordClass, record.disposition,
        record.lifecycleStatus, record.confidence, JSON.stringify(record.source), JSON.stringify(record),
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch { /* transaction may not have started */ }
    throw error;
  } finally {
    database.close();
  }
}

async function readExistingSnapshot(snapshotPath: string): Promise<BuiltCatalogSnapshot | null> {
  try {
    const manifest = JSON.parse(await readFile(path.join(snapshotPath, "ruleset-manifest.json"), "utf8")) as RulesetManifest;
    const reopened = openCatalogSnapshot(snapshotPath);
    reopened.close();
    return { rulesetDigest: manifest.rulesetDigest, snapshotPath, manifest };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function moduleCoverage(
  records: readonly { moduleId: string; disposition: string }[],
): Record<string, { compiled: number; unsupported: number }> {
  const coverage: Record<string, { compiled: number; unsupported: number }> = {};
  for (const record of records) {
    const current = coverage[record.moduleId] ?? { compiled: 0, unsupported: 0 };
    if (record.disposition === "compiled") current.compiled += 1;
    if (record.disposition === "unsupported_with_reason") current.unsupported += 1;
    coverage[record.moduleId] = current;
  }
  return Object.fromEntries(Object.entries(coverage).sort(([left], [right]) => left.localeCompare(right)));
}

async function writeJsonLines(file: string, values: readonly unknown[]): Promise<void> {
  await writeFile(file, `${values.map((value) => JSON.stringify(value)).join("\n")}\n`, "utf8");
}

function modelVersions(lock: SourceLock): Record<string, string> {
  const versions: Record<string, string> = { M0: lock.semanticSources.m0[0]?.modelVersion ?? "unknown" };
  for (const file of lock.semanticSources.m1M5) {
    const match = /\/(M[1-5])\//u.exec(file.path);
    if (match?.[1]) versions[match[1]] = maxVersion(versions[match[1]], file.modelVersion);
  }
  return versions;
}

function maxVersion(left: string | undefined, right: string): string {
  if (!left) return right;
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta > 0 ? left : right;
  }
  return left;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function digestDirectory(directory: string): Promise<string> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await visit(directory);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(path.relative(directory, file).split(path.sep).join("/"));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}
