import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { getPCA } from "lcn";

const clientRoot = new URL("../dist/client/", import.meta.url);

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }))).flat();
}

test("static export contains the complete local workbench", async () => {
  const html = await readFile(new URL("index.html", clientRoot), "utf8");
  assert.match(html, /见字/);
  assert.match(html, /建立命盘/);
  assert.match(html, /四柱关系实验室/);
  assert.match(html, /准确到分钟/);
  assert.match(html, /排盘口径/);
  assert.match(html, /真太阳时（推荐）/);
  assert.match(html, /零点换日（推荐）/);
  assert.match(html, /class="time-control"/);
  assert.match(html, /class="basis-options"/);
  assert.match(html, /中国标准时间（UTC\+8）/);
  assert.doesNotMatch(html, />Asia\/Shanghai</);
  assert.match(html, /排盘和文案均在当前浏览器本地完成/);
  assert.doesNotMatch(html, /react-loading-skeleton|Your site is taking shape/);
});

test("every rendered CSS and JavaScript URL maps to an uploaded artifact file", async () => {
  const html = await readFile(new URL("index.html", clientRoot), "utf8");
  const pagesBasePath = process.env.GITHUB_PAGES === "true" && process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}`
    : "";
  const assetUrls = [...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js))"/g)].map(match => match[1]);
  assert.ok(assetUrls.length > 0);
  for (const assetUrl of assetUrls) {
    const artifactPath = pagesBasePath && assetUrl.startsWith(`${pagesBasePath}/`)
      ? assetUrl.slice(pagesBasePath.length + 1)
      : assetUrl.replace(/^\//, "");
    const file = new URL(artifactPath, clientRoot);
    await assert.doesNotReject(() => readFile(file), `${assetUrl} must resolve inside the Pages artifact`);
  }
});

test("client artifact has local datasets and no removed API dependency", async () => {
  const files = await filesBelow(clientRoot.pathname);
  const scripts = files.filter(file => file.endsWith(".js"));
  assert.ok(scripts.length > 0);
  const bundle = (await Promise.all(scripts.map(file => readFile(file, "utf8")))).join("\n");
  assert.match(bundle, /黄浦区/);
  assert.match(bundle, /local-narrative-v1/);
  assert.match(bundle, /browser-local/);
  assert.doesNotMatch(bundle, /\/api\/(chart|places|narrative)/);
  assert.doesNotMatch(bundle, /api\.openai\.com|nominatim\.openstreetmap\.org/);
});

test("every bundled domestic district has a finite local coordinate", async () => {
  const coordinates = JSON.parse(await readFile(new URL("../app/data/china-district-coordinates.json", import.meta.url), "utf8"));
  const provinces = getPCA({ inland: true });
  const districts = provinces.flatMap(province => province.children ?? []).flatMap(city => city.children ?? []);
  assert.equal(provinces.length, 31);
  assert.equal(districts.length, 2849);
  assert.equal(Object.keys(coordinates).length, districts.length);
  for (const district of districts) {
    const coordinate = coordinates[district.code];
    assert.ok(coordinate, `missing coordinate for ${district.name} (${district.code})`);
    assert.ok(Number.isFinite(coordinate[0]) && coordinate[0] >= -90 && coordinate[0] <= 90);
    assert.ok(Number.isFinite(coordinate[1]) && coordinate[1] >= -180 && coordinate[1] <= 180);
    assert.match(coordinate[2], /^(district|city)$/);
  }
});
