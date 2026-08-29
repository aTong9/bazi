import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createApiServer } from "../../apps/api/src/server.js";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";
import { validateRelationshipResponse } from "../../packages/contracts/src/relationship-response-contract.js";

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

    const withCompatibility = body("female_traditional") as ReturnType<typeof body> & { subject_b?: unknown; legacy_payloads?: unknown };
    withCompatibility.subject_b = { ...withCompatibility.subject, subject_id: "P-B" };
    withCompatibility.legacy_payloads = { m5_v0_9: { status: "legacy" } };
    const compatibilityResponse = await post(port, withCompatibility); assert.equal(compatibilityResponse.status, 200);
    const compatibility = await compatibilityResponse.json() as { relationship: { structuralSupplement: { available: boolean; scope: string; replacesRealityEvidence: boolean }; legacyPayloads: { mode: string; payloads: Record<string, unknown> } } };
    assert.equal(compatibility.relationship.structuralSupplement.available, true);
    assert.equal(compatibility.relationship.structuralSupplement.scope, "structural_auxiliary_only");
    assert.equal(compatibility.relationship.structuralSupplement.replacesRealityEvidence, false);
    assert.equal(compatibility.relationship.legacyPayloads.mode, "wrapped_read_only");
    assert.ok(compatibility.relationship.legacyPayloads.payloads.m5_v0_9);

    const missingTimezone = structuredClone(body("female_traditional")) as { subject: { timezone?: string } };
    delete missingTimezone.subject.timezone;
    const invalidTimezone = await post(port, missingTimezone);
    assert.equal(invalidTimezone.status, 400);
    const invalidTimezoneBody = await invalidTimezone.json() as { issues: Array<{ code: string; message: string }> };
    assert.equal(invalidTimezoneBody.issues[0]?.code, "E_REQUEST_SCHEMA");
    assert.match(invalidTimezoneBody.issues[0]?.message ?? "", /timezone/u);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await rm(root, { recursive: true, force: true }); }
});
test("canonical relationship routes expose a bounded profile and safety-stop evaluation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bazi-relationship-")); const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot: root });
  const server = createApiServer({ snapshotPath: built.snapshotPath }); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const port = (server.address() as AddressInfo).port;
  try {
    const profile = await fetch(`http://127.0.0.1:${port}/v1/relationship/profile`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body("female_traditional"), requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"] }) });
    assert.equal(profile.status, 200);
    const profileJson = await profile.json() as { relationship: { m5: { fit: { grade: string }; partnerFacts: unknown; realityGates: unknown[] } }; report: { evidenceGrade: string; boundaries: Array<{ hard: boolean }> } };
    assert.equal(profileJson.relationship.m5.fit.grade, "FG1"); assert.equal(profileJson.relationship.m5.partnerFacts, null); assert.equal(profileJson.relationship.m5.realityGates.length, 8);
    assert.equal(profileJson.report.evidenceGrade, "FG1"); assert.ok(profileJson.report.boundaries.every((item) => item.hard));
    assert.deepEqual(validateRelationshipResponse(profileJson), []);
    const evaluation = await fetch(`http://127.0.0.1:${port}/v1/relationship/evaluate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body("female_traditional"), requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"], reality_gates: [{ id: "RG01", status: "fail", evidenceIds: ["incident-1"], note: "safety failure" }] }) });
    assert.equal(evaluation.status, 200);
    const evaluationJson = await evaluation.json() as { relationship: { m5: { reportStatus: string; fit: { grade: string; assessment: string; ordinaryFindings: unknown[] } } }; report: { sections: Array<{ id: string }> } };
    assert.equal(evaluationJson.relationship.m5.reportStatus, "stop"); assert.equal(evaluationJson.relationship.m5.fit.grade, "FG0"); assert.equal(evaluationJson.relationship.m5.fit.assessment, "AF09"); assert.deepEqual(evaluationJson.relationship.m5.fit.ordinaryFindings, []);
    assert.deepEqual(evaluationJson.report.sections.map((section) => section.id), ["safety"]);

    for (const status of ["pass", "conditional", "fail"]) {
      const unsupportedGate = await evaluate(port, { ...body("female_traditional"), requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"], reality_gates: [{ id: "RG02", status, evidenceIds: [], note: "" }] });
      assert.equal(unsupportedGate.status, 400);
      const unsupportedGateJson = await unsupportedGate.json() as { issues: Array<{ code: string }> };
      assert.equal(unsupportedGateJson.issues[0]?.code, "E_REQUEST_SCHEMA");
    }

    const allGates = (["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"] as const)
      .map((id) => ({ id, status: "pass", evidenceIds: [`event-${id}`], note: `observed ${id}` }));
    const crossStateValidation = { steady: true, pressure: true, repair: true, turningPoint: true, counterevidenceReviewed: true };
    const missingCrossEvidence = await evaluate(port, { ...body("female_traditional"), requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"], reality_gates: allGates, cross_state_validation: crossStateValidation });
    assert.equal(missingCrossEvidence.status, 400);

    const crossStateEvidence = (["steady", "pressure", "repair", "turningPoint", "counterevidenceReviewed"] as const)
      .map((state) => ({ state, note: `observed ${state}`, evidenceIds: [`event-cross-${state}`] }));
    const completeCrossEvidence = await evaluate(port, { ...body("female_traditional"), requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"], reality_gates: allGates, cross_state_validation: crossStateValidation, cross_state_evidence: crossStateEvidence });
    assert.equal(completeCrossEvidence.status, 200);
    const completeJson = await completeCrossEvidence.json() as { relationship: { m5: { fit: { grade: string }; crossStateEvidence: unknown[] } }; report: { trace: { eventIds: string[] } } };
    assert.equal(completeJson.relationship.m5.fit.grade, "FG4");
    assert.equal(completeJson.relationship.m5.crossStateEvidence.length, 5);
    assert.ok(completeJson.report.trace.eventIds.includes("event-cross-steady"));
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await rm(root, { recursive: true, force: true }); }
});
function body(role_basis: string) { return { analysis_mode: "test", role_basis, subject: { input_mode: "four_pillars_provided", subject_id: "P", four_pillars: { year: { stem: "庚", branch: "申" }, month: { stem: "癸", branch: "丑" }, day: { stem: "甲", branch: "寅" }, hour: { stem: "丙", branch: "午" } }, birth_time_status: "exact", timezone: "Asia/Shanghai", data_quality: "high", synthetic_fixture: true }, requested_sections: ["m0", "m1", "m2", "m3"] }; }
function post(port: number, payload: unknown) { return fetch(`http://127.0.0.1:${port}/v1/profile/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); }
function evaluate(port: number, payload: unknown) { return fetch(`http://127.0.0.1:${port}/v1/relationship/evaluate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); }
