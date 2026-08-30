<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { hourOptions, JIAZI, monthOptions, normalizeLinkedPillars } from "@/domain";
import type { SubjectDraft } from "@/types";
import { formatFourPillars, resolveSolarBirth, type SolarBirthResolution } from "../../../../packages/calendar/src/resolve-solar-birth";

const props = defineProps<{ idPrefix: string; title: string; description: string }>();
const model = defineModel<SubjectDraft>({ required: true });
const entryMode = ref<"manual" | "solar">("manual");
const solarLocalDateTime = ref("");
const calendarResolution = ref<SolarBirthResolution | null>(null);

const availableMonths = computed(() => monthOptions(model.value.year));
const availableHours = computed(() => hourOptions(model.value.day));
const isHourUnknown = computed(() => model.value.birthTimeStatus === "unknown");

watch([() => model.value.year, () => model.value.day], () => {
  model.value = normalizeLinkedPillars(model.value);
}, { immediate: true });

function calculateFromSolar(): void {
  calendarResolution.value = resolveSolarBirth(solarLocalDateTime.value);
  if (calendarResolution.value.status !== "resolved") return;
  const { year, month, day, hour } = calendarResolution.value.fourPillars;
  model.value = {
    ...model.value,
    year: `${year.stem}${year.branch}`,
    month: `${month.stem}${month.branch}`,
    day: `${day.stem}${day.branch}`,
    hour: `${hour.stem}${hour.branch}`,
    birthTimeStatus: "exact",
    dataQuality: "high",
  };
}
</script>

<template>
  <fieldset class="pillar-editor">
    <legend>{{ title }}</legend>
    <p class="field-help">{{ description }}</p>

    <div class="pillar-entry-switch" role="group" :aria-label="`${title}录入方式`">
      <button type="button" :class="{ active: entryMode === 'manual' }" @click="entryMode = 'manual'">手动四柱</button>
      <button type="button" :class="{ active: entryMode === 'solar' }" @click="entryMode = 'solar'">公历排盘辅助</button>
    </div>

    <section v-if="entryMode === 'solar'" class="solar-birth-assist" :aria-labelledby="`${idPrefix}-solar-title`">
      <div>
        <strong :id="`${idPrefix}-solar-title`">输入已经换算好的中国标准时间</strong>
        <p>仅按固定 UTC+8 计算；不做出生地时区、历史夏令时或真太阳时换算。</p>
      </div>
      <div class="solar-input-row">
        <label class="field-control">
          <span>公历出生日期与时间</span>
          <input :id="`${idPrefix}-solar-datetime`" v-model="solarLocalDateTime" type="datetime-local" min="1901-01-01T00:00" max="2099-12-31T23:59">
        </label>
        <button type="button" class="secondary-action" @click="calculateFromSolar">计算并填入四柱</button>
      </div>
      <div v-if="calendarResolution" class="calendar-resolution" role="status" aria-live="polite" :class="`is-${calendarResolution.status}`">
        <template v-if="calendarResolution.status === 'resolved'">
          已填入：{{ formatFourPillars(calendarResolution.fourPillars) }}。请在下方复核后再分析。
        </template>
        <template v-else>
          {{ calendarResolution.message }}
          <span v-if="calendarResolution.status === 'boundary_unresolved' && calendarResolution.candidates.length">
            候选：{{ calendarResolution.candidates.map(formatFourPillars).join('；') }}。
          </span>
        </template>
      </div>
      <p class="solar-policy-note">交节前后、时辰交界和 23 时不会自动选盘；此功能是录入辅助，不代表历法结果已获独立权威校验。</p>
    </section>

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
