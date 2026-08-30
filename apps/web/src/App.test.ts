import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App.vue";
import { ARCHIVE_STORAGE_KEY } from "./archive-store";
import { analysisInputFingerprint } from "./domain";
import { makeAnalysisResponse, makeM0AnalysisResponse } from "./test/analysis-fixture";
import { mountComponent, type MountedComponent } from "./test/mount-component";

const health = { status: "ready", catalog: { rulesetDigest: "digest", loadedRecords: 10, compiledRecords: 10, activeModules: ["M0", "M1", "M2", "M3", "M4", "M5"] } };
let mounted: MountedComponent | null = null;

beforeEach(() => {
  const storage = browserStorage();
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.replaceChildren();
});

describe("App analysis provenance", () => {
  it("runs the standalone M0 mode without relationship inputs or modules", async () => {
    const fetchMock = installBrowserMocks(makeAnalysisResponse());
    mounted = mountComponent(App, {});
    await flushUi();
    const structureMode = mounted.host.querySelector<HTMLInputElement>('input[value="structure"]')!;
    structureMode.checked = true;
    structureMode.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();

    expect(mounted.host.textContent).not.toContain("传统夫妻星计算口径");
    expect(mounted.host.textContent).toContain("仅 M0 原局结构");
    await submit(mounted.host);

    const calls = fetchMock.mock.calls.filter(([input]) => input === "/v1/m0/analyze");
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toMatchObject({ requested_sections: ["m0"] });
    expect(mounted.host.textContent).toContain("原局结构已生成");
    expect(mounted.host.querySelector("#result-m1")).toBeNull();

    findButton(mounted.host, "保存到档案").click();
    await flushUi();
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).toContain('"analysisMode":"structure"');
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).toContain('"id":"archive-m0-');
    expect(findButton(mounted.host, "已保存到档案").disabled).toBe(true);

    findButton(mounted.host, "新建分析").click();
    await flushUi();
    expect(mounted.host.querySelector(".analysis-result")).toBeNull();
    findButton(mounted.host, "看盘档案 1").click();
    await flushUi();
    expect(document.body.textContent).toContain("原局结构");
    findButton(document.body, "打开档案").click();
    await flushUi();
    expect(mounted.host.textContent).toContain("原局结构已生成");
    expect(mounted.host.querySelector<HTMLInputElement>('input[value="structure"]')?.checked).toBe(true);
  });

  it("exports unreadable archive storage before allowing a confirmed reset", async () => {
    installBrowserMocks(makeAnalysisResponse());
    localStorage.setItem(ARCHIVE_STORAGE_KEY, "damaged archive bytes");
    let recoveryBlob: Blob | undefined;
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn((blob: Blob) => { recoveryBlob = blob; return "blob:archive-recovery"; }) },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    mounted = mountComponent(App, {});
    await flushUi();
    const archiveTrigger = findButton(mounted.host, "看盘档案");
    expect(archiveTrigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(archiveTrigger.getAttribute("aria-controls")).toBe("archive-panel");
    expect(archiveTrigger.getAttribute("aria-expanded")).toBe("false");

    findButton(mounted.host, "看盘档案").click();
    await flushUi();
    expect(archiveTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.querySelector("#archive-panel")?.getAttribute("role")).toBe("dialog");
    expect(document.body.textContent).toContain("检测到无法读取的本机档案");
    findButton(document.body, "导出原始存储").click();
    expect(await readBlob(recoveryBlob!)).toBe("damaged archive bytes");
    findButton(document.body, "清除损坏数据").click();
    await flushUi();
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).toBe("damaged archive bytes");
    vi.spyOn(localStorage, "removeItem").mockImplementationOnce(() => { throw new Error("storage denied"); });
    findButton(document.body, "确认清除").click();
    await flushUi();
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).toBe("damaged archive bytes");
    expect(document.body.textContent).toContain("清理失败，原始数据仍保留");
    findButton(document.body, "清除损坏数据").click();
    await flushUi();
    findButton(document.body, "确认清除").click();
    await flushUi();
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).toBeNull();
    expect(document.body.textContent).toContain("损坏的本机档案存储已清除");
  });

  it("blocks analysis while a solar assist record is unresolved", async () => {
    const fetchMock = installBrowserMocks(makeAnalysisResponse());
    mounted = mountComponent(App, {});
    await flushUi();
    findButton(mounted.host, "公历排盘辅助").click();
    await nextTick();
    mounted.host.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushUi();
    expect(mounted.host.textContent).toContain("请先修正分析输入");
    expect(mounted.host.textContent).toContain("请完成公历时间计算，或切换为手动四柱");
    const solarInput = mounted.host.querySelector<HTMLInputElement>("#primary-solar-datetime")!;
    expect(solarInput.getAttribute("aria-invalid")).toBe("true");
    expect(solarInput.getAttribute("aria-describedby")).toBe("primary-birth-input-error");
    expect(mounted.host.querySelector("#primary-birth-input-error")?.textContent).toContain("请完成公历时间计算");
    expect(fetchMock.mock.calls.filter(([input]) => input === "/v1/relationship/profile")).toHaveLength(0);
  });

  it("blocks reanalysis of an archive produced by another calendar adapter version", async () => {
    const fetchMock = installBrowserMocks(makeAnalysisResponse());
    vi.stubGlobal("confirm", vi.fn(() => true));
    mounted = mountComponent(App, {});
    await flushUi();
    await submit(mounted.host);
    findButton(mounted.host, "保存到档案").click();
    await flushUi();

    const envelope = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY)!) as { archives: Array<{ workspace: Record<string, any> }> };
    const workspace = envelope.archives[0]!.workspace;
    workspace.primarySubject.birthInput = {
      method: "solar_utc8_assist", solarLocalDateTime: "1986-05-29T12:00", resolutionStatus: "resolved",
      resolvedPillars: "庚申 己丑 甲寅 庚午",
      adapter: { id: "lunar-typescript-standard-time", version: "0.9.0", civilTimeBasis: "UTC+08:00", trueSolarTimeApplied: false },
    };
    workspace.resultInputFingerprint = analysisInputFingerprint(workspace as never);
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(envelope));
    window.dispatchEvent(new StorageEvent("storage", { key: ARCHIVE_STORAGE_KEY }));
    await flushUi();

    findButton(mounted.host, "新建分析").click();
    await flushUi();
    findButton(mounted.host, "看盘档案 1").click();
    await flushUi();
    findButton(document.body, "打开档案").click();
    await flushUi();
    expect(mounted.host.textContent).toContain("来自其他历法适配器版本");

    const callsBefore = fetchMock.mock.calls.filter(([input]) => input === "/v1/relationship/profile").length;
    mounted.host.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushUi();
    expect(mounted.host.textContent).toContain("公历排盘辅助版本已变更");
    expect(fetchMock.mock.calls.filter(([input]) => input === "/v1/relationship/profile")).toHaveLength(callsBefore);
  });

  it("clears a prior M4 observation and excludes it after the primary day pillar changes", async () => {
    const response = makeAnalysisResponse();
    const fetchMock = installBrowserMocks(response);
    mounted = mountComponent(App, {});
    await flushUi();

    const evaluateMode = mounted.host.querySelector<HTMLInputElement>('input[value="evaluate"]')!;
    evaluateMode.checked = true;
    evaluateMode.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await submit(mounted.host);

    const observation = mounted.host.querySelector<HTMLInputElement>('.observation-context input[aria-label*="M4-C01"]')!;
    expect(observation).not.toBeNull();
    observation.value = "旧日柱下的压力观察";
    observation.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    const day = mounted.host.querySelector<HTMLSelectElement>("#primary-day")!;
    day.value = "乙卯";
    day.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();
    expect(mounted.host.querySelector(".analysis-result")).toBeNull();

    await submit(mounted.host);
    const analysisCalls = fetchMock.mock.calls.filter(([input]) => input === "/v1/relationship/evaluate");
    expect(analysisCalls).toHaveLength(2);
    const request = JSON.parse(String(analysisCalls[1]?.[1]?.body)) as { observations?: unknown[]; subject: { four_pillars: { day: unknown } } };
    expect(request.observations).toBeUndefined();
    expect(request.subject.four_pillars.day).toEqual({ stem: "乙", branch: "卯" });
    expect(mounted.host.querySelector<HTMLInputElement>('.observation-context input[aria-label*="M4-C01"]')?.value).toBe("");
  });

  it("blocks repeated cross-state facts before sending an evaluation request", async () => {
    const fetchMock = installBrowserMocks(makeAnalysisResponse());
    mounted = mountComponent(App, {});
    await flushUi();
    const evaluateMode = mounted.host.querySelector<HTMLInputElement>('input[value="evaluate"]')!;
    evaluateMode.checked = true;
    evaluateMode.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();
    for (const state of ["steady", "pressure"]) {
      const checkbox = mounted.host.querySelector<HTMLInputElement>(`#cross-${state}`)!;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      await flushUi();
      const evidence = mounted.host.querySelector<HTMLInputElement>(`#cross-${state}-evidence`)!;
      evidence.value = "同一事件被重复填写";
      evidence.dispatchEvent(new Event("input", { bubbles: true }));
    }
    mounted.host.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushUi();
    expect(mounted.host.textContent).toContain("不同跨情境状态必须填写不同的事实依据");
    expect(fetchMock.mock.calls.filter(([input]) => input === "/v1/relationship/evaluate")).toHaveLength(0);
  });

  it("clears hidden evidence when inputs are removed from the active analysis", async () => {
    installBrowserMocks(makeAnalysisResponse());
    mounted = mountComponent(App, {});
    await flushUi();
    const evaluateMode = mounted.host.querySelector<HTMLInputElement>('input[value="evaluate"]')!;
    evaluateMode.checked = true;
    evaluateMode.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();

    const gateStatus = mounted.host.querySelector<HTMLSelectElement>("#gate-RG01")!;
    gateStatus.value = "pass";
    gateStatus.dispatchEvent(new Event("change", { bubbles: true }));
    const gateNote = gateStatus.closest(".gate-row")!.querySelector<HTMLInputElement>('input[type="text"]')!;
    gateNote.value = "双方曾明确确认并可随时撤回同意";
    gateNote.dispatchEvent(new Event("input", { bubbles: true }));
    const steady = mounted.host.querySelector<HTMLInputElement>("#cross-steady")!;
    steady.checked = true;
    steady.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();
    const steadyEvidence = mounted.host.querySelector<HTMLInputElement>("#cross-steady-evidence")!;
    steadyEvidence.value = "连续三周的日常安排记录";
    steadyEvidence.dispatchEvent(new Event("input", { bubbles: true }));

    const secondaryToggle = mounted.host.querySelector<HTMLInputElement>(".secondary-toggle input")!;
    secondaryToggle.checked = true;
    secondaryToggle.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();
    const secondaryLabel = mounted.host.querySelector<HTMLInputElement>("#secondary-subject-id")!;
    secondaryLabel.value = "不应保留的另一方";
    secondaryLabel.dispatchEvent(new Event("input", { bubbles: true }));
    secondaryToggle.checked = false;
    secondaryToggle.dispatchEvent(new Event("change", { bubbles: true }));

    const profileMode = mounted.host.querySelector<HTMLInputElement>('input[value="profile"]')!;
    profileMode.checked = true;
    profileMode.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();
    await submit(mounted.host);
    findButton(mounted.host, "保存到档案").click();

    const stored = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY)!) as { archives: Array<{ workspace: { gates: Array<{ status: string; note: string }>; crossState: { steady: boolean; evidence: { steady: string } } } }> };
    expect(stored.archives[0]?.workspace.gates.every((gate) => gate.status === "not_assessed" && gate.note === "")).toBe(true);
    expect(stored.archives[0]?.workspace.crossState).toMatchObject({ steady: false, evidence: { steady: "" } });
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).not.toContain("双方曾明确确认");
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).not.toContain("连续三周");
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).not.toContain("不应保留的另一方");
  });

  it("downloads a complete versioned reading package and then releases the blob URL", async () => {
    const response = makeAnalysisResponse();
    installBrowserMocks(response);
    let downloadedBlob: Blob | undefined;
    const createObjectURL = vi.fn((blob: Blob) => { downloadedBlob = blob; return "blob:test-result"; });
    const revokeObjectURL = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    let downloadName = "";
    const clickedAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true);
      clickedAnchors.push(this);
      downloadName = this.download;
    });

    mounted = mountComponent(App, {});
    await flushUi();
    await submit(mounted.host);
    findButton(mounted.host, "下载完整 JSON").click();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(downloadName).toContain(response.requestId);
    expect(clickedAnchors[0]?.isConnected).toBe(false);
    expect(document.querySelector('a[href="blob:test-result"]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(JSON.parse(await readBlob(downloadedBlob!))).toMatchObject({
      schema: "bazi.relationship.reading.v1",
      containsSensitiveData: true,
      workspace: { analysisMode: "profile", roleBasis: "female_traditional", result: response },
    });
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).toBeNull();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-result");
  });

  it("downloads a readable safety summary without ordinary report content", async () => {
    const response = makeAnalysisResponse({ safetyStop: true });
    installBrowserMocks(response);
    let downloadedBlob: Blob | undefined;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((blob: Blob) => { downloadedBlob = blob; return "blob:readable-summary"; }) });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    let downloadName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloadName = this.download; });
    mounted = mountComponent(App, {});
    await flushUi();
    findButton(mounted.host, "公历排盘辅助").click();
    await flushUi();
    const solarInput = mounted.host.querySelector<HTMLInputElement>("#primary-solar-datetime")!;
    solarInput.value = "1986-05-29T12:00";
    solarInput.dispatchEvent(new Event("input", { bubbles: true }));
    findButton(mounted.host, "计算并填入四柱").click();
    await flushUi();
    await submit(mounted.host);

    findButton(mounted.host, "下载可读摘要").click();
    const summary = await readBlob(downloadedBlob!);
    expect(downloadName).toBe(`bazi-reading-${response.requestId}.md`);
    expect(summary).toContain("# 关系脉络看盘摘要");
    expect(summary).toContain("## 安全与边界");
    expect(summary).toContain("证据等级：FG0");
    expect(summary).toContain("主要命盘来源：1986-05-29 12:00 · UTC+08:00 · lunar-typescript-standard-time 1.8.6");
    expect(summary).toContain(`分析 ID：${response.requestId}`);
    expect(summary).toContain(`规则快照：${response.rulesetDigest}`);
    expect(summary).toContain("本报告不是命定结果");
    expect(summary).not.toContain("ORDINARY-CONTENT-MUST-STAY-HIDDEN");
    expect(summary).not.toContain("下一步可观察");
    expect(summary).not.toContain("## 现实闸门");
  });

  it("downloads adjudicated reality gates and cross-state evidence in the readable summary", async () => {
    const response = makeAnalysisResponse();
    response.relationship.m5.crossStateEvidence = [{ state: "pressure", note: "高压期仍能暂停并协商", evidenceIds: ["event-02"] }];
    installBrowserMocks(response);
    let downloadedBlob: Blob | undefined;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((blob: Blob) => { downloadedBlob = blob; return "blob:evaluate-summary"; }) });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    mounted = mountComponent(App, {});
    await flushUi();
    const evaluate = mounted.host.querySelector<HTMLInputElement>('input[value="evaluate"]')!;
    evaluate.checked = true;
    evaluate.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();
    const gate = mounted.host.querySelector<HTMLSelectElement>("#gate-RG01")!;
    gate.value = "pass";
    gate.dispatchEvent(new Event("change", { bubbles: true }));
    const note = mounted.host.querySelector<HTMLInputElement>('[aria-label="安全、同意与尊重的事实依据"]')!;
    note.value = "双方能自由表达并撤回同意";
    note.dispatchEvent(new Event("input", { bubbles: true }));
    await submit(mounted.host);
    const observation = mounted.host.querySelector<HTMLInputElement>('.observation-context input[aria-label*="M4-C01"]')!;
    observation.value = "两次压力情境中都能在暂停后恢复协商";
    observation.dispatchEvent(new Event("input", { bubbles: true }));
    await submit(mounted.host);

    findButton(mounted.host, "下载可读摘要").click();
    const summary = await readBlob(downloadedBlob!);
    expect(summary).toContain("## 现实闸门");
    expect(summary).toContain("RG01 安全、同意与尊重：通过｜事实依据：双方能自由表达并撤回同意");
    expect(summary).toContain("## 跨情境核验");
    expect(summary).toContain("压力态：高压期仍能暂停并协商");
    expect(summary).toContain("## 独立现实观察");
    expect(summary).toContain("M4-C01 · 观察 1 · 本人观察 · 支持候选：两次压力情境中都能在暂停后恢复协商");
  });

  it("opens the system print flow for the adjudicated reading", async () => {
    installBrowserMocks(makeAnalysisResponse());
    const print = vi.fn();
    Object.defineProperty(window, "print", { configurable: true, value: print });
    mounted = mountComponent(App, {});
    await flushUi();
    await submit(mounted.host);
    findButton(mounted.host, "打印 / 存 PDF").click();
    expect(print).toHaveBeenCalledOnce();
  });

  it("keeps an unsaved reading when starting over is cancelled", async () => {
    installBrowserMocks(makeAnalysisResponse());
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    mounted = mountComponent(App, {});
    await flushUi();
    await submit(mounted.host);

    findButton(mounted.host, "新建分析").click();
    await flushUi();

    expect(confirm).toHaveBeenCalledWith("当前输入或看盘尚未保存，仍要新建分析吗？");
    expect(mounted.host.querySelector(".analysis-result")).not.toBeNull();
  });

  it("keeps an unsaved reading when an analysis mode switch is cancelled", async () => {
    installBrowserMocks(makeAnalysisResponse());
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    mounted = mountComponent(App, {});
    await flushUi();
    await submit(mounted.host);

    mounted.host.querySelector<HTMLInputElement>('input[value="structure"]')!.click();
    await flushUi();

    expect(confirm).toHaveBeenCalledWith("当前看盘或相关草稿尚未保存，切换分析方式会清除内容，是否继续？");
    expect(mounted.host.querySelector<HTMLInputElement>('input[value="profile"]')?.checked).toBe(true);
    expect(mounted.host.querySelector(".analysis-result")).not.toBeNull();
  });

  it("keeps unsaved reality-gate evidence when leaving evaluation is cancelled", async () => {
    installBrowserMocks(makeAnalysisResponse());
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    mounted = mountComponent(App, {});
    await flushUi();
    const evaluate = mounted.host.querySelector<HTMLInputElement>('input[value="evaluate"]')!;
    evaluate.checked = true;
    evaluate.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();
    const gate = mounted.host.querySelector<HTMLSelectElement>("#gate-RG01")!;
    gate.value = "pass";
    gate.dispatchEvent(new Event("change", { bubbles: true }));

    mounted.host.querySelector<HTMLInputElement>('input[value="profile"]')!.click();
    await flushUi();

    expect(confirm).toHaveBeenCalledWith("当前看盘或相关草稿尚未保存，切换分析方式会清除内容，是否继续？");
    expect(evaluate.checked).toBe(true);
    expect(gate.value).toBe("pass");
  });

  it("does not confirm when cycling empty analysis modes", async () => {
    installBrowserMocks(makeAnalysisResponse());
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    mounted = mountComponent(App, {});
    await flushUi();

    mounted.host.querySelector<HTMLInputElement>('input[value="structure"]')!.click();
    await flushUi();
    mounted.host.querySelector<HTMLInputElement>('input[value="profile"]')!.click();
    await flushUi();

    expect(confirm).not.toHaveBeenCalled();
    expect(mounted.host.querySelector<HTMLInputElement>('input[value="profile"]')?.checked).toBe(true);
  });

  it("protects edited inputs before a reading has been generated", async () => {
    installBrowserMocks(makeAnalysisResponse());
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    mounted = mountComponent(App, {});
    await flushUi();
    const subjectLabel = mounted.host.querySelector<HTMLInputElement>("#primary-subject-id")!;
    subjectLabel.value = "尚未提交的草稿";
    subjectLabel.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
    findButton(mounted.host, "新建分析").click();
    await flushUi();
    expect(confirm).toHaveBeenCalledWith("当前输入或看盘尚未保存，仍要新建分析吗？");
    expect(subjectLabel.value).toBe("尚未提交的草稿");
  });

  it("blocks page unload until the completed reading is saved", async () => {
    installBrowserMocks(makeAnalysisResponse());
    mounted = mountComponent(App, {});
    await flushUi();
    await submit(mounted.host);
    expect(findButton(mounted.host, "保存到档案").disabled).toBe(false);

    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
    findButton(mounted.host, "保存到档案").click();
    await flushUi();
    expect(findButton(mounted.host, "已保存到档案").disabled).toBe(true);
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);
  });

  it("syncs another tab and confirms before overwriting its newer workspace", async () => {
    installBrowserMocks(makeAnalysisResponse());
    mounted = mountComponent(App, {});
    await flushUi();
    await submit(mounted.host);
    findButton(mounted.host, "保存到档案").click();
    await flushUi();
    findButton(mounted.host, "看盘档案 1").click();
    await flushUi();

    const envelope = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY)!) as { archives: Array<{ savedAt: string; workspace: { result: { generatedAt: string } } }> };
    envelope.archives[0]!.workspace.result.generatedAt = "2099-01-01T00:00:00.000Z";
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(envelope));
    window.dispatchEvent(new StorageEvent("storage", { key: ARCHIVE_STORAGE_KEY }));
    await flushUi();
    expect(findButton(mounted.host, "更新档案").disabled).toBe(false);
    const cancelOverwrite = vi.fn(() => false);
    vi.stubGlobal("confirm", cancelOverwrite);
    findButton(mounted.host, "更新档案").click();
    await flushUi();
    expect(cancelOverwrite).toHaveBeenCalledWith("这份档案已在另一标签页或备份中更新。继续会用当前工作区覆盖较新版本，是否继续？");
    expect(document.body.textContent).toContain("已取消覆盖");
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).toContain("2099-01-01T00:00:00.000Z");

    envelope.archives[0]!.savedAt = "2099-01-02T00:00:00.000Z";
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(envelope));
    findButton(document.body, "删除").click();
    await flushUi();
    findButton(document.body, "确认删除").click();
    await flushUi();
    expect(document.body.textContent).toContain("档案已在另一标签页更新");
    expect(localStorage.getItem(ARCHIVE_STORAGE_KEY)).toContain("2099-01-02T00:00:00.000Z");

    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", { key: ARCHIVE_STORAGE_KEY }));
    await flushUi();
    expect(document.body.textContent).toContain("档案已从另一标签页同步");
    expect(document.body.textContent).toContain("还没有保存的看盘");
    expect(findButton(mounted.host, "保存到档案").disabled).toBe(false);
  });

  it("requires reevaluation before saving or exporting edited reality observations", async () => {
    installBrowserMocks(makeAnalysisResponse());
    mounted = mountComponent(App, {});
    await flushUi();
    const evaluateMode = mounted.host.querySelector<HTMLInputElement>('input[value="evaluate"]')!;
    evaluateMode.checked = true;
    evaluateMode.dispatchEvent(new Event("change", { bubbles: true }));
    await submit(mounted.host);
    findButton(mounted.host, "保存到档案").click();
    await flushUi();
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true);

    const observation = mounted.host.querySelector<HTMLInputElement>('.observation-context input[aria-label*="M4-C01"]')!;
    observation.value = "保存后补充的压力情境";
    observation.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();
    expect(findButton(mounted.host, "更新档案").disabled).toBe(true);
    expect(findButton(mounted.host, "打印 / 存 PDF").disabled).toBe(true);
    expect(findButton(mounted.host, "下载可读摘要").disabled).toBe(true);
    expect(findButton(mounted.host, "下载完整 JSON").disabled).toBe(true);
    expect(mounted.host.textContent).toContain("独立现实观察尚未进入当前结果");
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);

    await submit(mounted.host);
    expect(findButton(mounted.host, "更新档案").disabled).toBe(false);
    expect(findButton(mounted.host, "下载可读摘要").disabled).toBe(false);
  });

  it("saves a completed reading locally and restores it after starting over", async () => {
    const response = makeAnalysisResponse();
    const fetchMock = installBrowserMocks(response);
    let backupBlob: Blob | undefined;
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn((blob: Blob) => { backupBlob = blob; return "blob:archive-backup"; }) },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    mounted = mountComponent(App, {});
    await flushUi();
    const subjectLabel = mounted.host.querySelector<HTMLInputElement>("#primary-subject-id")!;
    subjectLabel.value = "小林";
    subjectLabel.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();
    await submit(mounted.host);

    const analysisCall = fetchMock.mock.calls.find(([input]) => input === "/v1/relationship/profile")!;
    const request = JSON.parse(String(analysisCall[1]?.body)) as { subject: { subject_id: string } };
    expect(request.subject.subject_id).toBe("小林");

    findButton(mounted.host, "保存到档案").click();
    await flushUi();
    expect(localStorage.getItem("bazi.relationship.archives.v1")).toContain(response.requestId);
    expect(localStorage.getItem("bazi.relationship.archives.v1")).toContain("小林 · 甲寅日 · 关系画像");
    expect(mounted.host.textContent).toContain("本次看盘已保存到这台设备");

    findButton(mounted.host, "新建分析").click();
    await flushUi();
    expect(mounted.host.querySelector(".analysis-result")).toBeNull();
    expect(mounted.host.querySelector<HTMLInputElement>("#primary-subject-id")?.value).toBe("主命盘");
    findButton(mounted.host, "看盘档案 1").click();
    await flushUi();
    expect(document.body.textContent).toContain("看盘档案");
    findButton(document.body, "导出全部备份").click();
    const backup = await backupBlob!.text();
    expect(JSON.parse(backup)).toMatchObject({ schema: "bazi.relationship.archive-backup.v1", containsSensitiveData: true });

    const importedBackup = JSON.parse(backup) as { archives: Array<{ title: string; savedAt: string }> };
    importedBackup.archives[0]!.title = "备份中的新名称";
    importedBackup.archives[0]!.savedAt = "2099-01-01T00:00:00.000Z";
    const importedRaw = JSON.stringify(importedBackup);
    const fileInput = document.body.querySelector<HTMLInputElement>('input[type="file"]')!;
    const backupFile = { size: importedRaw.length, text: async () => importedRaw } as File;
    Object.defineProperty(fileInput, "files", { configurable: true, value: [backupFile] });
    const cancelImport = vi.fn(() => false);
    vi.stubGlobal("confirm", cancelImport);
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await flushUi();
    expect(cancelImport).toHaveBeenCalledWith(expect.stringContaining("更新 1"));
    expect(document.body.textContent).toContain("已取消导入，本机档案未更改");
    expect(localStorage.getItem("bazi.relationship.archives.v1")).not.toContain("备份中的新名称");

    const draftLabel = mounted.host.querySelector<HTMLInputElement>("#primary-subject-id")!;
    draftLabel.value = "未保存的新草稿";
    draftLabel.dispatchEvent(new Event("input", { bubbles: true }));
    const confirmOpen = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmOpen);
    findButton(document.body, "打开档案").click();
    await flushUi();
    expect(confirmOpen).toHaveBeenCalledWith("当前输入或看盘尚未保存，仍要打开档案吗？");
    expect(mounted.host.querySelector(".analysis-result")).not.toBeNull();
    expect(mounted.host.textContent).toContain("已打开");
    expect(mounted.host.querySelector<HTMLInputElement>("#primary-subject-id")?.value).toBe("小林");
  });
});

function installBrowserMocks(response: ReturnType<typeof makeAnalysisResponse>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const body = input === "/health" ? health : input === "/v1/m0/analyze" ? makeM0AnalysisResponse() : response;
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, media: "", onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })));
  Object.defineProperty(window, "matchMedia", { configurable: true, value: globalThis.matchMedia });
  Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  return fetchMock;
}

async function submit(host: HTMLElement): Promise<void> {
  host.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await flushUi();
    if (host.querySelector(".analysis-result")) return;
  }
  throw new Error("analysis result did not render");
}

async function flushUi(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

function findButton(root: ParentNode, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label);
  if (!button) throw new Error(`button not found: ${label}`);
  return button;
}

function browserStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}
