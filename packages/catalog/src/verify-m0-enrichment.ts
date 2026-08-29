import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";
import yauzl, { type Entry, type ZipFile } from "yauzl";

type NativeRow = Record<string, string>;

interface SourceLock {
  semanticSources: { m0: Array<{ path: string }> };
}

export interface M0EnrichmentReport {
  readonly integrationRows: number;
  readonly matchedRows: number;
  readonly conflicts: readonly string[];
}

export async function verifyM0Enrichment(options: {
  repositoryRoot: string;
}): Promise<M0EnrichmentReport> {
  const root = path.resolve(options.repositoryRoot);
  const lock = JSON.parse(
    await readFile(path.join(root, "data/source-package.lock.json"), "utf8"),
  ) as SourceLock;
  const workbookRelativePath = lock.semanticSources.m0[0]?.path;
  if (!workbookRelativePath) throw new Error("M0 semantic workbook is absent from source lock");
  const integrationFile = path.join(
    root,
    "docs/八字关系分析系统_M0-M5开发整合包_V1.0/02_运行时核心/M0_标准化记录_V1.0.csv",
  );
  const integrationRows = parse(await readFile(integrationFile, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as NativeRow[];
  const archive = await readXmlArchive(path.join(root, workbookRelativePath));
  const sheetTargets = workbookSheetTargets(archive);
  const worksheetCache = new Map<string, Map<number, Record<string, string>>>();
  const conflicts: string[] = [];
  const occupiedLocations = new Set<string>();
  let matchedRows = 0;

  for (const row of integrationRows) {
    const globalId = row.global_id ?? "";
    const sheetName = row.source_sheet ?? "";
    const sourceRow = Number.parseInt(row.source_row ?? "", 10);
    const expectedReference = `${sheetName}!${sourceRow}`;
    if (!globalId || !sheetName || !Number.isInteger(sourceRow)) {
      conflicts.push(`${globalId || "(missing-id)"}: incomplete enrichment key`);
      continue;
    }
    if (row.native_reference !== expectedReference) {
      conflicts.push(`${globalId}: nativeReference ${row.native_reference ?? ""} != ${expectedReference}`);
      continue;
    }
    const location = `${sheetName}!${sourceRow}`;
    if (occupiedLocations.has(location)) {
      conflicts.push(`${globalId}: duplicate workbook location ${location}`);
      continue;
    }
    occupiedLocations.add(location);
    const target = sheetTargets.get(sheetName);
    if (!target) {
      conflicts.push(`${globalId}: workbook sheet not found: ${sheetName}`);
      continue;
    }
    let worksheet = worksheetCache.get(target);
    if (!worksheet) {
      const xml = archive.get(target);
      if (!xml) {
        conflicts.push(`${globalId}: worksheet XML not found: ${target}`);
        continue;
      }
      worksheet = worksheetRows(xml);
      worksheetCache.set(target, worksheet);
    }
    const nativeRow = worksheet.get(sourceRow);
    const headerRow = worksheet.get(5);
    if (!nativeRow || !headerRow) {
      conflicts.push(`${globalId}: source row/header missing at ${location}`);
      continue;
    }
    if (nativeRow.A !== globalId) {
      conflicts.push(`${globalId}: workbook Record_ID is ${nativeRow.A ?? "(blank)"}`);
      continue;
    }
    const headerByName = new Map(Object.entries(headerRow).map(([column, name]) => [name, column]));
    if (!sameNativeField(row.confidence, nativeRow, headerByName, "置信等级")) {
      conflicts.push(`${globalId}: confidence differs from semantic workbook`);
      continue;
    }
    if (!sameNativeField(row.validation_status, nativeRow, headerByName, "规则状态")) {
      conflicts.push(`${globalId}: validation status differs from semantic workbook`);
      continue;
    }
    matchedRows += 1;
  }

  return { integrationRows: integrationRows.length, matchedRows, conflicts };
}

function sameNativeField(
  integrationValue: string | undefined,
  nativeRow: Record<string, string>,
  headerByName: ReadonlyMap<string, string>,
  header: string,
): boolean {
  const column = headerByName.get(header);
  return column === undefined || (nativeRow[column] ?? "") === (integrationValue ?? "");
}

async function readXmlArchive(filePath: string): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  const zipFile = await openZip(filePath);
  await new Promise<void>((resolve, reject) => {
    zipFile.on("error", reject);
    zipFile.on("end", resolve);
    zipFile.on("entry", (entry: Entry) => {
      if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet\d+\.xml)$/u.test(entry.fileName)) {
        zipFile.readEntry();
        return;
      }
      readEntry(zipFile, entry).then((value) => {
        contents.set(entry.fileName, value.toString("utf8"));
        zipFile.readEntry();
      }, reject);
    });
    zipFile.readEntry();
  });
  return contents;
}

