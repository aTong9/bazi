import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Ajv2020 } from "ajv/dist/2020.js";

import type { RulesetManifest } from "./build-catalog-snapshot.js";
import type { CanonicalCatalogRecord } from "./import-catalog.js";

export interface CatalogDiagnostics {
  readonly rulesetDigest: string;
  readonly loadedRecords: number;
  readonly compiledRecords: number;
  readonly activeModules: readonly string[];
}

export interface CatalogSnapshot {
  readonly manifest: RulesetManifest;
  readonly diagnostics: CatalogDiagnostics;
  getRecord(id: string): CanonicalCatalogRecord | null;
  getModuleRecords(moduleId: string): readonly CanonicalCatalogRecord[];
  queryRecords(input: { readonly moduleId: string; readonly outputSlot?: string; readonly limit: number; readonly cursor?: number }): { readonly records: readonly CanonicalCatalogRecord[]; readonly nextCursor: number | null };
  getOutputContracts(): readonly CanonicalCatalogRecord[];
  close(): void;
}

export function openCatalogSnapshot(snapshotPath: string): CatalogSnapshot {
  const absolutePath = path.resolve(snapshotPath);
  const manifest = JSON.parse(
    readFileSync(path.join(absolutePath, "ruleset-manifest.json"), "utf8"),
  ) as RulesetManifest;
  const manifestSchema: object = JSON.parse(
    readFileSync(path.join(absolutePath, "schemas/ruleset-manifest.schema.json"), "utf8"),
  );
  const validateManifest = new Ajv2020({ allErrors: true, strict: true }).compile(manifestSchema);
  if (!validateManifest(manifest)) {
    throw new Error(`Ruleset manifest schema validation failed: ${JSON.stringify(validateManifest.errors)}`);
  }
  if (path.basename(absolutePath) !== manifest.rulesetDigest) {
    throw new Error("Snapshot directory and manifest digest disagree");
  }
  if (manifest.catalogDigest !== manifest.rulesetDigest) {
    throw new Error("Catalog digest and ruleset digest disagree");
  }
  const database = new DatabaseSync(path.join(absolutePath, "runtime.sqlite"), { readOnly: true });
  const countRow = database.prepare("SELECT COUNT(*) AS count FROM catalog_records").get() as { count: number };
  if (countRow.count !== manifest.loadedRecordCount) {
    database.close();
    throw new Error(`Runtime record count mismatch: ${countRow.count} != ${manifest.loadedRecordCount}`);
  }
  const moduleRows = database
    .prepare("SELECT DISTINCT module_id FROM catalog_records ORDER BY module_id")
    .all() as Array<{ module_id: string }>;
  const query = database.prepare("SELECT record_json FROM catalog_records WHERE id = ?");
  const outputContractsQuery = database.prepare("SELECT record_json FROM catalog_records WHERE record_class = 'output_contract' ORDER BY id");
  const moduleRecordsQuery = database.prepare("SELECT record_json FROM catalog_records WHERE module_id = ? ORDER BY id");
  const moduleCache = new Map<string, readonly CanonicalCatalogRecord[]>();
  let closed = false;
  return {
    manifest,
    diagnostics: {
      rulesetDigest: manifest.rulesetDigest,
      loadedRecords: countRow.count,
      compiledRecords: manifest.compiledRecordCount,
      activeModules: Object.freeze(moduleRows.map((row) => row.module_id)),
    },
    getRecord(id: string): CanonicalCatalogRecord | null {
      if (closed) throw new Error("Catalog snapshot is closed");
      const row = query.get(id) as { record_json: string } | undefined;
      return row ? (JSON.parse(row.record_json) as CanonicalCatalogRecord) : null;
    },
    getOutputContracts(): readonly CanonicalCatalogRecord[] {
      if (closed) throw new Error("Catalog snapshot is closed");
      return Object.freeze((outputContractsQuery.all() as Array<{ record_json: string }>).map((row) => JSON.parse(row.record_json) as CanonicalCatalogRecord));
    },
    getModuleRecords(moduleId: string): readonly CanonicalCatalogRecord[] {
      if (closed) throw new Error("Catalog snapshot is closed");
      const cached = moduleCache.get(moduleId);
      if (cached) return cached;
      const records = Object.freeze((moduleRecordsQuery.all(moduleId) as Array<{ record_json: string }>).map((row) => JSON.parse(row.record_json) as CanonicalCatalogRecord));
      moduleCache.set(moduleId, records);
      return records;
    },
    queryRecords(input): { readonly records: readonly CanonicalCatalogRecord[]; readonly nextCursor: number | null } {
      if (closed) throw new Error("Catalog snapshot is closed");
      if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 500) throw new Error("query limit must be an integer from 1 to 500");
      const offset = input.cursor ?? 0;
      if (!Number.isInteger(offset) || offset < 0) throw new Error("query cursor must be a non-negative integer");
      const cached = moduleCache.get(input.moduleId);
      const moduleRecords = cached ?? Object.freeze((moduleRecordsQuery.all(input.moduleId) as Array<{ record_json: string }>).map((row) => JSON.parse(row.record_json) as CanonicalCatalogRecord));
      if (!cached) moduleCache.set(input.moduleId, moduleRecords);
      const values = moduleRecords.filter((record) => !input.outputSlot || record.source.nativePayload.output_slot === input.outputSlot);
      const records = values.slice(offset, offset + input.limit);
      return Object.freeze({ records: Object.freeze(records), nextCursor: offset + records.length < values.length ? offset + records.length : null });
    },
    close(): void {
      if (!closed) {
        database.close();
        closed = true;
      }
    },
  };
}
