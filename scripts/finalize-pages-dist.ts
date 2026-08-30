import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PAGES_BASE = "/bazi/";

export async function finalizePagesDist(distRoot: string): Promise<void> {
  const absoluteRoot = path.resolve(distRoot);
  const indexPath = path.join(absoluteRoot, "index.html");
  const indexHtml = await readFile(indexPath, "utf8");
  if (!indexHtml.includes(PAGES_BASE)) {
    throw new Error(`Pages index does not reference the required ${PAGES_BASE} base`);
  }

  await mkdir(absoluteRoot, { recursive: true });
  await Promise.all([
    copyFile(indexPath, path.join(absoluteRoot, "404.html")),
    writeFile(path.join(absoluteRoot, ".nojekyll"), ""),
  ]);

  const files = (await listFiles(absoluteRoot))
    .filter((file) => file !== ".nojekyll" && file !== "sw.js")
    .sort();
  const digest = createHash("sha256");
  for (const file of files) digest.update(file).update(await readFile(path.join(absoluteRoot, file)));
  await writeFile(path.join(absoluteRoot, "sw.js"), serviceWorker(files, digest.digest("hex").slice(0, 16)));
}

async function listFiles(root: string, directory = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const relative = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(root, relative) : [relative];
  }))).flat();
}

function serviceWorker(files: string[], version: string): string {
  const urls = files.map((file) => `${PAGES_BASE}${file}`).concat(PAGES_BASE);
  return `const CACHE_NAME = "bazi-pages-${version}";\nconst PRECACHE_URLS = ${JSON.stringify(urls)};\n\nself.addEventListener("install", (event) => {\n  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));\n});\n\nself.addEventListener("activate", (event) => {\n  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("bazi-pages-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));\n});\n\nself.addEventListener("fetch", (event) => {\n  const url = new URL(event.request.url);\n  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith("${PAGES_BASE}")) return;\n  if (event.request.mode === "navigate") {\n    event.respondWith(fetch(event.request).catch(() => caches.match("${PAGES_BASE}index.html")));\n    return;\n  }\n  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));\n});\n`;
}

function isDirectExecution(): boolean {
  const entryPath = process.argv[1];
  return Boolean(entryPath && path.resolve(entryPath) === fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
  const distRoot = process.argv[2] ?? path.join(repositoryRoot, "apps/web/dist");
  await finalizePagesDist(distRoot);
  process.stdout.write(`Finalized GitHub Pages output at ${path.resolve(distRoot)}\n`);
}
