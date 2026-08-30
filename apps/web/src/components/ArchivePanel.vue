<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

import type { AnalysisArchive, AnalysisMode } from "@/types";

const props = defineProps<{ open: boolean; archives: readonly AnalysisArchive[]; notice?: string; recoveryAvailable?: boolean; returnFocusTo?: HTMLElement | null }>();
const emit = defineEmits<{ close: []; restore: [archive: AnalysisArchive]; rename: [id: string, title: string]; delete: [archive: AnalysisArchive]; export: []; exportOne: [archive: AnalysisArchive]; exportRecovery: []; clearRecovery: []; import: [file: File] }>();
const panel = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const pendingDeleteId = ref<string | null>(null);
const pendingRecoveryClear = ref(false);
const query = ref("");
const mode = ref<"all" | AnalysisMode>("all");
const filteredArchives = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase("zh-CN");
  return props.archives.filter((archive) => (mode.value === "all" || archive.workspace.analysisMode === mode.value) && (!needle || archiveSearchText(archive).includes(needle)));
});
let returnFocus: HTMLElement | null = null;

watch(() => props.open, async (open) => {
  if (!open) {
    pendingDeleteId.value = null;
    pendingRecoveryClear.value = false;
    const target = returnFocus;
    returnFocus = null;
    await nextTick();
    if (target?.isConnected) target.focus({ preventScroll: true });
    return;
  }
  returnFocus = props.returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  await nextTick();
  focusableElements()[0]?.focus({ preventScroll: true });
}, { immediate: true });

