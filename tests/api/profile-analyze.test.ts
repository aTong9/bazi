import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createApiServer } from "../../apps/api/src/server.js";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";

test("POST /v1/profile/analyze executes M0-M3 and preserves explicit role-basis dependency", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bazi-profile-")); const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot: root });
  const server = createApiServer({ snapshotPath: built.snapshotPath }); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const port = (server.address() as AddressInfo).port;
  try {
    const explicit = await post(port, body("female_traditional")); assert.equal(explicit.status, 200);
    const result = await explicit.json() as { relationship: { status: string; m1: { prototypes: unknown[] }; m2: { tempo: { calendarDuration: unknown } }; m3: { dependencyFlags: string[] } } };
    assert.equal(result.relationship.status, "provisional"); assert.ok(result.relationship.m1.prototypes.length > 0); assert.equal(result.relationship.m2.tempo.calendarDuration, null); assert.deepEqual(result.relationship.m3.dependencyFlags, []);
    const unspecified = await post(port, body("unspecified")); assert.equal(unspecified.status, 200);
    const pending = await unspecified.json() as { relationship: { status: string; dependencyFlags: string[] } };
    assert.equal(pending.relationship.status, "dependency_pending"); assert.ok(pending.relationship.dependencyFlags.includes("M1_TRADITIONAL_ROLE_BASIS_REQUIRED"));
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await rm(root, { recursive: true, force: true }); }
});
test("canonical relationship routes expose a bounded profile and safety-stop evaluation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bazi-relationship-")); const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot: root });
  const server = createApiServer({ snapshotPath: built.snapshotPath }); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const port = (server.address() as AddressInfo).port;
  try {
    const profile = await fetch(`http://127.0.0.1:${port}/v1/relationship/profile`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body("female_traditional"), requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"] }) });
    assert.equal(profile.status, 200);
    const profileJson = await profile.json() as { relationship: { m5: { fit: { grade: string }; partnerFacts: unknown; realityGates: unknown[] } } };
    assert.equal(profileJson.relationship.m5.fit.grade, "FG1"); assert.equal(profileJson.relationship.m5.partnerFacts, null); assert.equal(profileJson.relationship.m5.realityGates.length, 8);
    const evaluation = await fetch(`http://127.0.0.1:${port}/v1/relationship/evaluate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body("female_traditional"), requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"], reality_gates: [{ id: "RG01", status: "fail", evidenceIds: ["incident-1"], note: "safety failure" }] }) });
    assert.equal(evaluation.status, 200);
    const evaluationJson = await evaluation.json() as { relationship: { m5: { reportStatus: string; fit: { grade: string; assessment: string; ordinaryFindings: unknown[] } } } };
    assert.equal(evaluationJson.relationship.m5.reportStatus, "stop"); assert.equal(evaluationJson.relationship.m5.fit.grade, "FG0"); assert.equal(evaluationJson.relationship.m5.fit.assessment, "AF09"); assert.deepEqual(evaluationJson.relationship.m5.fit.ordinaryFindings, []);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await rm(root, { recursive: true, force: true }); }
});
function body(role_basis: string) { return { analysis_mode: "test", role_basis, subject: { input_mode: "four_pillars_provided", subject_id: "P", four_pillars: { year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } }, birth_time_status: "exact", timezone: "Asia/Shanghai", data_quality: "high", synthetic_fixture: true }, requested_sections: ["m0", "m1", "m2", "m3"] }; }
function post(port: number, payload: unknown) { return fetch(`http://127.0.0.1:${port}/v1/profile/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); }
