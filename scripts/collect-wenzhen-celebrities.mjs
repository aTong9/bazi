#!/usr/bin/env node
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "review/api-evidence/wenzhen-public-celebrities.csv");
const ENDPOINT = "https://bzapi2.iwzbz.com/mingren.php?guid=";

await mkdir(dirname(OUTPUT), { recursive: true });
const response = await fetch(ENDPOINT, {
  headers: { Accept: "text/plain", Referer: "https://pcbz.iwzwh.com/#/celebrity/index" },
});
if (!response.ok) throw new Error(`Wenzhen celebrity API HTTP ${response.status}`);
const source = await response.text();
const rows = source.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
for (const [index, row] of rows.entries()) {
  if (row.split(",").length !== 8) throw new Error(`Unexpected field count at row ${index + 1}`);
}
const temporary = `${OUTPUT}.tmp`;
await writeFile(temporary, `${source.trim()}\n`, { mode: 0o600 });
await rename(temporary, OUTPUT);
process.stdout.write(`Captured ${rows.length} public celebrity rows to ${OUTPUT}\n`);
