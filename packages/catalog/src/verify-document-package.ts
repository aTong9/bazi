import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";
import yauzl from "yauzl";

const MANIFEST_PATH = "00_开发入口/文件清单_V1.0.csv";

interface ManifestRow {
  relative_path: string;
  size_bytes: string;
  sha256: string;
}

export interface VerifyDocumentPackageOptions {
  packageRoot: string;
}

export interface SizeMismatch {
  path: string;
  expected: number;
  actual: number;
}

export interface HashMismatch {
  path: string;
  expected: string;
  actual: string;
}

export interface DocumentPackageReport {
  manifestEntries: number;
  packageFiles: number;
  missingFiles: string[];
  unexpectedFiles: string[];
  sizeMismatches: SizeMismatch[];
  hashMismatches: HashMismatch[];
  jsonErrors: string[];
  csvErrors: string[];
  zipErrors: string[];
}

export async function verifyDocumentPackage({
  packageRoot,
}: VerifyDocumentPackageOptions): Promise<DocumentPackageReport> {
  const manifestFile = path.join(packageRoot, MANIFEST_PATH);
  const manifestRows = parse(await readFile(manifestFile, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as ManifestRow[];

  const actualFiles = await listFiles(packageRoot);
  const expectedFiles = new Set([
    MANIFEST_PATH,
    ...manifestRows.map((row) => row.relative_path),
  ]);
  const actualFileSet = new Set(actualFiles);

  const missingFiles = manifestRows
    .map((row) => row.relative_path)
    .filter((relativePath) => !actualFileSet.has(relativePath))
    .sort();
  const unexpectedFiles = actualFiles
    .filter((relativePath) => !expectedFiles.has(relativePath))
    .sort();
  const sizeMismatches: SizeMismatch[] = [];
  const hashMismatches: HashMismatch[] = [];
  const jsonErrors: string[] = [];
  const csvErrors: string[] = [];
  const zipErrors: string[] = [];

  for (const row of manifestRows) {
    if (!actualFileSet.has(row.relative_path)) {
      continue;
    }

    const absolutePath = path.join(packageRoot, row.relative_path);
    const fileStat = await stat(absolutePath);
    const expectedSize = Number.parseInt(row.size_bytes, 10);

    if (fileStat.size !== expectedSize) {
      sizeMismatches.push({
        path: row.relative_path,
        expected: expectedSize,
        actual: fileStat.size,
      });
    }

    const actualHash = await sha256File(absolutePath);
    const expectedHash = row.sha256.toLowerCase();
    if (actualHash !== expectedHash) {
      hashMismatches.push({
        path: row.relative_path,
        expected: expectedHash,
        actual: actualHash,
      });
    }

    if (row.relative_path.endsWith(".json")) {
      try {
        JSON.parse(await readFile(absolutePath, "utf8"));
      } catch (error) {
        jsonErrors.push(`${row.relative_path}: ${errorMessage(error)}`);
      }
    } else if (row.relative_path.endsWith(".csv")) {
      try {
        parse(await readFile(absolutePath, "utf8"), {
          bom: true,
          columns: true,
          relax_column_count: false,
          skip_empty_lines: true,
        });
      } catch (error) {
        csvErrors.push(`${row.relative_path}: ${errorMessage(error)}`);
      }
    } else if (/\.(xlsx|docx|pptx)$/u.test(row.relative_path)) {
      try {
        await verifyZipCrc(absolutePath);
      } catch (error) {
        zipErrors.push(`${row.relative_path}: ${errorMessage(error)}`);
      }
    }
  }

  return {
    manifestEntries: manifestRows.length,
    packageFiles: actualFiles.length,
    missingFiles,
    unexpectedFiles,
    sizeMismatches,
    hashMismatches,
    jsonErrors,
    csvErrors,
    zipErrors,
  };
}

async function verifyZipCrc(filePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, validateEntrySizes: true }, (openError, zipFile) => {
      if (openError || !zipFile) return reject(openError ?? new Error("Unable to open ZIP"));
      zipFile.on("error", reject);
      zipFile.on("end", resolve);
      zipFile.on("entry", (entry) => {
        if (/\/$/u.test(entry.fileName)) return zipFile.readEntry();
        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError ?? new Error("Unable to read ZIP entry"));
          stream.on("error", reject);
          stream.on("end", () => zipFile.readEntry());
          stream.resume();
        });
      });
      zipFile.readEntry();
    });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        files.push(path.relative(root, absolutePath).split(path.sep).join("/"));
      }
    }
  }

  await visit(root);
  return files.sort();
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}
