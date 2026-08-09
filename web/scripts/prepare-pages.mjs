import { existsSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import path from "node:path";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserSite = repositoryName.endsWith(".github.io");

if (!repositoryName || isUserSite) process.exit(0);

const clientRoot = path.resolve("dist/client");
const nestedBase = path.join(clientRoot, repositoryName);
const nestedAssets = path.join(nestedBase, "_next");
const targetAssets = path.join(clientRoot, "_next");

if (!existsSync(nestedAssets)) {
  throw new Error(`Expected vinext Pages assets at ${nestedAssets}`);
}
if (existsSync(targetAssets)) {
  throw new Error(`Refusing to overwrite existing Pages assets at ${targetAssets}`);
}

// GitHub Pages already maps /<repository>/ to the uploaded artifact root.
// vinext's assetPrefix also nests files below <repository>, so flatten only that
// generated asset directory to avoid /<repository>/<repository>/_next at runtime.
await rename(nestedAssets, targetAssets);
await rm(nestedBase, { recursive: true, force: true });
