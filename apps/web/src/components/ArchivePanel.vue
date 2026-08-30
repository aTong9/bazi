<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { AnalysisArchive } from "@/types";

const props = defineProps<{ open: boolean; archives: readonly AnalysisArchive[]; notice?: string }>();
const emit = defineEmits<{ close: []; restore: [archive: AnalysisArchive]; delete: [id: string]; export: []; import: [file: File] }>();
const panel = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

watch(() => props.open, async (open) => {
  if (!open) return;
  await nextTick();
  panel.value?.querySelector<HTMLElement>("button")?.focus();
});

function onKeydown(event: KeyboardEvent): void {
  if (props.open && event.key === "Escape") emit("close");
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

function savedAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function selectBackup(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("import", file);
  input.value = "";
}
</script>

<template>
  <Teleport to="body">
    <Transition name="archive-panel">
      <div v-if="open" class="archive-overlay" @click.self="emit('close')">
        <aside ref="panel" class="archive-panel" role="dialog" aria-modal="true" aria-labelledby="archive-title">
          <header>
            <div><p class="eyebrow">仅保存在这台设备</p><h2 id="archive-title">看盘档案</h2></div>
            <button type="button" class="quiet-button" aria-label="关闭看盘档案" @click="emit('close')">关闭</button>
          </header>
          <p class="archive-privacy">档案包含四柱、现实证据与完整分析结果。数据只写入当前浏览器；导出的 JSON 是未加密敏感文件，请自行妥善保管。</p>
          <p v-if="notice" class="archive-notice" role="status">{{ notice }}</p>
          <div class="archive-transfer">
            <button type="button" class="quiet-button" :disabled="!archives.length" @click="emit('export')">导出全部备份</button>
            <button type="button" class="quiet-button" @click="fileInput?.click()">从备份导入</button>
            <input ref="fileInput" class="visually-hidden" type="file" accept="application/json,.json" @change="selectBackup" />
          </div>
          <div v-if="archives.length" class="archive-list">
            <article v-for="archive in archives" :key="archive.id">
              <div>
                <h3>{{ archive.title }}</h3>
                <p>{{ savedAt(archive.savedAt) }} · 快照 {{ archive.rulesetDigest.slice(0, 10) }}</p>
              </div>
              <div class="archive-actions">
                <button type="button" class="primary-button" @click="emit('restore', archive)">打开档案</button>
                <button type="button" class="quiet-button danger-button" @click="emit('delete', archive.id)">删除</button>
              </div>
            </article>
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
