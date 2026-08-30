<script setup lang="ts">
import { computed } from "vue";

import { GRADE_COPY, STATUS_LABELS } from "@/constants";
import { formatBirthInputSource, formatSubjectPillars, resultValue, shortDigest } from "@/domain";
import type { AnalysisMode, AnalysisResponse, ResultItem, SubjectDraft } from "@/types";
import ModuleRail from "./ModuleRail.vue";
import M0EvidenceAppendix from "./M0EvidenceAppendix.vue";

const props = withDefaults(defineProps<{
  result: AnalysisResponse;
  canAddObservations?: boolean;
  primarySubject?: SubjectDraft | null;
  secondarySubject?: SubjectDraft | null;
  hasSecondarySubject?: boolean;
  analysisMode?: AnalysisMode;
  saveState?: "new" | "saved" | "dirty";
  actionsDisabled?: boolean;
}>(), {
  canAddObservations: false,
  primarySubject: null,
  secondarySubject: null,
  hasSecondarySubject: false,
  analysisMode: "profile",
  saveState: "new",
  actionsDisabled: false,
});
const emit = defineEmits<{ download: []; downloadSummary: []; print: []; save: [] }>();

interface DayMasterView { dayMaster?: string; element?: string; yinYang?: string; monthBranch?: string; seasonElement?: string }
interface ClimateView { state?: string; evidence?: string[]; candidateElements?: string[] }
interface UseDecision { element?: string; classification?: string; role?: string; doseBoundary?: string[] }

const isSafetyStop = computed(() => props.result.report.safetyStatus === "safety_stop");
const gradeCopy = computed(() => GRADE_COPY[props.result.report.evidenceGrade] ?? { title: "证据状态", detail: "请结合报告边界阅读。" });
const dayMaster = computed(() => resultValue<DayMasterView>(props.result.m0.fields, "day_master_and_season"));
const strength = computed(() => resultValue<string>(props.result.m0.fields, "day_master_strength"));
const temperature = computed(() => resultValue<ClimateView>(props.result.m0.fields, "temperature_state"));
const moisture = computed(() => resultValue<ClimateView>(props.result.m0.fields, "moisture_state"));
const uses = computed(() => resultValue<{ primary?: UseDecision[]; auxiliary?: UseDecision[] }>(props.result.m0.fields, "primary_and_auxiliary_use"));
const allUses = computed(() => [...(uses.value?.primary ?? []), ...(uses.value?.auxiliary ?? [])].slice(0, 5));
const secondaryDayMaster = computed(() => {
  const fields = props.result.relationship.structuralSupplement.fields;
  return fields ? resultValue<DayMasterView>(fields, "day_master_and_season") : null;
});
const secondaryStrength = computed(() => {
  const fields = props.result.relationship.structuralSupplement.fields;
  return fields ? resultValue<string>(fields, "day_master_strength") : null;
});
const reportSections = computed(() => isSafetyStop.value ? props.result.report.sections.filter((section) => section.id === "safety") : props.result.report.sections);
const primaryPillars = computed(() => props.primarySubject ? formatSubjectPillars(props.primarySubject) : "未记录");
const secondaryPillars = computed(() => props.hasSecondarySubject && props.secondarySubject ? formatSubjectPillars(props.secondarySubject) : null);
const primaryLabel = computed(() => props.primarySubject?.subjectId.trim() || "主要命盘");
const secondaryLabel = computed(() => props.secondarySubject?.subjectId.trim() || "另一方命盘");
const saveLabel = computed(() => props.saveState === "saved" ? "已保存到档案" : props.saveState === "dirty" ? "更新档案" : "保存到档案");

function label(value: string | undefined): string { return value ? STATUS_LABELS[value] ?? value.replaceAll("_", " ") : "未形成"; }
function item(key: string): ResultItem | undefined { return props.result.m0.fields[key]; }
function list(values: readonly string[] | undefined, fallback = "当前没有形成稳定陈述。"): string[] {
  const filtered = values?.filter(Boolean).slice(0, 5) ?? [];
  return filtered.length ? filtered : [fallback];
}
</script>

