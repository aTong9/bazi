<script setup lang="ts">
import { computed, watch } from "vue";

import { hourOptions, JIAZI, monthOptions, normalizeLinkedPillars } from "@/domain";
import type { SubjectDraft } from "@/types";

const props = defineProps<{ idPrefix: string; title: string; description: string }>();
const model = defineModel<SubjectDraft>({ required: true });

const availableMonths = computed(() => monthOptions(model.value.year));
const availableHours = computed(() => hourOptions(model.value.day));
const isHourUnknown = computed(() => model.value.birthTimeStatus === "unknown");

watch([() => model.value.year, () => model.value.day], () => {
  model.value = normalizeLinkedPillars(model.value);
}, { immediate: true });
</script>

<template>
  <fieldset class="pillar-editor">
    <legend>{{ title }}</legend>
    <p class="field-help">{{ description }}</p>

    <div class="pillar-grid">
      <label class="field-control">
        <span>年柱</span>
        <select :id="`${idPrefix}-year`" v-model="model.year">
          <option v-for="pillar in JIAZI" :key="pillar" :value="pillar">{{ pillar }}</option>
        </select>
      </label>
      <label class="field-control">
        <span>月柱</span>
        <select :id="`${idPrefix}-month`" v-model="model.month">
          <option v-for="pillar in availableMonths" :key="pillar" :value="pillar">{{ pillar }}</option>
        </select>
        <small>月干随年干校验</small>
      </label>
      <label class="field-control">
        <span>日柱</span>
        <select :id="`${idPrefix}-day`" v-model="model.day">
          <option v-for="pillar in JIAZI" :key="pillar" :value="pillar">{{ pillar }}</option>
        </select>
      </label>
      <label class="field-control" :class="{ 'is-disabled': isHourUnknown }">
        <span>时柱</span>
        <select :id="`${idPrefix}-hour`" v-model="model.hour" :disabled="isHourUnknown">
          <option v-for="pillar in availableHours" :key="pillar" :value="pillar">{{ pillar }}</option>
        </select>
        <small>{{ isHourUnknown ? "时柱将按未知处理" : "时干随日干校验" }}</small>
      </label>
    </div>

    <div class="subfield-row">
      <label class="field-control">
        <span>出生时间状态</span>
        <select :id="`${idPrefix}-time-status`" v-model="model.birthTimeStatus">
          <option value="exact">准确</option>
          <option value="approximate">大致</option>
          <option value="unknown">未知</option>
        </select>
      </label>
      <label class="field-control">
        <span>资料质量</span>
        <select :id="`${idPrefix}-quality`" v-model="model.dataQuality">
          <option value="high">高 · 已核对</option>
          <option value="medium">中 · 基本可信</option>
          <option value="low">低 · 可能有误</option>
          <option value="unknown">未知</option>
        </select>
      </label>
    </div>

    <p v-if="model.birthTimeStatus !== 'exact'" class="inline-notice">
      时辰不准确会降低位置关系与部分结构结论的证据等级，系统会保留受限状态。
    </p>
  </fieldset>
</template>
