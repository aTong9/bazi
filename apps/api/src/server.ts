import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { analyzeM0 } from "../../../packages/application/src/analyze-m0.js";
import { analyzeProfile } from "../../../packages/application/src/analyze-profile.js";
import { openCatalogSnapshot } from "../../../packages/catalog/src/open-catalog-snapshot.js";
import { parseM0AnalyzeRequest } from "../../../packages/contracts/src/m0-analyze-contract.js";
import { parseProfileAnalyzeRequest } from "../../../packages/contracts/src/profile-analyze-contract.js";

export function createApiServer(options: { snapshotPath: string }): Server {
  const catalog = openCatalogSnapshot(options.snapshotPath);
  const server = createServer(async (request, response) => {
    try {
      await route(request, response, catalog);
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
      ? { ...parsed.command, relationshipMode: "specific_partner_with_reality_data" as const, ...(parsed.observations ? { observations: parsed.observations } : {}), ...(parsed.gateAssessments ? { gateAssessments: parsed.gateAssessments } : {}), ...(parsed.crossStateValidation ? { crossStateValidation: parsed.crossStateValidation } : {}) }
      : { ...parsed.command, relationshipMode: "single_chart_relationship_profile" as const };
    const result = analyzeProfile(command, catalog);
    if (!result.ok) sendJson(response, result.httpStatus, { issues: result.issues });
    else sendJson(response, 200, result.response);
    return;
  }
  sendJson(response, 404, { issues: [{ code: "E_ROUTE_NOT_FOUND", severity: "error", stage: "request", message: "Route not found", retryable: false }] });
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
