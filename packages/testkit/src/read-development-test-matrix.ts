import path from "node:path";
import yauzl, { type Entry, type ZipFile } from "yauzl";

export const TEST_MATRIX_SUITES = Object.freeze([
  ["01_M0原生M20", 150], ["02_M0单元测试", 42], ["03_接口契约测试", 30], ["04_M1-M5模块测试", 58],
  ["05_冲突安全测试", 35], ["06_JSON数据测试", 25], ["07_报告语言测试", 20], ["08_性能稳定性", 15], ["09_32项回归", 32],
] as const);

export interface DevelopmentTestDefinition {
  readonly testId: string;
  readonly suite: string;
  readonly ordinal: number;
  readonly fields: Readonly<Record<string, string>>;
}

export async function readDevelopmentTestMatrix(repositoryRoot: string): Promise<readonly DevelopmentTestDefinition[]> {
  const workbookPath = path.join(repositoryRoot, "docs/八字关系分析系统_M0-M5开发整合包_V1.0/03_测试与校准/八字关系分析系统_M0-M5开发测试矩阵_V1.0.xlsx");
  const archive = await readXmlArchive(workbookPath);
  const targets = workbookSheetTargets(archive);
  const sharedStrings = parseSharedStrings(archive.get("xl/sharedStrings.xml") ?? "");
  const definitions = TEST_MATRIX_SUITES.flatMap(([suite, expectedCount]) => {
    const target = targets.get(suite);
    if (!target) throw new Error(`Test matrix sheet missing: ${suite}`);
    const rows = worksheetRows(requiredXml(archive, target), sharedStrings);
    const header = rows.get(1);
    if (!header) throw new Error(`Test matrix header missing: ${suite}`);
    const idColumn = Object.entries(header).find(([, value]) => value === "test_id" || value === "Case_ID" || value === "测试ID")?.[0];
    if (!idColumn) throw new Error(`Test id column missing: ${suite}`);
    const items = [...rows.entries()].filter(([rowNumber]) => rowNumber > 1).flatMap(([rowNumber, row]) => {
      const testId = row[idColumn]?.trim();
      if (!testId) return [];
      const fields = Object.freeze(Object.fromEntries(Object.entries(header).map(([column, name]) => [name, row[column] ?? ""])));
      return [Object.freeze({ testId, suite, ordinal: rowNumber - 1, fields })];
    });
    if (items.length !== expectedCount) throw new Error(`${suite} expected ${expectedCount} definitions, found ${items.length}`);
    return items;
  });
  const ids = new Set(definitions.map((definition) => definition.testId));
  if (ids.size !== definitions.length) throw new Error(`Test matrix contains ${definitions.length - ids.size} duplicate ids`);
  if (definitions.length !== 407) throw new Error(`Test matrix expected 407 definitions, found ${definitions.length}`);
  return Object.freeze(definitions);
}

async function readXmlArchive(filePath: string): Promise<Map<string, string>> {
  const contents = new Map<string, string>(); const zipFile = await openZip(filePath);
  await new Promise<void>((resolve, reject) => {
    zipFile.on("error", reject); zipFile.on("end", resolve);
    zipFile.on("entry", (entry: Entry) => {
      if (!/^xl\/(workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet\d+\.xml)$/u.test(entry.fileName)) { zipFile.readEntry(); return; }
      readEntry(zipFile, entry).then((value) => { contents.set(entry.fileName, value.toString("utf8")); zipFile.readEntry(); }, reject);
    });
    zipFile.readEntry();
  });
  return contents;
}

function workbookSheetTargets(archive: ReadonlyMap<string, string>): Map<string, string> {
  const workbook = requiredXml(archive, "xl/workbook.xml"); const relationships = requiredXml(archive, "xl/_rels/workbook.xml.rels");
  const relations = new Map<string, string>();
  for (const match of relationships.matchAll(/<Relationship\b([^>]*)\/?\s*>/gu)) { const id = attribute(match[1] ?? "", "Id"); const target = attribute(match[1] ?? "", "Target"); if (id && target) relations.set(id, normalizeTarget(target)); }
  const result = new Map<string, string>();
  for (const match of workbook.matchAll(/<(?:x:)?sheet\b([^>]*)\/?\s*>/gu)) { const name = attribute(match[1] ?? "", "name"); const relation = attribute(match[1] ?? "", "r:id"); const target = relation ? relations.get(relation) : undefined; if (name && target) result.set(decodeXml(name), target); }
  return result;
}

function worksheetRows(xml: string, sharedStrings: readonly string[]): Map<number, Record<string, string>> {
  const rows = new Map<number, Record<string, string>>();
  for (const match of xml.matchAll(/<(?:x:)?row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/(?:x:)?row>/gu)) {
    const row: Record<string, string> = {};
    for (const cell of (match[2] ?? "").matchAll(/<(?:x:)?c\b([^>]*)\br="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/(?:x:)?c>/gu)) {
      const attributes = cell[1] ?? ""; const column = cell[2]; const body = cell[3] ?? "";
      const raw = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/u.exec(body)?.[1] ?? [...body.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/gu)].map((part) => part[1] ?? "").join("");
      const value = attribute(attributes, "t") === "s" ? sharedStrings[Number(raw)] ?? "" : decodeXml(raw);
      if (column) row[column] = value;
    }
    rows.set(Number(match[1]), row);
  }
  return rows;
}

function parseSharedStrings(xml: string): readonly string[] { return Object.freeze([...xml.matchAll(/<(?:x:)?si>([\s\S]*?)<\/(?:x:)?si>/gu)].map((item) => decodeXml([...(item[1] ?? "").matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/gu)].map((text) => text[1] ?? "").join("")))); }
function attribute(attributes: string, name: string): string | undefined { return new RegExp(`(?:^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") }="([^"]*)"`, "u").exec(attributes)?.[1]; }
function normalizeTarget(target: string): string { const value = target.replace(/^\//u, ""); return value.startsWith("xl/") ? value : `xl/${value}`; }
function requiredXml(archive: ReadonlyMap<string, string>, key: string): string { const value = archive.get(key); if (!value) throw new Error(`Required workbook part missing: ${key}`); return value; }
function decodeXml(value: string): string { return value.replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&amp;/gu, "&").replace(/&#(\d+);/gu, (_match, decimal: string) => String.fromCodePoint(Number(decimal))).replace(/&#x([0-9a-f]+);/giu, (_match, hexadecimal: string) => String.fromCodePoint(Number.parseInt(hexadecimal, 16))); }
async function openZip(filePath: string): Promise<ZipFile> { return new Promise((resolve, reject) => yauzl.open(filePath, { lazyEntries: true, validateEntrySizes: true }, (error, zipFile) => error || !zipFile ? reject(error ?? new Error("Unable to open workbook")) : resolve(zipFile))); }
async function readEntry(zipFile: ZipFile, entry: Entry): Promise<Buffer> { return new Promise((resolve, reject) => zipFile.openReadStream(entry, (error, stream) => { if (error || !stream) { reject(error ?? new Error(`Unable to read ${entry.fileName}`)); return; } const chunks: Buffer[] = []; stream.on("data", (chunk: Buffer) => chunks.push(chunk)); stream.on("error", reject); stream.on("end", () => resolve(Buffer.concat(chunks))); })); }
