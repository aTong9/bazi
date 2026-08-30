import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { analyzeProfile } from "../../packages/application/src/analyze-profile.js";
import { analyzeM0 } from "../../packages/application/src/analyze-m0.js";
import { openCatalogSnapshot } from "../../packages/catalog/src/open-catalog-snapshot.js";
import { openBrowserCatalogPack, toAnalyzeM0Command, toAnalyzeProfileCommand } from "../../apps/web/src/browser-runtime.js";

const root = path.resolve(".");
const packPath = path.join(root, "apps/web/public/browser-catalog.json");
const dist = path.join(root, "apps/web/dist");

test("browser catalog retains the complete deterministic runtime", async () => {
  const raw = await readFile(packPath, "utf8");
  const value = JSON.parse(raw) as { manifest: { rulesetDigest: string }; diagnostics: { loadedRecords: number; compiledRecords: number } };
  const catalog = await openBrowserCatalogPack(value);
  assert.equal(catalog.diagnostics.loadedRecords, 10_918);
  assert.equal(catalog.diagnostics.compiledRecords, 10_873);
  assert.equal(catalog.getOutputContracts().length, 45);
  assert.equal(catalog.manifest.rulesetDigest, value.manifest.rulesetDigest);
  assert.ok((await stat(packPath)).size < 2_000_000);
});

test("browser and SQLite runtimes return the same business result", async () => {
  const value = JSON.parse(await readFile(packPath, "utf8")) as { manifest: { rulesetDigest: string } };
  const browserCatalog = await openBrowserCatalogPack(value);
  const sqliteCatalog = openCatalogSnapshot(path.join(root, "rulesets", value.manifest.rulesetDigest));
  try {
    for (const payload of [basePayload(), evaluatedPayload(), safetyStopPayload()]) {
      const endpoint = "reality_gates" in payload ? "/v1/relationship/evaluate" as const : "/v1/relationship/profile" as const;
      const parsed = toAnalyzeProfileCommand(endpoint, payload);
      assert.equal(parsed.ok, true);
      if (!("command" in parsed)) throw new Error("request unexpectedly failed to parse");
      const browserResult = analyzeProfile(parsed.command, browserCatalog);
      const sqliteResult = analyzeProfile(parsed.command, sqliteCatalog);
      assert.deepEqual(withoutRunIdentity(browserResult), withoutRunIdentity(sqliteResult));
    }
    const invalid = evaluatedPayload();
    invalid.observations[1] = { ...invalid.observations[1]!, id: invalid.observations[0]!.id };
    const rejected = toAnalyzeProfileCommand("/v1/relationship/evaluate", invalid);
    assert.equal(rejected.ok, false);
    if (rejected.ok) throw new Error("duplicate observations unexpectedly parsed");
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.issues[0]?.message ?? "", /duplicate ids/u);
  } finally {
    sqliteCatalog.close();
  }
});

test("standalone M0 uses the same browser and SQLite rule snapshot", async () => {
  const value = JSON.parse(await readFile(packPath, "utf8")) as { manifest: { rulesetDigest: string } };
  const browserCatalog = await openBrowserCatalogPack(value);
  const sqliteCatalog = openCatalogSnapshot(path.join(root, "rulesets", value.manifest.rulesetDigest));
  try {
    const { role_basis: _roleBasis, ...payload } = basePayload();
    payload.requested_sections = ["m0"];
    const parsed = toAnalyzeM0Command(payload);
    assert.equal(parsed.ok, true);
    if (!("command" in parsed)) throw new Error("M0 request unexpectedly failed to parse");
    assert.deepEqual(withoutRunIdentity(analyzeM0(parsed.command, browserCatalog)), withoutRunIdentity(analyzeM0(parsed.command, sqliteCatalog)));
  } finally {
    sqliteCatalog.close();
  }
});

