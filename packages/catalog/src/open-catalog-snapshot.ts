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
      return Object.freeze((moduleRecordsQuery.all(moduleId) as Array<{ record_json: string }>).map((row) => JSON.parse(row.record_json) as CanonicalCatalogRecord));
    },
    close(): void {
      if (!closed) {
        database.close();
        closed = true;
      }
    },
  };
}
