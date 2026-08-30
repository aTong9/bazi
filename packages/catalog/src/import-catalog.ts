import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";

import type { CompilationDisposition, SourceReference } from "../../rule-ir/src/index.js";
import { readM0SemanticWorkbook } from "./verify-m0-enrichment.js";

type NativeRow = Record<string, string>;

export interface CanonicalCatalogRecord {
  readonly id: string;
  readonly model: string;
  readonly moduleId: string;
  readonly recordClass: string;
  readonly runtimeEligible: boolean;
  readonly disposition: CompilationDisposition;
  readonly unsupportedReason?: string;
  readonly handlerKey?: string;
  readonly jsonKey?: string;
  readonly semanticFields?: Readonly<Record<string, string>>;
  readonly lifecycleStatus: string;
  readonly nativeStatus: string;
  readonly confidence: string;
  readonly nativeConfidence: string;
  readonly source: SourceReference;
}

export interface CatalogCoverage {
  readonly total: number;
  readonly silentDrops: number;
  readonly byDisposition: Readonly<Record<CompilationDisposition, number>>;
}

export interface ImportedCatalog {
  readonly records: readonly CanonicalCatalogRecord[];
  readonly runtimeRecords: readonly CanonicalCatalogRecord[];
  readonly fixtures: readonly CanonicalCatalogRecord[];
  readonly governance: readonly CanonicalCatalogRecord[];
  readonly coverage: CatalogCoverage;
}

interface SourceLockFile { path: string; sha256: string }
interface SourceLock {
  integrationCore: SourceLockFile[];
  semanticSources: { m0: SourceLockFile[]; m1M5: SourceLockFile[] };
}

interface CanonicalMappings {
  lifecycleStatus: { nativeToCanonical: Record<string, string> };
  confidence: { nativeToCanonical: Record<string, string> };
}

export async function importCatalog(options: { repositoryRoot: string }): Promise<ImportedCatalog> {
  const root = options.repositoryRoot;
  const lock = JSON.parse(await readFile(path.join(root, "data/source-package.lock.json"), "utf8")) as SourceLock;
  const mappings = JSON.parse(
    await readFile(path.join(root, "data/migrations/integration-v1.0-canonical-mappings.json"), "utf8"),
  ) as CanonicalMappings;
  const hashes = sourceHashes(lock);
  const coreRoot = path.join(root, "docs/八字关系分析系统_M0-M5开发整合包_V1.0/02_运行时核心");
  const m0 = await readCsv(path.join(coreRoot, "M0_标准化记录_V1.0.csv"));
  const m1M5 = await readCsv(path.join(coreRoot, "M1-M5_原子规则总表_V1.0.csv"));
  const m19Fields = await readCsv(path.join(coreRoot, "M0_M19输出字段_V1.0.csv"));
  const semanticRows = await readM0SemanticWorkbook({ repositoryRoot: root });
  const semanticById = new Map(semanticRows.map((row) => [row.id, row.fields]));
  const m19JsonKeys = new Map(m19Fields.map((row) => [required(row, "Field_ID"), required(row, "json_key")]));
  if (m19JsonKeys.size !== 45) throw new Error(`M19 field dictionary must contain 45 unique IDs; got ${m19JsonKeys.size}`);

  const records = [
    ...m0.map((row, index) => importM0(row, index, hashes, mappings, m19JsonKeys, semanticById)),
    ...m1M5.map((row, index) => importM1M5(row, index, hashes, mappings)),
  ];
  const ids = new Set<string>();
  for (const record of records) {
    if (!record.id) throw new Error(`Missing record ID at ${record.source.sourceFile}:${record.source.sourceRow}`);
    if (ids.has(record.id)) throw new Error(`Duplicate record ID: ${record.id}`);
    ids.add(record.id);
  }
  const byDisposition = dispositionCounter();
  for (const record of records) byDisposition[record.disposition] += 1;

  return {
    records,
    runtimeRecords: records.filter((record) => record.runtimeEligible),
    fixtures: records.filter((record) => record.disposition === "test_only"),
    governance: records.filter((record) => record.disposition === "governance"),
    coverage: { total: records.length, silentDrops: 0, byDisposition },
  };
}

function importM0(
  row: NativeRow,
  index: number,
  hashes: ReadonlyMap<string, string>,
  mappings: CanonicalMappings,
  m19JsonKeys: ReadonlyMap<string, string>,
  semanticById: ReadonlyMap<string, Readonly<Record<string, string>>>,
): CanonicalCatalogRecord {
  const recordClass = required(row, "record_class");
  const moduleId = required(row, "module_id");
  const disposition = m0Disposition(recordClass, moduleId);
  const id = required(row, "global_id");
  const semanticFields = semanticById.get(id);
  if (!semanticFields) throw new Error(`Semantic workbook payload missing for ${id}`);
  const handlerKey = disposition === "compiled" ? handlerKeyFor(id, moduleId) : undefined;
  const jsonKey = recordClass === "output_contract" ? m19JsonKeys.get(id) : undefined;
  if (recordClass === "output_contract" && !jsonKey) throw new Error(`M19 JSON key missing for ${id}`);
  return canonicalRecord({
    row,
    index,
    id,
    model: "M0",
    moduleId,
    recordClass,
    disposition,
    runtimeEligible: recordClass !== "test_case" && recordClass !== "governance_record",
    nativeConfidence: row.confidence ?? "",
    hashes,
    mappings,
    ...(disposition === "unsupported_with_reason"
      ? { unsupportedReason: "module_compiler_not_implemented" }
      : {}),
    ...(handlerKey ? { handlerKey } : {}),
    ...(jsonKey ? { jsonKey } : {}),
    semanticFields,
  });
}