function onKeydown(event: KeyboardEvent): void {
  if (!props.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }
  if (event.key !== "Tab") return;
  const elements = focusableElements();
  const first = elements[0];
  const last = elements.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && (document.activeElement === first || !panel.value?.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onBeforeUnmount(() => {
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
});

function focusableElements(): HTMLElement[] {
  return [...panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([tabindex="-1"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []];
}

function savedAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function modeLabel(value: AnalysisMode): string {
  return value === "structure" ? "原局结构" : value === "evaluate" ? "现实评估" : "关系画像";
}

function selectBackup(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("import", file);
  input.value = "";
}

async function requestDelete(id: string, event: MouseEvent): Promise<void> {
  const actions = (event.currentTarget as HTMLElement).closest(".archive-actions");
  pendingDeleteId.value = id;
  await nextTick();
  actions?.querySelector<HTMLButtonElement>(".archive-delete-confirm .danger-button")?.focus();
}

async function cancelDelete(event: MouseEvent): Promise<void> {
  const actions = (event.currentTarget as HTMLElement).closest(".archive-actions");
  pendingDeleteId.value = null;
  await nextTick();
  actions?.querySelector<HTMLButtonElement>(".danger-button")?.focus();
}

async function confirmDelete(archive: AnalysisArchive): Promise<void> {
  emit("delete", archive);
  pendingDeleteId.value = null;
  await nextTick();
  focusableElements()[0]?.focus({ preventScroll: true });
}

async function requestRecoveryClear(event: MouseEvent): Promise<void> {
  const actions = (event.currentTarget as HTMLElement).closest(".archive-recovery");
  pendingRecoveryClear.value = true;
  await nextTick();
  actions?.querySelector<HTMLButtonElement>(".danger-button")?.focus();
}

async function cancelRecoveryClear(event: MouseEvent): Promise<void> {
  const actions = (event.currentTarget as HTMLElement).closest(".archive-recovery");
  pendingRecoveryClear.value = false;
  await nextTick();
  actions?.querySelector<HTMLButtonElement>(".danger-button")?.focus();
}

async function confirmRecoveryClear(): Promise<void> {
  emit("clearRecovery");
  pendingRecoveryClear.value = false;
  await nextTick();
  focusableElements()[0]?.focus({ preventScroll: true });
}

function requestRename(archive: AnalysisArchive): void {
  const title = window.prompt("修改档案名称", archive.title);
  if (title !== null) emit("rename", archive.id, title);
}

function archiveSearchText(archive: AnalysisArchive): string {
  const { primarySubject } = archive.workspace;
  const subjectText = (subject: typeof primarySubject) => [subject.subjectId, subject.year, subject.month, subject.day, subject.hour].join(" ");
  const secondary = archive.workspace.analysisMode === "structure" || !archive.workspace.hasSecondarySubject ? "" : subjectText(archive.workspace.secondarySubject);
  return [archive.title, subjectText(primarySubject), secondary].join(" ").toLocaleLowerCase("zh-CN");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="archive-panel">
      <div v-if="open" class="archive-overlay" @click.self="emit('close')">
        <aside id="archive-panel" ref="panel" class="archive-panel" role="dialog" aria-modal="true" aria-labelledby="archive-title" @keydown="onKeydown">
          <header>
            <div><p class="eyebrow">仅保存在这台设备</p><h2 id="archive-title">看盘档案</h2></div>
            <button type="button" class="quiet-button" aria-label="关闭看盘档案" @click="emit('close')">关闭</button>
          </header>
          <p class="archive-privacy">档案可能包含公历出生时间、历法版本、四柱、现实证据与完整分析结果。数据只写入当前浏览器；导出的 JSON 是未加密敏感文件，请自行妥善保管。</p>
          <p v-if="notice" class="archive-notice" role="status">{{ notice }}</p>
          <div class="archive-transfer">
            <button type="button" class="quiet-button" :disabled="!archives.length" @click="emit('export')">导出全部备份</button>
            <button type="button" class="quiet-button" @click="fileInput?.click()">导入备份 / 看盘包</button>
            <input ref="fileInput" class="visually-hidden" type="file" tabindex="-1" accept="application/json,.json" @change="selectBackup" />
          </div>
          <div v-if="recoveryAvailable" class="archive-transfer archive-recovery" role="group" aria-label="损坏档案恢复">
            <button type="button" class="quiet-button" @click="emit('exportRecovery')">导出原始存储</button>
            <template v-if="pendingRecoveryClear">
              <button type="button" class="quiet-button danger-button" @click="confirmRecoveryClear">确认清除</button>
              <button type="button" class="quiet-button" @click="cancelRecoveryClear">取消</button>
            </template>
            <button v-else type="button" class="quiet-button danger-button" @click="requestRecoveryClear">清除损坏数据</button>
          </div>
          <div v-if="archives.length" class="archive-filters">
            <label class="archive-search">
              <span>搜索档案</span>
              <input v-model="query" type="search" placeholder="名称、命盘称呼或四柱" autocomplete="off" />
            </label>
            <label class="archive-search">
              <span>看盘类型</span>
              <select v-model="mode">
                <option value="all">全部类型</option>
                <option value="structure">原局结构</option>
                <option value="profile">关系画像</option>
                <option value="evaluate">现实评估</option>
              </select>
            </label>
          </div>
          <div v-if="filteredArchives.length" class="archive-list">
            <article v-for="archive in filteredArchives" :key="archive.id">
              <div>
                <h3>{{ archive.title }}</h3>
                <p><span class="archive-mode">{{ modeLabel(archive.workspace.analysisMode) }}</span> · {{ savedAt(archive.savedAt) }} · 快照 {{ archive.rulesetDigest.slice(0, 10) }}</p>
              </div>
              <div class="archive-actions">
                <button type="button" class="primary-button" @click="emit('restore', archive)">打开档案</button>
                <button type="button" class="quiet-button" @click="emit('exportOne', archive)">导出此档案</button>
                <button type="button" class="quiet-button" @click="requestRename(archive)">重命名</button>
                <template v-if="pendingDeleteId === archive.id">
                  <span class="archive-delete-confirm" role="group" :aria-label="`确认删除 ${archive.title}`">
                    <button type="button" class="quiet-button danger-button" @click="confirmDelete(archive)">确认删除</button>
                    <button type="button" class="quiet-button" @click="cancelDelete">取消</button>
                  </span>
                </template>
                <button v-else type="button" class="quiet-button danger-button" @click="requestDelete(archive.id, $event)">删除</button>
              </div>
            </article>
          </div>
          <div v-else-if="archives.length" class="archive-empty">
            <span aria-hidden="true">寻</span>
            <h3>没有匹配的档案</h3>
            <p>换一个名称、称呼、四柱或看盘类型试试。</p>
          </div>
          <div v-else class="archive-empty">
            <span aria-hidden="true">册</span>
            <h3>还没有保存的看盘</h3>
            <p>完成一次分析后，使用结果顶部的“保存到档案”。</p>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
