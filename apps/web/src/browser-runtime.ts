import { analyzeProfile, type AnalyzeProfileCommand } from "../../../packages/application/src/analyze-profile.js";
import type { CatalogSnapshot } from "../../../packages/catalog/src/open-catalog-snapshot.js";
import type { CanonicalCatalogRecord } from "../../../packages/catalog/src/import-catalog.js";
import { parseProfileAnalyzeRequest } from "../../../packages/contracts/src/profile-analyze-contract.js";

export type RelationshipEndpoint = "/v1/relationship/profile" | "/v1/relationship/evaluate";

interface BrowserCatalogRecord {
  readonly id: string;
  readonly moduleId: string;
  readonly jsonKey?: string;
  readonly source: { readonly nativePayload: Readonly<Record<string, string>> };
}

interface BrowserCatalogPack {
  readonly schemaVersion: "bazi.browser-catalog.v1";
  readonly packDigest: string;
  readonly manifest: CatalogSnapshot["manifest"];
  readonly diagnostics: CatalogSnapshot["diagnostics"] & {
    readonly sourceLoadedRecordCount: number;
    readonly sourceCompiledRecordCount: number;
    readonly packedRecordCount: number;
  };
  readonly records: readonly BrowserCatalogRecord[];
}

export type BrowserAnalysisResult =
  | { readonly ok: true; readonly status: 200; readonly body: unknown }
  | { readonly ok: false; readonly status: number; readonly body: { readonly issues: readonly { readonly code: string; readonly message: string; readonly jsonPointer?: string }[] } };

export type BrowserCommandResult =
  | { readonly ok: true; readonly command: AnalyzeProfileCommand }
  | BrowserAnalysisResult;

let catalogPromise: Promise<CatalogSnapshot> | undefined;

export async function fetchBrowserHealth(signal?: AbortSignal): Promise<unknown> {
  signal?.throwIfAborted();
  const catalog = await loadBrowserCatalog();
  signal?.throwIfAborted();
  return { status: "ready", catalog: catalog.diagnostics };
}

export async function analyzeRelationshipInBrowser(
  endpoint: RelationshipEndpoint,
  payload: unknown,
  signal?: AbortSignal,
): Promise<BrowserAnalysisResult> {
  signal?.throwIfAborted();
  const parsed = toAnalyzeProfileCommand(endpoint, payload);
  if (!parsed.ok) return parsed;
  const catalog = await loadBrowserCatalog();
  signal?.throwIfAborted();
  const result = analyzeProfile(parsed.command, catalog);
  signal?.throwIfAborted();
  return result.ok
    ? { ok: true, status: 200, body: result.response }
    : { ok: false, status: result.httpStatus, body: { issues: result.issues } };
}

export function toAnalyzeProfileCommand(endpoint: RelationshipEndpoint, payload: unknown): BrowserCommandResult {
  const parsed = parseProfileAnalyzeRequest(payload);
  if (!parsed.valid) {
    return {
      ok: false,
      status: 400,
      body: {
        issues: Object.freeze(parsed.errors.map((message) => Object.freeze({ code: "E_REQUEST_SCHEMA", message }))),
      },
    };
  }
  const command: AnalyzeProfileCommand = endpoint === "/v1/relationship/evaluate"
    ? {
        ...parsed.command,
        relationshipMode: "specific_partner_with_reality_data",
        ...(parsed.observations ? { observations: parsed.observations } : {}),
        ...(parsed.gateAssessments ? { gateAssessments: parsed.gateAssessments } : {}),
        ...(parsed.crossStateValidation ? { crossStateValidation: parsed.crossStateValidation } : {}),
        ...(parsed.crossStateEvidence ? { crossStateEvidence: parsed.crossStateEvidence } : {}),
      }
    : { ...parsed.command, relationshipMode: "single_chart_relationship_profile" };
  return { ok: true, command };
}

export async function openBrowserCatalogPack(value: unknown): Promise<CatalogSnapshot> {
  const pack = parseBrowserCatalogPack(value);
  const actualDigest = await sha256(JSON.stringify({
    schemaVersion: pack.schemaVersion,
    manifest: pack.manifest,
    diagnostics: pack.diagnostics,
    records: pack.records,
  }));
  if (actualDigest !== pack.packDigest) throw new Error("Browser catalog pack digest mismatch");

  const canonicalRecords = pack.records.map(asCanonicalCatalogRecord);
  const recordsById = new Map(canonicalRecords.map((record) => [record.id, record]));
  const recordsByModule = new Map<string, readonly CanonicalCatalogRecord[]>();
  for (const moduleId of pack.diagnostics.activeModules) {
    recordsByModule.set(moduleId, Object.freeze(canonicalRecords.filter((record) => record.moduleId === moduleId)));
  }
  const outputContracts = Object.freeze(canonicalRecords.filter((record) => record.moduleId === "M0.M19"));
  const emptyRecords = Object.freeze([]) as readonly CanonicalCatalogRecord[];

  return Object.freeze({
    manifest: pack.manifest,
    diagnostics: pack.diagnostics,
    getRecord: (id: string) => recordsById.get(id) ?? null,
    getModuleRecords: (moduleId: string) => recordsByModule.get(moduleId) ?? emptyRecords,
    getOutputContracts: () => outputContracts,
    queryRecords: ({ moduleId, outputSlot, limit, cursor = 0 }) => {
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("query limit must be an integer from 1 to 500");
      if (!Number.isInteger(cursor) || cursor < 0) throw new Error("query cursor must be a non-negative integer");
      const candidates = (recordsByModule.get(moduleId) ?? emptyRecords)
        .filter((record) => !outputSlot || record.source.nativePayload.output_slot === outputSlot);
      const records = Object.freeze(candidates.slice(cursor, cursor + limit));
      return Object.freeze({ records, nextCursor: cursor + records.length < candidates.length ? cursor + records.length : null });
    },
    close: () => undefined,
  });
}

