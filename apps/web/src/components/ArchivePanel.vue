<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

import type { AnalysisArchive } from "@/types";

const props = defineProps<{ open: boolean; archives: readonly AnalysisArchive[]; notice?: string; recoveryAvailable?: boolean; returnFocusTo?: HTMLElement | null }>();
const emit = defineEmits<{ close: []; restore: [archive: AnalysisArchive]; rename: [id: string, title: string]; delete: [id: string]; export: []; exportOne: [archive: AnalysisArchive]; exportRecovery: []; clearRecovery: []; import: [file: File] }>();
const panel = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const pendingDeleteId = ref<string | null>(null);
const pendingRecoveryClear = ref(false);
const query = ref("");
const filteredArchives = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase("zh-CN");
  return needle ? props.archives.filter((archive) => archiveSearchText(archive).includes(needle)) : props.archives;
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

function selectBackup(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("import", file);
  input.value = "";
}

function confirmDelete(id: string): void {
  emit("delete", id);
  pendingDeleteId.value = null;
}

function requestRename(archive: AnalysisArchive): void {
  const title = window.prompt("修改档案名称", archive.title);
  if (title !== null) emit("rename", archive.id, title);
}

function archiveSearchText(archive: AnalysisArchive): string {
  const { primarySubject, secondarySubject, hasSecondarySubject } = archive.workspace;
  const subjectText = (subject: typeof primarySubject) => [subject.subjectId, subject.year, subject.month, subject.day, subject.hour].join(" ");
  return [archive.title, subjectText(primarySubject), hasSecondarySubject ? subjectText(secondarySubject) : ""].join(" ").toLocaleLowerCase("zh-CN");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="archive-panel">
      <div v-if="open" class="archive-overlay" @click.self="emit('close')">
        <aside ref="panel" class="archive-panel" role="dialog" aria-modal="true" aria-labelledby="archive-title" @keydown="onKeydown">
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
              <button type="button" class="quiet-button danger-button" @click="emit('clearRecovery'); pendingRecoveryClear = false">确认清除</button>
              <button type="button" class="quiet-button" @click="pendingRecoveryClear = false">取消</button>
            </template>
            <button v-else type="button" class="quiet-button danger-button" @click="pendingRecoveryClear = true">清除损坏数据</button>
          </div>
          <label v-if="archives.length" class="archive-search">
            <span>搜索档案</span>
            <input v-model="query" type="search" placeholder="名称、命盘称呼或四柱" autocomplete="off" />
          </label>
          <div v-if="filteredArchives.length" class="archive-list">
            <article v-for="archive in filteredArchives" :key="archive.id">
              <div>
                <h3>{{ archive.title }}</h3>
                <p>{{ savedAt(archive.savedAt) }} · 快照 {{ archive.rulesetDigest.slice(0, 10) }}</p>
              </div>
              <div class="archive-actions">
                <button type="button" class="primary-button" @click="emit('restore', archive)">打开档案</button>
                <button type="button" class="quiet-button" @click="emit('exportOne', archive)">导出此档案</button>
                <button type="button" class="quiet-button" @click="requestRename(archive)">重命名</button>
                <template v-if="pendingDeleteId === archive.id">
                  <span class="archive-delete-confirm" role="group" :aria-label="`确认删除 ${archive.title}`">
                    <button type="button" class="quiet-button danger-button" @click="confirmDelete(archive.id)">确认删除</button>
                    <button type="button" class="quiet-button" @click="pendingDeleteId = null">取消</button>
                  </span>
                </template>
                <button v-else type="button" class="quiet-button danger-button" @click="pendingDeleteId = archive.id">删除</button>
              </div>
            </article>
          </div>
          <div v-else-if="archives.length" class="archive-empty">
            <span aria-hidden="true">寻</span>
            <h3>没有匹配的档案</h3>
            <p>换一个名称、称呼或四柱试试。</p>
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
