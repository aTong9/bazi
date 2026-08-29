import { createReadStream, realpathSync, statSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { analyzeM0 } from "../../../packages/application/src/analyze-m0.js";
import { analyzeProfile } from "../../../packages/application/src/analyze-profile.js";
import { openCatalogSnapshot } from "../../../packages/catalog/src/open-catalog-snapshot.js";
import { parseM0AnalyzeRequest } from "../../../packages/contracts/src/m0-analyze-contract.js";
import { parseProfileAnalyzeRequest } from "../../../packages/contracts/src/profile-analyze-contract.js";

interface StaticWebRoot {
  readonly path: string;
  readonly indexPath: string;
}

export function createApiServer(options: { snapshotPath: string; webRoot?: string }): Server {
  const webRoot = options.webRoot === undefined ? null : openStaticWebRoot(options.webRoot);
  const catalog = openCatalogSnapshot(options.snapshotPath);
  const server = createServer(async (request, response) => {
    try {
      await route(request, response, catalog, webRoot);
    } catch (error) {
      sendJson(response, 500, {
        issues: [{ code: "E_INTERNAL", severity: "error", stage: "request", message: "Internal server error", retryable: false }],
      });
    }
  });
  server.once("close", () => catalog.close());
  return server;
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  catalog: ReturnType<typeof openCatalogSnapshot>,
  webRoot: StaticWebRoot | null,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ready", catalog: catalog.diagnostics });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/system/manifest") {
    sendJson(response, 200, catalog.manifest);
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/m0/analyze") {
    const body = await readJsonBody(request);
    if (!body.ok) {
      sendJson(response, 400, { issues: [{ code: "E_JSON", severity: "error", stage: "request", message: body.message, retryable: false }] });
      return;
    }
    const parsed = parseM0AnalyzeRequest(body.value);
    if (!parsed.valid) {
      sendJson(response, 400, { issues: parsed.errors.map((message) => ({ code: "E_REQUEST_SCHEMA", severity: "error", stage: "request", message, retryable: false })) });
      return;
    }
    const result = analyzeM0(parsed.command, catalog);
    if (!result.ok) sendJson(response, result.httpStatus, { issues: result.issues });
    else sendJson(response, 200, result.response);
    return;
  }
  if (request.method === "POST" && ["/v1/profile/analyze", "/v1/relationship/profile", "/v1/relationship/evaluate"].includes(url.pathname)) {
    const body = await readJsonBody(request);
    if (!body.ok) {
      sendJson(response, 400, { issues: [{ code: "E_JSON", severity: "error", stage: "request", message: body.message, retryable: false }] });
      return;
    }
    const parsed = parseProfileAnalyzeRequest(body.value);
    if (!parsed.valid) {
      sendJson(response, 400, { issues: parsed.errors.map((message) => ({ code: "E_REQUEST_SCHEMA", severity: "error", stage: "request", message, retryable: false })) });
      return;
    }
    const command = url.pathname === "/v1/relationship/evaluate"
      ? { ...parsed.command, relationshipMode: "specific_partner_with_reality_data" as const, ...(parsed.observations ? { observations: parsed.observations } : {}), ...(parsed.gateAssessments ? { gateAssessments: parsed.gateAssessments } : {}), ...(parsed.crossStateValidation ? { crossStateValidation: parsed.crossStateValidation } : {}), ...(parsed.crossStateEvidence ? { crossStateEvidence: parsed.crossStateEvidence } : {}) }
      : { ...parsed.command, relationshipMode: "single_chart_relationship_profile" as const };
    const result = analyzeProfile(command, catalog);
    if (!result.ok) sendJson(response, result.httpStatus, { issues: result.issues });
    else sendJson(response, 200, result.response);
    return;
  }
  const decodedRequestPath = decodeRequestPath(request.url);
  const targetsApi = isApiPath(url.pathname) || (decodedRequestPath !== null && isApiPath(decodedRequestPath));
  if (webRoot && (request.method === "GET" || request.method === "HEAD") && !targetsApi) {
    await serveStaticWebRequest(request, response, webRoot);
    return;
  }
  sendJson(response, 404, { issues: [{ code: "E_ROUTE_NOT_FOUND", severity: "error", stage: "request", message: "Route not found", retryable: false }] });
}

