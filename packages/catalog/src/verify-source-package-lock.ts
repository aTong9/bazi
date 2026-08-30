import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

type FileRole = "integration_core" | "semantic_source" | "overlay";

interface LockedFile {
  path: string;
  role: FileRole;
  modelVersion: string;
  sha256: string;
  expectedRecordCount?: number;
}

interface SourcePackageLock {
  lockVersion: "1.0";
  integrationVersion: "1.0";
  packageRoot: string;
  integrationCore: LockedFile[];
  semanticSources: { m0: LockedFile[]; m1M5: LockedFile[] };
  overlays: LockedFile[];
  deniedPrefixes: string[];
}

export interface SourcePackageLockReport {
  integrationCoreFiles: number;
  m0SemanticSources: number;
  m1M5SemanticSources: number;
  overlays: number;
  missingFiles: string[];
  hashMismatches: Array<{ path: string; expected: string; actual: string }>;
  roleErrors: string[];
  deniedPrefixErrors: string[];
  schemaErrors: string[];
}

export async function verifySourcePackageLock(options: {
  repositoryRoot: string;
  lockFile: string;
}): Promise<SourcePackageLockReport> {
  const lockData: unknown = JSON.parse(await readFile(options.lockFile, "utf8"));
  const schema: object = JSON.parse(
    await readFile(
      path.join(
        options.repositoryRoot,
        "packages/contracts/schemas/source-package-lock.schema.json",
      ),
      "utf8",
    ),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const valid = validate(lockData);
  const schemaErrors = valid ? [] : formatSchemaErrors(validate.errors);

  if (!isSourcePackageLock(lockData)) {
    return emptyReport(schemaErrors);
  }

  const lock = lockData;
  const groups: Array<[FileRole, LockedFile[]]> = [
    ["integration_core", lock.integrationCore],
    ["semantic_source", lock.semanticSources.m0],
    ["semantic_source", lock.semanticSources.m1M5],
    ["overlay", lock.overlays],
  ];
  const roleErrors: string[] = [];
  const allFiles: LockedFile[] = [];
  for (const [expectedRole, files] of groups) {
    for (const file of files) {
      allFiles.push(file);
      if (file.role !== expectedRole) {
        roleErrors.push(`${file.path}: expected ${expectedRole}, got ${file.role}`);
      }
    }
  }

  const seen = new Set<string>();
  for (const file of allFiles) {
    if (seen.has(file.path)) roleErrors.push(`${file.path}: duplicate lock entry`);
    seen.add(file.path);
  }

  const deniedPrefixErrors = allFiles
    .filter((file) => {
      const packageRelative = path.posix.relative(lock.packageRoot, file.path);
      return lock.deniedPrefixes.some((prefix) => packageRelative.startsWith(prefix));
    })
    .map((file) => `${file.path}: denied source prefix`);

  const missingFiles: string[] = [];
  const hashMismatches: SourcePackageLockReport["hashMismatches"] = [];
  for (const file of allFiles) {
    const absolutePath = path.resolve(options.repositoryRoot, file.path);
    try {
      const actual = await sha256File(absolutePath);
      if (actual !== file.sha256) {
        hashMismatches.push({ path: file.path, expected: file.sha256, actual });
      }
    } catch (error) {
      if (isMissingFileError(error)) missingFiles.push(file.path);
      else throw error;
    }
  }

  return {
    integrationCoreFiles: lock.integrationCore.length,
    m0SemanticSources: lock.semanticSources.m0.length,
    m1M5SemanticSources: lock.semanticSources.m1M5.length,
    overlays: lock.overlays.length,
    missingFiles,
    hashMismatches,
    roleErrors,
    deniedPrefixErrors,
    schemaErrors,
  };
}

function emptyReport(schemaErrors: string[]): SourcePackageLockReport {
  return {
    integrationCoreFiles: 0,
    m0SemanticSources: 0,
    m1M5SemanticSources: 0,
    overlays: 0,
    missingFiles: [],
    hashMismatches: [],
    roleErrors: [],
    deniedPrefixErrors: [],
    schemaErrors,
  };
}

function isSourcePackageLock(value: unknown): value is SourcePackageLock {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<SourcePackageLock>;
  return (
    Array.isArray(candidate.integrationCore) &&
    typeof candidate.semanticSources === "object" &&
    candidate.semanticSources !== null &&
    Array.isArray(candidate.semanticSources.m0) &&
    Array.isArray(candidate.semanticSources.m1M5) &&
    Array.isArray(candidate.overlays) &&
    Array.isArray(candidate.deniedPrefixes) &&
    typeof candidate.packageRoot === "string"
  );
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(
    (error) => `${error.instancePath || "/"}: ${error.message ?? error.keyword}`,
  );
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}
