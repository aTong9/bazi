#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputIndex = process.argv.indexOf("--input");
const input = resolve(root, inputIndex >= 0 ? process.argv[inputIndex + 1] : "xiaohongshu/analytics/performance-snapshot-2026-08-09.json");
const { importXiaohongshuPerformanceRows, rankContentTopics } = await import(resolve(root, "dist/src/index.js"));
const snapshot = JSON.parse(await readFile(input, "utf8"));
if (snapshot.schemaVersion !== "xiaohongshu-performance-rows-v1" || !Array.isArray(snapshot.rows)) throw new TypeError("Unsupported content performance snapshot");
const ranked = rankContentTopics(importXiaohongshuPerformanceRows(snapshot.rows));
process.stdout.write(`${JSON.stringify({ analyticsVersion: ranked[0]?.analyticsVersion ?? "xiaohongshu-topic-score-v1", source: snapshot.source, ranked: ranked.map(item => ({ title: item.title, score: Number(item.topicScore.toFixed(2)), components: Object.fromEntries(Object.entries(item.components).map(([key, value]) => [key, Number(value.toFixed(2))])) })) }, null, 2)}\n`);
