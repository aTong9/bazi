import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
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