function openStaticWebRoot(webRoot: string): StaticWebRoot {
  const resolvedRoot = path.resolve(webRoot);
  let rootStats;
  try {
    rootStats = statSync(resolvedRoot);
  } catch {
    throw new Error(`Static web root does not exist: ${resolvedRoot}`);
  }
  if (!rootStats.isDirectory()) throw new Error(`Static web root is not a directory: ${resolvedRoot}`);

  const realRoot = realpathSync(resolvedRoot);
  const indexPath = path.join(realRoot, "index.html");
  let indexStats;
  try {
    indexStats = statSync(indexPath);
  } catch {
    throw new Error(`Static web root is missing index.html: ${realRoot}`);
  }
  if (!indexStats.isFile()) throw new Error(`Static web index is not a file: ${indexPath}`);
  const realIndexPath = realpathSync(indexPath);
  if (!isInsideRoot(realRoot, realIndexPath)) throw new Error(`Static web index resolves outside its root: ${indexPath}`);
  return Object.freeze({ path: realRoot, indexPath: realIndexPath });
}

async function serveStaticWebRequest(
  request: IncomingMessage,
  response: ServerResponse,
  webRoot: StaticWebRoot,
): Promise<void> {
  const decodedPath = decodeRequestPath(request.url);
  if (decodedPath === null) {
    sendJson(response, 400, { issues: [{ code: "E_INVALID_PATH", severity: "error", stage: "request", message: "Invalid request path", retryable: false }] });
    return;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const candidatePath = path.resolve(webRoot.path, relativePath);
  if (!isInsideRoot(webRoot.path, candidatePath)) {
    sendJson(response, 400, { issues: [{ code: "E_INVALID_PATH", severity: "error", stage: "request", message: "Invalid request path", retryable: false }] });
    return;
  }

  const exactFile = await resolveStaticFile(candidatePath, webRoot.path);
  const filePath = exactFile ?? (acceptsHtml(request) ? webRoot.indexPath : null);
  if (filePath === null) {
    sendJson(response, 404, { issues: [{ code: "E_STATIC_NOT_FOUND", severity: "error", stage: "request", message: "Static resource not found", retryable: false }] });
    return;
  }

  const fileStats = await stat(filePath);
  const isHtml = path.extname(filePath).toLowerCase() === ".html";
  const headers: Record<string, string | number> = {
    "content-type": contentTypeFor(filePath),
    "content-length": fileStats.size,
    "cache-control": cacheControlFor(decodedPath, isHtml),
    "content-security-policy": "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  await pipeline(createReadStream(filePath), response);
}

function decodeRequestPath(requestUrl: string | undefined): string | null {
  const rawPath = (requestUrl ?? "/").split(/[?#]/u, 1)[0] ?? "/";
  if (!rawPath.startsWith("/")) return null;
  try {
    const decoded = decodeURIComponent(rawPath);
    if (decoded.includes("\0") || decoded.includes("\\")) return null;
    if (decoded.split("/").some((segment) => segment === "." || segment === "..")) return null;
    return decoded;
  } catch {
    return null;
  }
}

async function resolveStaticFile(candidatePath: string, webRoot: string): Promise<string | null> {
  try {
    const candidateStats = await stat(candidatePath);
    if (!candidateStats.isFile()) return null;
    const realCandidate = await realpath(candidatePath);
    return isInsideRoot(webRoot, realCandidate) ? realCandidate : null;
  } catch (error) {
    if (isMissingPathError(error)) return null;
    throw error;
  }
}

function isInsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

function isApiPath(pathname: string): boolean {
  return pathname === "/health" || pathname === "/v1" || pathname.startsWith("/v1/");
}

function acceptsHtml(request: IncomingMessage): boolean {
  const accept = request.headers.accept ?? "";
  return accept.split(",").some((value) => {
    const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
    return mediaType === "text/html" || mediaType === "application/xhtml+xml";
  });
}

function cacheControlFor(requestPath: string, isHtml: boolean): string {
  if (isHtml) return "no-cache";
  return requestPath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
}

function contentTypeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  } as Record<string, string>)[extension] ?? "application/octet-stream";
}

async function readJsonBody(request: IncomingMessage): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_048_576) return { ok: false, message: "Request body exceeds 1 MiB" };
    chunks.push(buffer);
  }
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
  } catch {
    return { ok: false, message: "Request body is not valid JSON" };
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) return;
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  response.end(payload);
}
