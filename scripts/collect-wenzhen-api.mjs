#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Temporal } from "@js-temporal/polyfill";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_FILE = resolve(ROOT, "review/wenzhen-observations.json");
const EVIDENCE_DIR = resolve(ROOT, "review/api-evidence");
const ENDPOINT = "https://bzapi4.iwzbz.com/getbasebz8.php";

async function atomicJson(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

function pillarsFromResponse(response) {
  return [0, 1, 2, 3, 4, 5, 6, 7].map(index => response.bz?.[String(index)] ?? response.bz?.[index]).join("");
}

function spacedPillars(value) {
  return value.match(/.{2}/gu)?.join(" ") ?? value;
}

function samePrefix(actual, expected) {
  return expected.every((value, index) => actual[index] === value);
}

function qiyunStart(selectedTime, qiyunarr) {
  if (!Array.isArray(qiyunarr) || qiyunarr.length < 5) return null;
  return Temporal.PlainDateTime.from(selectedTime).add({ years: qiyunarr[0], months: qiyunarr[1], days: qiyunarr[2], hours: qiyunarr[3], minutes: qiyunarr[4] }).toString();
}

function differenceMinutes(left, right) {
  return Math.abs(Temporal.PlainDateTime.from(left).until(Temporal.PlainDateTime.from(right), { largestUnit: "minutes" }).total({ unit: "minutes" }));
}

async function collect(limit, scope) {
  const review = JSON.parse(await readFile(REVIEW_FILE, "utf8"));
  const refresh = process.argv.includes("--refresh");
  const pending = review.cases.filter(item => (refresh || !item.wenzhenObserved) && (scope === "all" || (scope === "boundary") === item.boundary)).slice(0, limit);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  let matched = 0;

  for (const item of pending) {
    const url = new URL(ENDPOINT);
    // The website submits whole seconds. Fractional seconds are accepted by the
    // endpoint for pillars but corrupt its qiyun array, so mirror the UI format.
    url.searchParams.set("d", item.localEngineOutput.selectedTime.replace("T", " ").slice(0, 19));
    url.searchParams.set("s", item.input.gender === "male" ? "1" : "0");
    url.searchParams.set("today", new Date().toISOString().slice(0, 16).replace("T", " "));
    // Wenzhen yzs=0 means unified Zi hour (23:00 changes day); yzs=1 means
    // early/late Zi hour (the 23:00 segment retains the civil calendar day).
    url.searchParams.set("yzs", item.settings.dayBoundary === "zi_initial_23" ? "0" : "1");
    url.searchParams.set("vip", "0");
    url.searchParams.set("userguid", "");

    const response = await fetch(url, { headers: { Accept: "application/json", Referer: "https://pcbz.iwzwh.com/" } });
    if (!response.ok) throw new Error(`${item.caseId}: Wenzhen API HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.bz || !Array.isArray(payload.dayun)) throw new Error(`${item.caseId}: unexpected Wenzhen response`);

    const evidenceRelative = `review/api-evidence/${item.caseId}.json`;
    await atomicJson(resolve(ROOT, evidenceRelative), { capturedAt: new Date().toISOString(), endpoint: ENDPOINT, syntheticInput: item.input, settings: item.settings, response: payload });
    const fourPillars = spacedPillars(pillarsFromResponse(payload));
    const fourPillarsMatch = fourPillars === item.localEngineOutput.fourPillars;
    const dayunMatch = samePrefix(payload.dayun, item.localEngineOutput.dayun);
    const observedQiyunStart = qiyunStart(item.localEngineOutput.selectedTime, payload.qiyunarr);
    const qiyunDifferenceMinutes = observedQiyunStart ? differenceMinutes(observedQiyunStart, item.localEngineOutput.qiyunStartsAt.replace(" ", "T")) : Number.POSITIVE_INFINITY;
    // 20 qiyun-minutes correspond to 10 seconds at the real Jie boundary.
    // Treat that as ephemeris precision compatibility while preserving the
    // exact difference for audit; larger differences remain mismatches.
    const qiyunMatch = qiyunDifferenceMinutes <= 20;
    const isMatch = fourPillarsMatch && dayunMatch && qiyunMatch;
    item.wenzhenObserved = {
      adjustedTime: item.localEngineOutput.selectedTime,
      fourPillars,
      qiyunAge: JSON.stringify({ qiyunsui: payload.qiyunsui, qiyunarr: payload.qiyunarr, jiaoyun: payload.jiaoyun }),
      dayun: payload.dayun.slice(0, item.localEngineOutput.dayun.length),
      screenshotReference: "",
      apiEvidenceReference: evidenceRelative,
      evidenceSource: "public_api",
      qiyunStartsAt: observedQiyunStart,
      qiyunDifferenceMinutes,
      fourPillarsMatch,
      dayunMatch,
      qiyunMatch,
    };
    item.match = isMatch;
    item.differenceReason = isMatch ? "" : item.caseId.startsWith("jie-") && !fourPillarsMatch
      ? "外部交节时刻口径差异：问真在该观测时刻已换节，本地固定 ephemeris 尚未换节；保留差异，不按日期硬编码修补。"
      : !qiyunMatch && fourPillarsMatch && dayunMatch
        ? `起运折算口径差异：问真与本地交运时刻相差 ${qiyunDifferenceMinutes.toFixed(2)} 分钟。`
        : "问真公开排盘接口与本地四柱、大运或起运结果不一致，待人工复核设置。";
    if (isMatch) matched += 1;
    await atomicJson(REVIEW_FILE, review);
    process.stdout.write(`${item.caseId}: ${isMatch ? "MATCH" : "DIFFERENCE"} ${fourPillars}\n`);
  }
  process.stdout.write(`Collected ${pending.length}; matched ${matched}. Raw evidence: review/api-evidence/\n`);
}

const limitIndex = process.argv.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : 30;
const scopeIndex = process.argv.indexOf("--scope");
const scope = scopeIndex >= 0 ? process.argv[scopeIndex + 1] : "all";
if (!Number.isInteger(limit) || limit < 1 || limit > 150) throw new RangeError("--limit must be an integer from 1 to 150");
if (!["all", "ordinary", "boundary"].includes(scope)) throw new RangeError("--scope must be all, ordinary, or boundary");
await collect(limit, scope);
