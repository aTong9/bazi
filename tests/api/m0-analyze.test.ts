import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createApiServer } from "../../apps/api/src/server.js";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { validateM0AnalyzeResponse } from "../../packages/contracts/src/m0-analyze-contract.js";

test("POST /v1/m0/analyze returns all 45 M19 fields and rejects exact input without hour", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "bazi-api-rulesets-"));
  const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot });
  const server = createApiServer({ snapshotPath: built.snapshotPath });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const valid = await post(port, requestBody({ stem: "壬", branch: "午" }, "exact"));
    assert.equal(valid.status, 200);
    const body = await valid.json() as { m0: { status: string; fields: Record<string, unknown> }; ruleTrace: string[] };
    assert.equal(body.m0.status, "complete");
    assert.equal(Object.keys(body.m0.fields).length, 45);
    assert.ok(body.ruleTrace.length > 0);
    assert.deepEqual(validateM0AnalyzeResponse(body), []);

    const repeated = await post(port, requestBody({ stem: "壬", branch: "午" }, "exact"));
    assert.equal(repeated.status, 200);
    assert.deepEqual(stableResponse(await repeated.json()), stableResponse(body));

    const unknown = await post(port, requestBody(null, "unknown"));
    assert.equal(unknown.status, 200);
    const unknownBody = await unknown.json() as {
      m0: { fields: Record<string, unknown>; dependencyFlags: string[]; modules: { "M0.M02": { pillars: { hour: unknown } } } };
    };
    assert.equal(Object.keys(unknownBody.m0.fields).length, 45);
    assert.ok(unknownBody.m0.dependencyFlags.includes("HOUR_UNKNOWN"));
    assert.equal(unknownBody.m0.modules["M0.M02"].pillars.hour, null);
    assert.deepEqual(validateM0AnalyzeResponse(unknownBody), []);

    const approximate = await post(port, requestBody({ stem: "壬", branch: "午" }, "approximate"));
    assert.equal(approximate.status, 200);
    const approximateBody = await approximate.json() as { m0: { status: string; dependencyFlags: string[] } };
    assert.equal(approximateBody.m0.status, "limited");
    assert.deepEqual(approximateBody.m0.dependencyFlags, ["HOUR_APPROXIMATE"]);

    const lowQualityInput = requestBody({ stem: "壬", branch: "午" }, "exact") as { subject: { data_quality: string } };
    lowQualityInput.subject.data_quality = "low";
    const lowQuality = await post(port, lowQualityInput);
    const lowQualityBody = await lowQuality.json() as { m0: { status: string; dependencyFlags: string[] } };
    assert.equal(lowQualityBody.m0.status, "limited");
    assert.deepEqual(lowQualityBody.m0.dependencyFlags, ["DATA_QUALITY_LOW"]);

    const missingTimezone = requestBody({ stem: "壬", branch: "午" }, "exact") as { subject: { timezone?: string } };
    delete missingTimezone.subject.timezone;
    const missingTimezoneResponse = await post(port, missingTimezone);
    assert.equal(missingTimezoneResponse.status, 400);
    const missingTimezoneBody = await missingTimezoneResponse.json() as { issues: Array<{ code: string; message: string }> };
    assert.equal(missingTimezoneBody.issues[0]?.code, "E_REQUEST_SCHEMA");
    assert.match(missingTimezoneBody.issues[0]?.message ?? "", /timezone/u);

    const invalid = await post(port, requestBody(null, "exact"));
    assert.equal(invalid.status, 422);
    const invalidBody = await invalid.json() as { issues: Array<{ code: string }> };
    assert.equal(invalidBody.issues[0]?.code, "E_EXACT_HOUR_REQUIRED");

    const dynamic = requestBody({ stem: "壬", branch: "午" }, "exact") as { requested_sections: string[] };
    dynamic.requested_sections = ["m0", "dynamic_timing"];
    const dynamicResponse = await post(port, dynamic);
    assert.equal(dynamicResponse.status, 422);
    const dynamicBody = await dynamicResponse.json() as { issues: Array<{ code: string }> };
    assert.equal(dynamicBody.issues[0]?.code, "E_DYNAMIC_MODEL_REQUIRED");

    const wrongContentType = await fetch(`http://127.0.0.1:${port}/v1/m0/analyze`, { method: "POST", body: "{}" });
    assert.equal(wrongContentType.status, 415);
    assert.equal((await issueCode(wrongContentType)), "E_CONTENT_TYPE");

    const malformed = await fetch(`http://127.0.0.1:${port}/v1/m0/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await issueCode(malformed)), "E_JSON");

    const oversized = await post(port, { value: "x".repeat(1_048_576) });
    assert.equal(oversized.status, 413);
    assert.equal((await issueCode(oversized)), "E_PAYLOAD_TOO_LARGE");

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json() as { status: string; catalog: { compiledRecords: number } };
    assert.equal(healthBody.status, "ready");
    assert.equal(healthBody.catalog.compiledRecords, 10_873);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(outputRoot, { recursive: true, force: true });
  }
});

function requestBody(hour: { stem: string; branch: string } | null, birthTimeStatus: string): unknown {
  return {
    analysis_mode: "test",
    subject: {
      input_mode: "four_pillars_provided",
      subject_id: "A",
      four_pillars: {
        year: { stem: "甲", branch: "子" },
        month: { stem: "丙", branch: "寅" },
        day: { stem: "庚", branch: "午" },
        hour,
      },
      birth_time_status: birthTimeStatus,
      timezone: "Asia/Shanghai",
      data_quality: "high",
    },
    requested_sections: ["m0"],
  };
}

function stableResponse(value: unknown): unknown {
  const copy = structuredClone(value) as Record<string, unknown>;
  delete copy.requestId;
  delete copy.generatedAt;
  return copy;
}

async function post(port: number, body: unknown): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/v1/m0/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function issueCode(response: Response): Promise<string | undefined> {
  return ((await response.json()) as { issues: Array<{ code: string }> }).issues[0]?.code;
}