<template>
  <article class="analysis-result" aria-live="polite">
    <header class="result-mast" :class="{ 'is-safety': isSafetyStop }">
      <div>
        <p class="eyebrow">本次分析 · {{ result.report.assessment }}</p>
        <h2 tabindex="-1">{{ gradeCopy.title }}</h2>
        <p>{{ gradeCopy.detail }}</p>
      </div>
      <div class="grade-seal" :aria-label="`证据发布等级 ${result.report.evidenceGrade}`">
        <span>{{ result.report.evidenceGrade }}</span>
        <small>证据发布等级</small>
      </div>
      <div class="result-tools">
        <button type="button" class="quiet-button" :disabled="actionsDisabled || saveState === 'saved'" @click="emit('save')">{{ saveLabel }}</button>
        <button type="button" class="quiet-button" :disabled="actionsDisabled" @click="emit('print')">打印 / 存 PDF</button>
        <button type="button" class="quiet-button" :disabled="actionsDisabled" @click="emit('downloadSummary')">下载可读摘要</button>
        <button type="button" class="quiet-button" :disabled="actionsDisabled" @click="emit('download')">下载完整 JSON</button>
      </div>
      <p v-if="actionsDisabled" class="inline-notice" role="status">独立现实观察尚未进入当前结果，请再次评估后再保存、打印或导出。</p>
      <dl class="result-context" aria-label="本次看盘输入摘要">
        <div><dt>分析方式</dt><dd>{{ analysisMode === 'evaluate' ? '现实评估' : '关系画像' }}</dd></div>
        <div><dt>主要命盘</dt><dd>{{ primaryLabel }} · {{ primaryPillars }}</dd></div>
        <div v-if="primarySubject"><dt>主要命盘来源</dt><dd>{{ formatBirthInputSource(primarySubject) }}</dd></div>
        <div v-if="secondaryPillars"><dt>另一方命盘</dt><dd>{{ secondaryLabel }} · {{ secondaryPillars }}</dd></div>
        <div v-if="secondaryPillars && secondarySubject"><dt>另一方命盘来源</dt><dd>{{ formatBirthInputSource(secondarySubject) }}</dd></div>
        <div><dt>分析 ID</dt><dd>{{ result.requestId }}</dd></div>
        <div><dt>规则快照</dt><dd>{{ result.rulesetDigest }}</dd></div>
        <div><dt>生成时间</dt><dd>{{ new Date(result.generatedAt).toLocaleString('zh-CN') }}</dd></div>
      </dl>
    </header>

    <section v-if="isSafetyStop" class="safety-only" aria-labelledby="safety-title">
      <span class="safety-mark" aria-hidden="true">止</span>
      <div>
        <p class="eyebrow">现实安全优先</p>
        <h3 id="safety-title">普通适配叙事已停止</h3>
        <p v-for="section in reportSections" :key="section.id">{{ section.body }}</p>
        <ul class="boundary-list">
          <li v-for="boundary in result.report.boundaries" :key="boundary.code">{{ boundary.text }}</li>
        </ul>
      </div>
    </section>

    <template v-else>
      <ModuleRail :result="result" />

      <section class="report-prose" aria-labelledby="report-title">
        <div class="section-heading">
          <div><p class="eyebrow">先读结论</p><h3 id="report-title">关系结构报告</h3></div>
          <span class="boundary-chip">不是命定结果</span>
        </div>
        <article v-for="section in reportSections" :key="section.id" class="prose-section">
          <h4>{{ section.title }}</h4>
          <p>{{ section.body }}</p>
        </article>
      </section>

      <section id="result-m0" class="result-section" aria-labelledby="m0-title">
        <div class="section-index">M0</div>
        <div class="section-body">
          <div class="section-heading compact">
            <div><p class="eyebrow">静态底盘</p><h3 id="m0-title">原局结构</h3></div>
            <span class="status-pill" :data-status="result.m0.status">{{ label(result.m0.status) }}</span>
          </div>
          <div class="metric-strip">
            <div><small>日主</small><strong>{{ dayMaster?.dayMaster ?? "—" }}</strong><span>{{ label(dayMaster?.yinYang) }}{{ dayMaster?.element }}</span></div>
            <div><small>月支 / 季节</small><strong>{{ dayMaster?.monthBranch ?? "—" }}</strong><span>{{ dayMaster?.seasonElement ?? "待核" }}</span></div>
            <div><small>日主强弱</small><strong>{{ label(strength ?? undefined) }}</strong><span>{{ label(item('day_master_strength')?.confidence) }}置信</span></div>
            <div><small>气候双轴</small><strong>{{ label(temperature?.state) }}</strong><span>湿度 {{ label(moisture?.state) }}</span></div>
          </div>
          <div v-if="allUses.length" class="use-lines">
            <p class="subheading">五行作用候选</p>
            <div v-for="use in allUses" :key="`${use.element}-${use.classification}`" class="use-line">
              <strong>{{ use.element }}</strong><span>{{ label(use.classification) }}</span><small>{{ use.doseBoundary?.slice(0, 2).map((boundary) => label(boundary)).join("；") ?? "保留条件边界" }}</small>
            </div>
          </div>
          <aside v-if="result.relationship.structuralSupplement.available" class="structural-supplement">
            <div>
              <p class="eyebrow">双盘辅助</p>
              <h4>另一方结构补充</h4>
              <p>只用于补充双方结构背景，不替代现实行为、同意、安全事实或八道现实闸门。</p>
            </div>
            <dl>
              <div><dt>日主</dt><dd>{{ secondaryDayMaster?.dayMaster ?? "—" }} · {{ label(secondaryDayMaster?.yinYang) }}{{ secondaryDayMaster?.element }}</dd></div>
              <div><dt>日主强弱</dt><dd>{{ label(secondaryStrength ?? undefined) }}</dd></div>
            </dl>
          </aside>
          <M0EvidenceAppendix :fields="result.m0.fields" />
        </div>
      </section>

      <section id="result-m1" class="result-section" aria-labelledby="m1-title">
        <div class="section-index">M1</div>
        <div class="section-body">
          <div class="section-heading compact"><div><p class="eyebrow">进入关系之前</p><h3 id="m1-title">吸引入口</h3></div><span class="status-pill" :data-status="result.relationship.m1.status">{{ label(result.relationship.m1.status) }}</span></div>
          <p v-if="result.relationship.m1.status === 'dependency_pending'" class="inline-notice">未指定传统角色口径，因此本节保留为等待依赖；其他可用部分仍可阅读。</p>
          <div v-else class="statement-list">
            <p v-for="statement in list(result.relationship.m1.synthesis.statements)" :key="statement">{{ statement }}</p>
          </div>
          <div class="signal-row"><span v-for="signal in result.relationship.m1.synthesis.primarySignals" :key="signal">{{ signal }}</span></div>
        </div>
      </section>

      <section id="result-m2" class="result-section" aria-labelledby="m2-title">
        <div class="section-index">M2</div>
        <div class="section-body">
          <div class="section-heading compact"><div><p class="eyebrow">确认与选择</p><h3 id="m2-title">关系选择机制</h3></div><span class="status-pill" :data-status="result.relationship.m2.status">{{ label(result.relationship.m2.status) }}</span></div>
          <div class="two-column-copy">
            <div><small>入口主题</small><p>{{ list(result.relationship.m2.gate.themes).join("；") }}</p></div>
            <div><small>确认节奏</small><p>{{ label(result.relationship.m2.tempo.class) }} · {{ result.relationship.m2.tempo.evidenceRounds }} 轮证据</p></div>
          </div>
          <ul class="plain-list"><li v-for="line in list(result.relationship.m2.synthesis.summary)" :key="line">{{ line }}</li></ul>
        </div>
      </section>

      <section id="result-m3" class="result-section" aria-labelledby="m3-title">
        <div class="section-index">M3</div>
        <div class="section-body">
          <div class="section-heading compact"><div><p class="eyebrow">进入关系之后</p><h3 id="m3-title">相处惯性与修复</h3></div><span class="status-pill" :data-status="result.relationship.m3.status">{{ label(result.relationship.m3.status) }}</span></div>
          <div class="state-line"><span>当前结构状态</span><strong>{{ label(result.relationship.m3.state.activeState) }}</strong></div>
          <div class="statement-list"><p v-for="statement in list(result.relationship.m3.synthesis.statements)" :key="statement">{{ statement }}</p></div>
          <details class="evidence-details"><summary>查看修复步骤</summary><ol><li v-for="step in result.relationship.m3.repair.steps" :key="step">{{ label(step) }}</li></ol></details>
        </div>
      </section>

      <section id="result-m4" class="result-section" aria-labelledby="m4-title">
        <div class="section-index">M4</div>
        <div class="section-body">
          <div class="section-heading compact"><div><p class="eyebrow">候选，不是事实</p><h3 id="m4-title">风险链与保护因素</h3></div><span class="status-pill" data-status="candidate">结构候选</span></div>
          <article v-for="chain in result.relationship.m4.riskChains" :key="chain.id" class="risk-line">
            <div><code>{{ chain.id }}</code><span class="status-pill" :data-status="chain.realityStatus">{{ label(chain.realityStatus) }}</span></div>
            <p>{{ chain.structuralCandidate }}</p>
            <small>保护条件：{{ chain.buffer.conditions.join("、") }}</small>
          </article>
          <a v-if="canAddObservations" class="observation-link" href="#observation-inputs">补充独立现实观察，再次评估</a>
        </div>
      </section>

      <section id="result-m5" class="result-section" aria-labelledby="m5-title">
        <div class="section-index">M5</div>
        <div class="section-body">
          <div class="section-heading compact"><div><p class="eyebrow">现实先行</p><h3 id="m5-title">适配闸门</h3></div><span class="status-pill" :data-status="result.relationship.m5.safetyStatus">{{ label(result.relationship.m5.safetyStatus) }}</span></div>
          <div class="result-gates">
            <div v-for="gate in result.relationship.m5.realityGates" :key="gate.id" class="result-gate" :data-status="gate.status">
              <span>{{ gate.id }}</span><strong>{{ gate.label }}</strong><small>{{ label(gate.status) }}</small>
            </div>
          </div>
          <div v-if="result.report.observationPlan.length" class="observation-plan">
            <p class="subheading">下一步可观察</p>
            <p v-for="observation in result.report.observationPlan" :key="observation.gateId"><strong>{{ observation.gateId }}</strong>{{ observation.observe }}</p>
          </div>
        </div>
      </section>

      <footer class="result-boundaries">
        <p class="eyebrow">阅读边界</p>
        <ul><li v-for="boundary in result.report.boundaries" :key="boundary.code">{{ boundary.text }}</li></ul>
      </footer>
    </template>

    <details class="technical-trace">
      <summary>技术追踪</summary>
      <dl>
        <div><dt>分析 ID</dt><dd>{{ result.requestId }}</dd></div>
        <div><dt>规则快照</dt><dd :title="result.rulesetDigest">{{ shortDigest(result.rulesetDigest) }}</dd></div>
        <div><dt>规则命中</dt><dd>{{ result.ruleTrace.length + result.relationship.ruleTrace.length }} 条</dd></div>
        <div><dt>生成时间</dt><dd>{{ new Date(result.generatedAt).toLocaleString('zh-CN') }}</dd></div>
      </dl>
    </details>
  </article>
</template>
