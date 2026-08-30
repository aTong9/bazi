import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App.vue";
import { makeAnalysisResponse } from "./test/analysis-fixture";
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
  it("blocks analysis while a solar assist record is unresolved", async () => {
    const fetchMock = installBrowserMocks(makeAnalysisResponse());
    mounted = mountComponent(App, {});
    await flushUi();
    findButton(mounted.host, "公历排盘辅助").click();
    await nextTick();
    mounted.host.querySelector<HTMLFormElement>("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushUi();
    expect(mounted.host.textContent).toContain("请先修正命盘输入");
    expect(mounted.host.textContent).toContain("请完成公历时间计算，或切换为手动四柱");
    expect(fetchMock.mock.calls.filter(([input]) => input === "/v1/relationship/profile")).toHaveLength(0);
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

  it("downloads the exact response through a connected anchor and then releases the blob URL", async () => {
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
    expect(JSON.parse(await readBlob(downloadedBlob!))).toEqual(response);
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
    await submit(mounted.host);

    findButton(mounted.host, "下载可读摘要").click();
    const summary = await readBlob(downloadedBlob!);
    expect(downloadName).toBe(`bazi-reading-${response.requestId}.md`);
    expect(summary).toContain("# 关系脉络看盘摘要");
    expect(summary).toContain("## 安全与边界");
    expect(summary).toContain("证据等级：FG0");
    expect(summary).toContain("本报告不是命定结果");
    expect(summary).not.toContain("ORDINARY-CONTENT-MUST-STAY-HIDDEN");
    expect(summary).not.toContain("下一步可观察");
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

  it("protects reality observations edited after the reading was saved", async () => {
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
    expect(findButton(mounted.host, "更新档案").disabled).toBe(false);
    expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
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
    const body = input === "/health" ? health : response;
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