async function loadBrowserCatalog(): Promise<CatalogSnapshot> {
  if (!catalogPromise) {
    catalogPromise = fetch(`${import.meta.env.BASE_URL}browser-catalog.json`, {
      headers: { accept: "application/json" },
      cache: "no-cache",
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Browser catalog request failed (HTTP ${response.status})`);
      return openBrowserCatalogPack(await response.json() as unknown);
    }).catch((error: unknown) => {
      catalogPromise = undefined;
      throw error;
    });
  }
  return catalogPromise;
}

function parseBrowserCatalogPack(value: unknown): BrowserCatalogPack {
  const pack = record(value);
  const manifest = pack && record(pack.manifest);
  const diagnostics = pack && record(pack.diagnostics);
  if (
    !pack || pack.schemaVersion !== "bazi.browser-catalog.v1" || !isDigest(pack.packDigest)
    || !manifest || !isDigest(manifest.rulesetDigest)
    || !diagnostics || diagnostics.rulesetDigest !== manifest.rulesetDigest
    || !isNonNegativeInteger(diagnostics.loadedRecords)
    || !isNonNegativeInteger(diagnostics.compiledRecords)
    || !isNonNegativeInteger(diagnostics.sourceLoadedRecordCount)
    || !isNonNegativeInteger(diagnostics.sourceCompiledRecordCount)
    || !isNonNegativeInteger(diagnostics.packedRecordCount)
    || !isStringArray(diagnostics.activeModules)
    || !Array.isArray(pack.records)
  ) throw new Error("Browser catalog pack metadata is invalid");

  const records = pack.records.map(parseBrowserCatalogRecord);
  if (
    records.length !== diagnostics.packedRecordCount
    || records.length !== diagnostics.sourceLoadedRecordCount
    || records.length !== diagnostics.loadedRecords
    || records.length !== manifest.loadedRecordCount
    || diagnostics.compiledRecords !== manifest.compiledRecordCount
    || diagnostics.sourceCompiledRecordCount !== manifest.compiledRecordCount
  ) throw new Error("Browser catalog pack record counts disagree");

  const activeModules = new Set(diagnostics.activeModules);
  const ids = new Set<string>();
  const previousIdByModule = new Map<string, string>();
  for (const item of records) {
    if (!activeModules.has(item.moduleId)) throw new Error(`Browser catalog record uses inactive module ${item.moduleId}`);
    if (ids.has(item.id)) throw new Error(`Browser catalog contains duplicate record ${item.id}`);
    const previousId = previousIdByModule.get(item.moduleId);
    if (previousId && previousId.localeCompare(item.id) >= 0) throw new Error(`Browser catalog module ${item.moduleId} is not ordered by id`);
    ids.add(item.id);
    previousIdByModule.set(item.moduleId, item.id);
  }
  const outputContracts = records.filter((item) => item.moduleId === "M0.M19" && item.jsonKey);
  if (outputContracts.length !== 45 || new Set(outputContracts.map((item) => item.jsonKey)).size !== 45) {
    throw new Error("Browser catalog must contain 45 unique M0.M19 output contracts");
  }
  return value as BrowserCatalogPack;
}

function parseBrowserCatalogRecord(value: unknown): BrowserCatalogRecord {
  const item = record(value);
  const source = item && record(item.source);
  const nativePayload = source && record(source.nativePayload);
  if (!item || !isNonEmptyString(item.id) || !isNonEmptyString(item.moduleId) || !source || !nativePayload) {
    throw new Error("Browser catalog contains an invalid record");
  }
  if (item.jsonKey !== undefined && !isNonEmptyString(item.jsonKey)) throw new Error(`Browser catalog record ${item.id} has an invalid jsonKey`);
  if (!Object.values(nativePayload).every((field) => typeof field === "string")) {
    throw new Error(`Browser catalog record ${item.id} has a non-string native field`);
  }
  return value as BrowserCatalogRecord;
}

// The application currently accepts the wider SQLite record type. This is the
// single compatibility seam for the audited browser projection; parity tests
// protect the fields retained by the packer.
function asCanonicalCatalogRecord(record: BrowserCatalogRecord): CanonicalCatalogRecord {
  return record as unknown as CanonicalCatalogRecord;
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isDigest(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }
function isNonEmptyString(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function isNonNegativeInteger(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0; }
function isStringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(isNonEmptyString); }