function workbookSheetTargets(archive: ReadonlyMap<string, string>): Map<string, string> {
  const workbook = requiredXml(archive, "xl/workbook.xml");
  const relationships = requiredXml(archive, "xl/_rels/workbook.xml.rels");
  const relationshipTargets = new Map<string, string>();
  for (const match of relationships.matchAll(/<Relationship\b([^>]*)\/?\s*>/gu)) {
    const id = attribute(match[1] ?? "", "Id");
    const target = attribute(match[1] ?? "", "Target");
    if (id && target) relationshipTargets.set(id, normalizeTarget(target));
  }
  const result = new Map<string, string>();
  for (const match of workbook.matchAll(/<x:sheet\b([^>]*)\/?\s*>/gu)) {
    const rawName = attribute(match[1] ?? "", "name");
    const relationshipId = attribute(match[1] ?? "", "r:id");
    const name = rawName ? decodeXml(rawName) : undefined;
    const target = relationshipId ? relationshipTargets.get(relationshipId) : undefined;
    if (name && target) result.set(name, target);
  }
  return result;
}

function attribute(attributes: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|\\s)${escapedName}="([^"]*)"`, "u").exec(attributes)?.[1];
}

function worksheetRows(xml: string): Map<number, Record<string, string>> {
  const rows = new Map<number, Record<string, string>>();
  for (const rowMatch of xml.matchAll(/<x:row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/x:row>/gu)) {
    const rowNumber = Number.parseInt(rowMatch[1] ?? "", 10);
    const row: Record<string, string> = {};
    for (const cellMatch of (rowMatch[2] ?? "").matchAll(/<x:c\b[^>]*\br="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/x:c>/gu)) {
      const column = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const valueMatch = /<x:v>([\s\S]*?)<\/x:v>/u.exec(body) ?? /<x:t[^>]*>([\s\S]*?)<\/x:t>/u.exec(body);
      if (column) row[column] = valueMatch?.[1] ? decodeXml(valueMatch[1]) : "";
    }
    rows.set(rowNumber, row);
  }
  return rows;
}

function normalizeTarget(target: string): string {
  const withoutLeadingSlash = target.replace(/^\//u, "");
  return withoutLeadingSlash.startsWith("xl/") ? withoutLeadingSlash : `xl/${withoutLeadingSlash}`;
}

function requiredXml(archive: ReadonlyMap<string, string>, key: string): string {
  const value = archive.get(key);
  if (!value) throw new Error(`Required workbook part missing: ${key}`);
  return value;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, "&")
    .replace(/&#(\d+);/gu, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/giu, (_match, hexadecimal: string) => String.fromCodePoint(Number.parseInt(hexadecimal, 16)));
}

async function openZip(filePath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, validateEntrySizes: true }, (error, zipFile) => {
      if (error || !zipFile) reject(error ?? new Error("Unable to open workbook"));
      else resolve(zipFile);
    });
  });
}

async function readEntry(zipFile: ZipFile, entry: Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) return reject(error ?? new Error(`Unable to read ${entry.fileName}`));
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}