test("Pages artifact has a base-path SPA fallback and no Node external stubs", async () => {
  const [index, fallback, catalogInfo] = await Promise.all([
    readFile(path.join(dist, "index.html"), "utf8"),
    readFile(path.join(dist, "404.html"), "utf8"),
    stat(path.join(dist, "browser-catalog.json")),
  ]);
  assert.equal(fallback, index);
  assert.match(index, /\/bazi\/assets\//u);
  assert.match(index, /http-equiv="Content-Security-Policy"/u);
  assert.match(index, /script-src 'self'; style-src 'self'; worker-src 'self'/u);
  assert.match(index, /name="referrer" content="strict-origin-when-cross-origin"/u);
  assert.ok(catalogInfo.size < 2_000_000);
  await stat(path.join(dist, ".nojekyll"));
  const scripts = [...index.matchAll(/src="([^"]+\.js)"/gu)].map((match) => path.join(dist, match[1]!.replace(/^\/bazi\//u, "")));
  assert.ok(scripts.length > 0);
  for (const script of scripts) {
    const source = await readFile(script, "utf8");
    assert.doesNotMatch(source, /__vite-browser-external|node:(?:fs|crypto|url)/u);
  }
});

test("Pages artifact precaches one complete, versioned offline runtime", async () => {
  const [manifestSource, worker] = await Promise.all([
    readFile(path.join(dist, "manifest.webmanifest"), "utf8"),
    readFile(path.join(dist, "sw.js"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource) as { start_url: string; scope: string; display: string };
  assert.equal(manifest.start_url, "/bazi/");
  assert.equal(manifest.scope, "/bazi/");
  assert.equal(manifest.display, "standalone");
  assert.match(worker, /bazi-pages-[a-f0-9]{16}/u);
  assert.match(worker, /\/bazi\/browser-catalog\.json/u);
  assert.match(worker, /\/bazi\/index\.html/u);
  assert.match(worker, /cache\.addAll\(PRECACHE_URLS\)/u);
  assert.match(worker, /caches\.delete/u);
  assert.match(worker, /event\.request\.mode === "navigate"/u);
});

test("Pages artifact keeps the printable reading contract", async () => {
  const index = await readFile(path.join(dist, "index.html"), "utf8");
  const stylesheets = [...index.matchAll(/href="([^"]+\.css)"/gu)]
    .map((match) => path.join(dist, match[1]!.replace(/^\/bazi\//u, "")));
  assert.ok(stylesheets.length > 0);
  const source = (await Promise.all(stylesheets.map((stylesheet) => readFile(stylesheet, "utf8")))).join("\n");
  assert.match(source, /@media print/u);
  assert.match(source, /关系脉络 · 八字情感看盘报告/u);
  assert.match(source, /\.input-panel/u);
  assert.match(source, /\.result-tools/u);
  assert.match(source, /\.analysis-result:before/u);
});

function basePayload() {
  return {
    analysis_mode: "production",
    role_basis: "female_traditional",
    subject: {
      input_mode: "four_pillars_provided",
      subject_id: "PAGES-PARITY",
      four_pillars: {
        year: { stem: "庚", branch: "申" }, month: { stem: "己", branch: "丑" },
        day: { stem: "甲", branch: "寅" }, hour: { stem: "庚", branch: "午" },
      },
      birth_time_status: "exact", timezone: "Asia/Shanghai", data_quality: "high",
    },
    requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"],
  };
}

function evaluatedPayload() {
  const states = ["steady", "pressure", "repair", "turningPoint", "counterevidenceReviewed"] as const;
  return {
    ...basePayload(),
    observations: [
      { id: "pages-o1", chainId: "M4-C01", source: "self", context: "steady", direction: "supports" },
      { id: "pages-o2", chainId: "M4-C01", source: "partner", context: "pressure", direction: "supports" },
    ],
    reality_gates: ["RG01", "RG02", "RG03", "RG04", "RG05", "RG06", "RG07", "RG08"].map((id) => ({
      id, status: "pass", note: `observed ${id}`, evidenceIds: [`pages-${id}`],
    })),
    cross_state_validation: Object.fromEntries(states.map((state) => [state, true])),
    cross_state_evidence: states.map((state) => ({ state, note: `observed ${state}`, evidenceIds: [`pages-${state}`] })),
  };
}

function safetyStopPayload() {
  const value = evaluatedPayload();
  return { ...value, reality_gates: value.reality_gates.map((gate) => gate.id === "RG01" ? { ...gate, status: "fail" } : gate) };
}

function withoutRunIdentity(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutRunIdentity);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !["requestId", "generatedAt", "analysisRunId", "decisionId"].includes(key))
    .map(([key, item]) => [key, withoutRunIdentity(item)]));
}