function importM1M5(
  row: NativeRow,
  index: number,
  hashes: ReadonlyMap<string, string>,
  mappings: CanonicalMappings,
): CanonicalCatalogRecord {
  const model = required(row, "model");
  const moduleId = required(row, "module_id");
  const disposition: CompilationDisposition = ["M1", "M2", "M3", "M4", "M5"].includes(model) ? "compiled" : "unsupported_with_reason";
  const id = required(row, "rule_id");
  return canonicalRecord({
    row,
    index,
    id,
    model,
    moduleId,
    recordClass: "executable_rule",
    disposition,
    runtimeEligible: true,
    nativeConfidence: row.confidence_base ?? "",
    hashes,
    mappings,
    ...(disposition === "compiled" ? { handlerKey: handlerKeyFor(id, moduleId) } : { unsupportedReason: "module_compiler_not_implemented" }),
  });
}

function canonicalRecord(input: {
  row: NativeRow;
  index: number;
  id: string;
  model: string;
  moduleId: string;
  recordClass: string;
  disposition: CompilationDisposition;
  runtimeEligible: boolean;
  nativeConfidence: string;
  hashes: ReadonlyMap<string, string>;
  mappings: CanonicalMappings;
  unsupportedReason?: string;
  handlerKey?: string;
  jsonKey?: string;
  semanticFields?: Readonly<Record<string, string>>;
}): CanonicalCatalogRecord {
  const sourceFile = required(input.row, "source_file");
  const nativeStatus = input.row.validation_status ?? "";
  const lifecycleStatus = mapped(input.mappings.lifecycleStatus.nativeToCanonical, nativeStatus, "status");
  const confidence = mapped(input.mappings.confidence.nativeToCanonical, input.nativeConfidence, "confidence");
  const sourceHash = input.hashes.get(path.basename(sourceFile));
  if (!sourceHash) throw new Error(`No locked source hash for ${sourceFile}`);
  return {
    id: input.id,
    model: input.model,
    moduleId: input.moduleId,
    recordClass: input.recordClass,
    runtimeEligible: input.runtimeEligible,
    disposition: input.disposition,
    ...(input.unsupportedReason === undefined ? {} : { unsupportedReason: input.unsupportedReason }),
    ...(input.handlerKey === undefined ? {} : { handlerKey: input.handlerKey }),
    ...(input.jsonKey === undefined ? {} : { jsonKey: input.jsonKey }),
    ...(input.semanticFields === undefined ? {} : { semanticFields: input.semanticFields }),
    lifecycleStatus,
    nativeStatus,
    confidence,
    nativeConfidence: input.nativeConfidence,
    source: {
      sourceFile,
      ...(input.row.source_sheet ? { sourceSheet: input.row.source_sheet } : {}),
      sourceRow: numericSourceRow(input.row.source_row, input.index),
      nativeReference: input.row.native_reference || input.id,
      sourceVersion: input.row.source_version || input.row.version || "unknown",
      sourceHash,
      nativePayload: Object.freeze({ ...input.row }),
    },
  };
}

function m0Disposition(recordClass: string, moduleId: string): CompilationDisposition {
  if (/^M0\.M(?:0[2-9]|1[0-8])$/u.test(moduleId)) return "compiled";
  switch (recordClass) {
    case "reference_data": return "reference_only";
    case "output_contract": return "reference_only";
    case "test_case": return "test_only";
    case "governance_record": return "governance";
    case "executable_rule": return "unsupported_with_reason";
    default: throw new Error(`Unknown M0 record_class: ${recordClass}`);
  }
}

function handlerKeyFor(id: string, moduleId: string): string {
  const prefix = id.split("-").slice(0, 2).join(".").toLowerCase();
  return `${moduleId.toLowerCase()}.${prefix}`;
}

function sourceHashes(lock: SourceLock): Map<string, string> {
  const files = [...lock.integrationCore, ...lock.semanticSources.m0, ...lock.semanticSources.m1M5];
  return new Map(files.map((file) => [path.basename(file.path), file.sha256]));
}

function mapped(map: Record<string, string>, nativeValue: string, label: string): string {
  const value = map[nativeValue];
  if (value === undefined) throw new Error(`Unmapped native ${label}: ${nativeValue}`);
  return value;
}

function required(row: NativeRow, field: string): string {
  const value = row[field];
  if (!value) throw new Error(`Missing required field ${field}`);
  return value;
}

function numericSourceRow(value: string | undefined, index: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : index + 2;
}

async function readCsv(file: string): Promise<NativeRow[]> {
  return parse(await readFile(file, "utf8"), { bom: true, columns: true, skip_empty_lines: true }) as NativeRow[];
}

function dispositionCounter(): Record<CompilationDisposition, number> {
  return { compiled: 0, reference_only: 0, guardrail: 0, test_only: 0, governance: 0, unsupported_with_reason: 0 };
}
