<script setup lang="ts">
import { computed } from "vue";

import { STATUS_LABELS } from "@/constants";
import { formatBirthInputSource, formatSubjectPillars, resultValue, shortDigest } from "@/domain";
import type { M0AnalysisResponse, ResultItem, SubjectDraft } from "@/types";

const props = withDefaults(defineProps<{ result: M0AnalysisResponse; subject: SubjectDraft; saveState?: "new" | "saved" | "dirty" }>(), { saveState: "new" });
const emit = defineEmits<{ download: []; downloadSummary: []; print: []; save: [] }>();

interface DayMasterView { dayMaster?: string; element?: string; yinYang?: string; monthBranch?: string; seasonElement?: string }
interface ClimateView { state?: string }
interface UseDecision { element?: string; classification?: string; doseBoundary?: string[] }

const dayMaster = computed(() => resultValue<DayMasterView>(props.result.m0.fields, "day_master_and_season"));
const strength = computed(() => resultValue<string>(props.result.m0.fields, "day_master_strength"));
const temperature = computed(() => resultValue<ClimateView>(props.result.m0.fields, "temperature_state"));
const moisture = computed(() => resultValue<ClimateView>(props.result.m0.fields, "moisture_state"));
const uses = computed(() => resultValue<{ primary?: UseDecision[]; auxiliary?: UseDecision[] }>(props.result.m0.fields, "primary_and_auxiliary_use"));
const allUses = computed(() => [...(uses.value?.primary ?? []), ...(uses.value?.auxiliary ?? [])].slice(0, 5));

function label(value: string | undefined): string { return value ? STATUS_LABELS[value] ?? value.replaceAll("_", " ") : "未形成"; }
function item(key: string): ResultItem | undefined { return props.result.m0.fields[key]; }
const saveLabel = computed(() => props.saveState === "saved" ? "已保存到档案" : props.saveState === "dirty" ? "更新档案" : "保存到档案");
</script>

<template>
  <article class="analysis-result m0-only-result" aria-live="polite">
    <header class="result-mast">
      <div>
        <p class="eyebrow">本次分析 · 仅原局结构</p>
        <h2 tabindex="-1">原局结构已生成</h2>
        <p>只呈现 M0 静态底盘，不推断关系对象、适配结论或现实事件。</p>
      </div>
      <div class="grade-seal" :aria-label="`M0 状态 ${result.m0.status}`"><span>M0</span><small>{{ label(result.m0.status) }}</small></div>
      <div class="result-tools">
        <button type="button" class="quiet-button" :disabled="saveState === 'saved'" @click="emit('save')">{{ saveLabel }}</button>
        <button type="button" class="quiet-button" @click="emit('print')">打印 / 存 PDF</button>
        <button type="button" class="quiet-button" @click="emit('downloadSummary')">下载可读摘要</button>
        <button type="button" class="quiet-button" @click="emit('download')">下载完整 JSON</button>
      </div>
      <dl class="result-context" aria-label="本次原局输入摘要">
        <div><dt>分析方式</dt><dd>原局结构</dd></div>
        <div><dt>主要命盘</dt><dd>{{ subject.subjectId.trim() || '主要命盘' }} · {{ formatSubjectPillars(subject) }}</dd></div>
        <div><dt>输入来源</dt><dd>{{ formatBirthInputSource(subject) }}</dd></div>
        <div><dt>分析 ID</dt><dd>{{ result.requestId }}</dd></div>
        <div><dt>规则快照</dt><dd>{{ result.rulesetDigest }}</dd></div>
        <div><dt>生成时间</dt><dd>{{ new Date(result.generatedAt).toLocaleString('zh-CN') }}</dd></div>
      </dl>
    </header>

    <section id="result-m0" class="result-section" aria-labelledby="m0-title">
      <div class="section-index">M0</div>
      <div class="section-body">
        <div class="section-heading compact">
          <div><p class="eyebrow">静态底盘</p><h3 id="m0-title">原局结构</h3></div>
          <span class="status-pill" :data-status="result.m0.status">{{ label(result.m0.status) }}</span>
        </div>
        <div class="metric-strip">
          <div><small>日主</small><strong>{{ dayMaster?.dayMaster ?? '—' }}</strong><span>{{ label(dayMaster?.yinYang) }}{{ dayMaster?.element }}</span></div>
          <div><small>月支 / 季节</small><strong>{{ dayMaster?.monthBranch ?? '—' }}</strong><span>{{ dayMaster?.seasonElement ?? '待核' }}</span></div>
          <div><small>日主强弱</small><strong>{{ label(strength ?? undefined) }}</strong><span>{{ label(item('day_master_strength')?.confidence) }}置信</span></div>
          <div><small>气候双轴</small><strong>{{ label(temperature?.state) }}</strong><span>湿度 {{ label(moisture?.state) }}</span></div>
        </div>
        <div v-if="allUses.length" class="use-lines">
          <p class="subheading">五行作用候选</p>
          <div v-for="use in allUses" :key="`${use.element}-${use.classification}`" class="use-line">
            <strong>{{ use.element }}</strong><span>{{ label(use.classification) }}</span><small>{{ use.doseBoundary?.slice(0, 2).map(label).join('；') || '保留条件边界' }}</small>
          </div>
        </div>
        <details class="evidence-details">
          <summary>查看 M0 字段证据</summary>
          <div class="evidence-grid">
            <div v-for="key in ['overall_confidence','roots_and_exposure','identified_relations','pattern_candidates','root_disease','final_structure_summary']" :key="key">
              <code>{{ key }}</code><span>{{ label(item(key)?.status) }} · {{ label(item(key)?.confidence) }}</span>
            </div>
          </div>
        </details>
      </div>
    </section>

    <footer class="result-boundaries">
      <p class="eyebrow">阅读边界</p>
      <ul><li>本结果只描述静态原局结构，不评价具体关系对象。</li><li>未知、低资料质量和时辰缺失会保留为限制，不补成确定结论。</li></ul>
    </footer>
    <details class="technical-trace">
      <summary>技术追踪</summary>
      <dl><div><dt>分析 ID</dt><dd>{{ result.requestId }}</dd></div><div><dt>规则快照</dt><dd :title="result.rulesetDigest">{{ shortDigest(result.rulesetDigest) }}</dd></div><div><dt>规则命中</dt><dd>{{ result.ruleTrace.length }} 条</dd></div></dl>
    </details>
  </article>
</template>
