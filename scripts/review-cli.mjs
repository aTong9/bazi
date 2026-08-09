#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW = resolve(ROOT, "review");
const FILES = {
  wenzhen: resolve(REVIEW, "wenzhen-observations.json"),
  rules: resolve(REVIEW, "rule-approvals.json"),
  cases: resolve(REVIEW, "anonymous-case-labels.json"),
};

async function core() {
  try { return await import(resolve(ROOT, "dist/src/index.js")); }
  catch { throw new Error("Core build not found. Run `npm run build` first."); }
}

async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
async function exists(path) { try { await readFile(path); return true; } catch { return false; } }
async function atomicJson(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

async function initialize() {
  await mkdir(resolve(REVIEW, "screenshots"), { recursive: true });
  const lib = await core();
  const currentCandidates = lib.createWenzhenCandidates();
  if (!(await exists(FILES.wenzhen))) await atomicJson(FILES.wenzhen, { schemaVersion: "wenzhen-review-v1", metadata: { reviewerId: "", wenzhenVersion: "", settingsNote: "", createdAt: new Date().toISOString() }, cases: currentCandidates });
  else {
    const data = await readJson(FILES.wenzhen);
    const existingById = new Map(data.cases.map(item => [item.caseId, item]));
    data.cases = currentCandidates.map(item => {
      const existing = existingById.get(item.caseId);
      return existing ? { ...item, wenzhenObserved: existing.wenzhenObserved, match: existing.match, differenceReason: existing.differenceReason } : item;
    });
    await atomicJson(FILES.wenzhen, data);
  }
  const currentRuleReviews = lib.RELATIONSHIP_RULES.map(rule => ({ ruleId: rule.id, title: rule.title, topic: rule.topic, sourceStatus: rule.status, source: rule.source, decision: "pending", reviewerId: "", notes: "", reviewedAt: null }));
  if (!(await exists(FILES.rules))) await atomicJson(FILES.rules, { schemaVersion: "rule-review-v1", metadata: { reviewerId: "", createdAt: new Date().toISOString() }, rules: currentRuleReviews });
  else {
    const data = await readJson(FILES.rules);
    const existingById = new Map(data.rules.map(item => [item.ruleId, item]));
    data.rules = currentRuleReviews.map(item => {
      const existing = existingById.get(item.ruleId);
      return existing ? { ...item, decision: existing.decision, reviewerId: existing.reviewerId, notes: existing.notes, reviewedAt: existing.reviewedAt } : item;
    });
    await atomicJson(FILES.rules, data);
  }
  if (!(await exists(FILES.cases))) await atomicJson(FILES.cases, { schemaVersion: "anonymous-case-review-v1", metadata: { reviewerId: "", createdAt: new Date().toISOString() }, cases: [] });
  output.write("Review workspace initialized. Existing answers were preserved.\n");
}

function session() { return createInterface({ input, output }); }
async function required(rl, prompt) { let value = ""; while (!value.trim()) value = await rl.question(prompt); return value.trim(); }
async function setup() {
  await initialize();
  const rl = session();
  const reviewerId = await required(rl, "审核人标识（姓名或稳定代号）：");
  const wenzhenVersion = await required(rl, "问真版本/观察日期：");
  const settingsNote = await required(rl, "问真排盘设置说明（真太阳时、换日等）：");
  for (const path of Object.values(FILES)) {
    const data = await readJson(path);
    data.metadata = { ...data.metadata, reviewerId, ...(path === FILES.wenzhen ? { wenzhenVersion, settingsNote } : {}), updatedAt: new Date().toISOString() };
    await atomicJson(path, data);
  }
  rl.close();
  output.write("审核元数据已写入三个私有文件。\n");
}

function validPillars(value) { return /^([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]\s+){3}[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(value.trim()); }
async function reviewWenzhen(limit = 10) {
  const data = await readJson(FILES.wenzhen);
  if (!data.metadata.reviewerId) throw new Error("Run setup first.");
  const pending = data.cases.filter(item => !item.wenzhenObserved).slice(0, limit);
  if (!pending.length) { output.write("没有待录入的问真样本。\n"); return; }
  const rl = session();
  for (const item of pending) {
    output.write(`\n[${item.caseId}] ${item.dimension}\n输入：${JSON.stringify(item.input)}\n设置：${JSON.stringify(item.settings)}\n本地：${item.localEngineOutput.fourPillars}\n`);
    let fourPillars = await required(rl, "问真四柱（空格分隔）：");
    while (!validPillars(fourPillars)) fourPillars = await required(rl, "格式无效，请输入四组干支：");
    const adjustedTime = await required(rl, "问真显示的校正时间：");
    const qiyunAge = await required(rl, "问真显示的起运年龄/时间：");
    const dayun = (await required(rl, "前八步大运（逗号分隔）：")).split(/[,，]/).map(value => value.trim()).filter(Boolean);
    const screenshotReference = await required(rl, "截图相对路径（review/screenshots/...）：");
    item.wenzhenObserved = { adjustedTime, fourPillars: fourPillars.replace(/\s+/g, " "), qiyunAge, dayun, screenshotReference };
    const pillarsMatch = item.wenzhenObserved.fourPillars === item.localEngineOutput.fourPillars;
    const dayunMatch = JSON.stringify(dayun) === JSON.stringify(item.localEngineOutput.dayun);
    const allDisplayedFieldsMatch = (await required(rl, "校正时间、四柱、起运和大运是否与本地输出整体一致？[y/n]：")).toLowerCase() === "y";
    item.match = pillarsMatch && dayunMatch && allDisplayedFieldsMatch;
    item.differenceReason = item.match ? "" : await required(rl, "差异原因/待研究配置：");
    await atomicJson(FILES.wenzhen, data);
    output.write(`已保存 ${item.caseId}；匹配=${item.match}\n`);
  }
  rl.close();
  output.write("本批完成；可重复运行继续下一批。\n");
}

async function reviewRules(limit = 10) {
  const data = await readJson(FILES.rules);
  if (!data.metadata.reviewerId) throw new Error("Run setup first.");
  const pending = data.rules.filter(item => item.decision === "pending").slice(0, limit);
  if (!pending.length) { output.write("没有待审核规则。\n"); return; }
  const rl = session();
  for (const item of pending) {
    output.write(`\n${item.ruleId}\n${item.title}\n来源：${item.source.file} / ${item.source.section}\n代码状态：${item.sourceStatus}\n`);
    let decision = await required(rl, "决定 [approved/rejected/research]：");
    while (!["approved", "rejected", "research"].includes(decision)) decision = await required(rl, "请输入 approved、rejected 或 research：");
    if (item.sourceStatus === "review_required" && decision === "approved") { output.write("该规则依赖未冻结算法，不能直接批准；已记为 research。\n"); decision = "research"; }
    const notes = decision === "approved" ? await rl.question("审核备注（可留空）：") : await required(rl, "理由/待研究条件：");
    Object.assign(item, { decision, reviewerId: data.metadata.reviewerId, notes: notes.trim(), reviewedAt: new Date().toISOString() });
    await atomicJson(FILES.rules, data);
  }
  rl.close();
  output.write("本批规则审核已保存。\n");
}

async function addCases() {
  const data = await readJson(FILES.cases);
  if (!data.metadata.reviewerId) throw new Error("Run setup first.");
  const lib = await core();
  const rl = session();
  let again = true;
  while (again) {
    const caseId = await required(rl, "匿名案例 ID：");
    if (data.cases.some(item => item.caseId === caseId)) throw new Error(`Duplicate case ID: ${caseId}`);
    const birthText = await required(rl, "排盘输入 JSON（不得含姓名、电话、详细地址）：");
    const birthInput = JSON.parse(birthText);
    for (const forbidden of ["name", "phone", "email", "address"]) if (Object.hasOwn(birthInput, forbidden)) throw new Error(`Private identity field is forbidden: ${forbidden}`);
    lib.createFourPillarsChart(birthInput);
    const expectedRuleIds = (await required(rl, "人工预期规则 ID（逗号分隔）：")).split(/[,，]/).map(value => value.trim()).filter(Boolean);
    const expectedTopics = (await required(rl, "人工预期主题（逗号分隔）：")).split(/[,，]/).map(value => value.trim()).filter(Boolean);
    const notes = await required(rl, "匿名案例分析备注：");
    data.cases.push({ caseId, analystId: data.metadata.reviewerId, birthInput, expectedRuleIds, expectedTopics, notes, labelledAt: new Date().toISOString() });
    await atomicJson(FILES.cases, data);
    again = (await rl.question("继续添加案例？[y/N] ")).trim().toLowerCase() === "y";
  }
  rl.close();
}

async function validate() {
  const lib = await core();
  const [wenzhen, rules, cases] = await Promise.all([readJson(FILES.wenzhen), readJson(FILES.rules), readJson(FILES.cases)]);
  const compatibility = lib.evaluateWenzhenCandidates(wenzhen.cases);
  const approvedDrafts = rules.rules.filter(item => item.sourceStatus === "approved");
  const ruleComplete = approvedDrafts.length > 0 && approvedDrafts.every(item => item.decision === "approved" && item.reviewerId);
  const researchComplete = rules.rules.filter(item => item.sourceStatus === "review_required").every(item => item.decision === "research" && item.notes);
  const replays = lib.replayHumanCases(cases.cases);
  const metrics = lib.evaluateCaseRuns(cases.cases, replays);
  const result = { compatibility, rules: { total: rules.rules.length, approvedDrafts: approvedDrafts.length, complete: ruleComplete && researchComplete }, cases: metrics, gates: { allWenzhenObserved: compatibility.observed === compatibility.total, externalEvidenceComplete: compatibility.screenshotsPresent + compatibility.apiEvidencePresent === compatibility.total, nonBoundaryTargetMet: compatibility.nonBoundary.observed === compatibility.nonBoundary.total && compatibility.nonBoundary.fourPillarsMatchRate === 1, dayunTargetMet: compatibility.nonBoundary.dayunMatchRate === 1 && compatibility.boundary.unexplainedDifferences === 0, qiyunTargetMet: compatibility.nonBoundary.qiyunMatchRate === 1 && compatibility.boundary.unexplainedDifferences === 0, boundaryDifferencesExplained: compatibility.boundary.observed === compatibility.boundary.total && compatibility.boundary.unexplainedDifferences === 0, rulesReviewed: ruleComplete && researchComplete, minimumAnonymousCases: metrics.caseCount >= 20 } };
  output.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!Object.values(result.gates).every(Boolean)) process.exitCode = 1;
}

const [command = "help", ...args] = process.argv.slice(2);
const limitIndex = args.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 10;
try {
  if (command === "init") await initialize();
  else if (command === "setup") await setup();
  else if (command === "wenzhen") await reviewWenzhen(limit);
  else if (command === "rules") await reviewRules(limit);
  else if (command === "cases") await addCases();
  else if (command === "validate") await validate();
  else output.write("Usage: review-cli.mjs init|setup|wenzhen [--limit N]|rules [--limit N]|cases|validate\n");
} catch (error) {
  output.write(`审核工具错误：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
