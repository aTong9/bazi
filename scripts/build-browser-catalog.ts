import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalogSnapshot, type RulesetManifest } from "../packages/catalog/src/build-catalog-snapshot.js";
import type { CanonicalCatalogRecord } from "../packages/catalog/src/import-catalog.js";
import { openCatalogSnapshot, type CatalogDiagnostics, type CatalogSnapshot } from "../packages/catalog/src/open-catalog-snapshot.js";

export const BROWSER_CATALOG_SCHEMA_VERSION = "bazi.browser-catalog.v1";

const NATIVE_FIELDS_BY_MODULE_PREFIX: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "M1.": Object.freeze(["applicable_group", "main_signal", "secondary_signal", "output_slot", "user_explanation"]),
  "M2.": Object.freeze(["main_signal", "palace_signal", "output_slot", "user_explanation"]),
  "M3.": Object.freeze(["rule_type", "main_signal", "required_conditions", "output_slot", "user_explanation"]),
});

export interface BrowserCatalogRecord {
  readonly id: string;
  readonly moduleId: string;
  readonly jsonKey?: string;
  readonly source: { readonly nativePayload: Readonly<Record<string, string>> };
}

export interface BrowserCatalogDiagnostics extends CatalogDiagnostics {
  readonly sourceLoadedRecordCount: number;
  readonly sourceCompiledRecordCount: number;
  readonly packedRecordCount: number;
}

export interface BrowserCatalogPack {
  readonly schemaVersion: typeof BROWSER_CATALOG_SCHEMA_VERSION;
  readonly packDigest: string;
  readonly manifest: RulesetManifest;
  readonly diagnostics: BrowserCatalogDiagnostics;
  readonly records: readonly BrowserCatalogRecord[];
}

type CatalogSource = Pick<CatalogSnapshot, "manifest" | "diagnostics" | "getModuleRecords">;

export function createBrowserCatalogPack(catalog: CatalogSource): BrowserCatalogPack {
  const records = catalog.diagnostics.activeModules.flatMap((moduleId) => {
    const moduleRecords = [...catalog.getModuleRecords(moduleId)].sort((left, right) => left.id.localeCompare(right.id));
    return moduleRecords.map(projectRecord);
  });
  assertPackSource(catalog, records);

  const diagnostics: BrowserCatalogDiagnostics = Object.freeze({
    ...catalog.diagnostics,
    activeModules: Object.freeze([...catalog.diagnostics.activeModules]),
    sourceLoadedRecordCount: catalog.diagnostics.loadedRecords,
    sourceCompiledRecordCount: catalog.diagnostics.compiledRecords,
    packedRecordCount: records.length,
  });
  const digestMaterial = Object.freeze({
    schemaVersion: BROWSER_CATALOG_SCHEMA_VERSION,
    manifest: catalog.manifest,
    diagnostics,
    records,
  });

  return Object.freeze({
    schemaVersion: BROWSER_CATALOG_SCHEMA_VERSION,
    packDigest: sha256(JSON.stringify(digestMaterial)),
    manifest: catalog.manifest,
    diagnostics,
    records: Object.freeze(records),
  });
}

export async function buildBrowserCatalog(options: {
  readonly repositoryRoot: string;
  readonly outputPath: string;
}): Promise<BrowserCatalogPack> {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const outputPath = path.resolve(options.outputPath);
  const built = await buildCatalogSnapshot({
    repositoryRoot,
    outputRoot: path.join(repositoryRoot, "rulesets"),
  });
  const catalog = openCatalogSnapshot(built.snapshotPath);
  try {
    const pack = createBrowserCatalogPack(catalog);
    await mkdir(path.dirname(outputPath), { recursive: true });
    const temporaryPath = `${outputPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(pack)}\n`);
    await rename(temporaryPath, outputPath);
    return pack;
  } finally {
    catalog.close();
  }
}

export function browserCatalogDigestMaterial(pack: Omit<BrowserCatalogPack, "packDigest">): string {
  return JSON.stringify({
    schemaVersion: pack.schemaVersion,
    manifest: pack.manifest,
    diagnostics: pack.diagnostics,
    records: pack.records,
  });
}

function projectRecord(record: CanonicalCatalogRecord): BrowserCatalogRecord {
  const nativeFields = nativeFieldsFor(record.moduleId);
  const nativePayload = Object.fromEntries(nativeFields.flatMap((fieldName) => {
    const value = record.source.nativePayload[fieldName];
    return value === undefined ? [] : [[fieldName, value]];
  }));
  return Object.freeze({
    id: record.id,
    moduleId: record.moduleId,
    ...(record.moduleId === "M0.M19" && record.jsonKey ? { jsonKey: record.jsonKey } : {}),
    source: Object.freeze({ nativePayload: Object.freeze(nativePayload) }),
  });
}

function nativeFieldsFor(moduleId: string): readonly string[] {
  const entry = Object.entries(NATIVE_FIELDS_BY_MODULE_PREFIX).find(([prefix]) => moduleId.startsWith(prefix));
  return entry?.[1] ?? [];
}

function assertPackSource(catalog: CatalogSource, records: readonly BrowserCatalogRecord[]): void {
  if (records.length !== catalog.diagnostics.loadedRecords) {
    throw new Error(`Browser catalog must retain every runtime record: ${records.length} != ${catalog.diagnostics.loadedRecords}`);
  }
  if (catalog.manifest.rulesetDigest !== catalog.diagnostics.rulesetDigest) {
    throw new Error("Catalog manifest and diagnostics ruleset digests disagree");
  }
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Browser catalog contains duplicate record ${record.id}`);
    ids.add(record.id);
  }
  const outputContracts = records.filter((record) => record.moduleId === "M0.M19" && record.jsonKey);
  if (outputContracts.length !== 45 || new Set(outputContracts.map((record) => record.jsonKey)).size !== 45) {
    throw new Error(`Browser catalog requires 45 unique M0.M19 output contracts; got ${outputContracts.length}`);
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isDirectExecution(): boolean {
  const entryPath = process.argv[1];
  return Boolean(entryPath && path.resolve(entryPath) === fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
  const outputPath = process.argv[2] ?? path.join(repositoryRoot, "apps/web/public/browser-catalog.json");
  const pack = await buildBrowserCatalog({ repositoryRoot, outputPath });
  process.stdout.write(`Browser catalog ${pack.packDigest} (${pack.records.length} records) -> ${path.resolve(outputPath)}\n`);
}
