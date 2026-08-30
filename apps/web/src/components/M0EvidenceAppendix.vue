<script setup lang="ts">
import { computed, ref } from "vue";

import { M0_FIELD_LABELS, STATUS_LABELS } from "@/constants";
import type { ResultItem } from "@/types";

const props = defineProps<{ fields: Record<string, ResultItem> }>();
const query = ref("");

const entries = computed(() => Object.entries(props.fields).filter(([key]) => {
  const term = query.value.trim().toLocaleLowerCase("zh-CN");
  return !term || key.toLowerCase().includes(term) || (M0_FIELD_LABELS[key] ?? "").includes(term);
}));

function label(value: string): string { return STATUS_LABELS[value] ?? value.replaceAll("_", " "); }
function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "未提供";
  return JSON.stringify(value, null, 2);
}
</script>

<template>
  <details class="evidence-details m0-evidence">
    <summary>查看完整 M0 字段证据（{{ Object.keys(fields).length }} 项）</summary>
    <div class="evidence-toolbar">
      <label>
        <span>检索字段</span>
        <input v-model="query" type="search" placeholder="输入中文名称或字段键" autocomplete="off">
      </label>
      <small aria-live="polite">显示 {{ entries.length }} 项</small>
    </div>
    <div v-if="entries.length" class="evidence-list">
      <details v-for="([key, field]) in entries" :key="key" class="evidence-item">
        <summary>
          <span><strong>{{ M0_FIELD_LABELS[key] ?? key }}</strong><code>{{ key }}</code></span>
          <small>{{ label(field.status) }} · {{ label(field.confidence) }}置信</small>
        </summary>
        <pre>{{ formatValue(field.value) }}</pre>
        <p v-if="field.conditions.length">条件：{{ field.conditions.join('；') }}</p>
      </details>
    </div>
    <p v-else class="evidence-empty">没有匹配的字段。</p>
  </details>
</template>
