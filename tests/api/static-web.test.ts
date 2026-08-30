import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { request, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createApiServer } from "../../apps/api/src/server.js";
import { buildCatalogSnapshot } from "../../packages/catalog/src/build-catalog-snapshot.js";

test("static web hosting is bounded, cache-aware, and never masks API routes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bazi-static-web-"));
  const outputRoot = path.join(root, "rulesets");
  const webRoot = path.join(root, "web");
  const outsideFile = path.join(root, "outside.txt");
  await mkdir(path.join(webRoot, "assets"), { recursive: true });
  await writeFile(path.join(webRoot, "index.html"), "<!doctype html><title>Bazi UI</title><main>relationship workbench</main>", "utf8");
  await writeFile(path.join(webRoot, "assets", "app-a1b2c3d4.js"), "globalThis.__BAZI_UI__ = true;", "utf8");
  await writeFile(outsideFile, "must not be served", "utf8");
  await symlink(outsideFile, path.join(webRoot, "escaped.txt"));
  const built = await buildCatalogSnapshot({ repositoryRoot: path.resolve("."), outputRoot });

  assert.throws(
    () => createApiServer({ snapshotPath: built.snapshotPath, webRoot: path.join(root, "missing-web-root") }),
    /Static web root does not exist/u,
  );

  const server = createApiServer({ snapshotPath: built.snapshotPath, webRoot });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const index = await fetch(`http://127.0.0.1:${port}/`, { headers: { accept: "text/html" } });
    assert.equal(index.status, 200);
    assert.match(await index.text(), /relationship workbench/u);
    assert.equal(index.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(index.headers.get("cache-control"), "no-cache");
    assert.match(index.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/u);
    assert.equal(index.headers.get("x-content-type-options"), "nosniff");

    const deepLink = await fetch(`http://127.0.0.1:${port}/relationship/evaluate`, { headers: { accept: "text/html,application/xhtml+xml" } });
    assert.equal(deepLink.status, 200);
    assert.match(await deepLink.text(), /relationship workbench/u);
    assert.equal(deepLink.headers.get("cache-control"), "no-cache");

    const assetHead = await fetch(`http://127.0.0.1:${port}/assets/app-a1b2c3d4.js`, { method: "HEAD" });
    assert.equal(assetHead.status, 200);
    assert.equal(assetHead.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.equal(assetHead.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(await assetHead.text(), "");
    assert.equal(Number(assetHead.headers.get("content-length")), Buffer.byteLength("globalThis.__BAZI_UI__ = true;"));

    const api404 = await fetch(`http://127.0.0.1:${port}/v1/not-a-route`, { headers: { accept: "text/html" } });
    assert.equal(api404.status, 404);
    assert.match(api404.headers.get("content-type") ?? "", /^application\/json/u);
    const api404Body = await api404.json() as { issues: Array<{ code: string }> };
    assert.equal(api404Body.issues[0]?.code, "E_ROUTE_NOT_FOUND");

    const encodedApi404 = await rawGet(port, "/%76%31/not-a-route", { accept: "text/html" });
    assert.equal(encodedApi404.status, 404);
    assert.match(encodedApi404.body, /E_ROUTE_NOT_FOUND/u);
    assert.doesNotMatch(encodedApi404.body, /relationship workbench/u);

    const missingAsset = await fetch(`http://127.0.0.1:${port}/assets/missing.js`, { headers: { accept: "application/javascript" } });
    assert.equal(missingAsset.status, 404);

    const escapedSymlink = await fetch(`http://127.0.0.1:${port}/escaped.txt`, { headers: { accept: "text/plain" } });
    assert.equal(escapedSymlink.status, 404);
    assert.doesNotMatch(await escapedSymlink.text(), /must not be served/u);

    const traversal = await rawGet(port, "/%2e%2e%2foutside.txt", { accept: "text/plain" });
    assert.equal(traversal.status, 400);
    assert.doesNotMatch(traversal.body, /must not be served/u);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});

function rawGet(port: number, requestPath: string, headers: IncomingHttpHeaders): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const outgoing = request({ hostname: "127.0.0.1", port, method: "GET", path: requestPath, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
}
