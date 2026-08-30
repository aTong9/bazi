<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { analyzeRelationship, ApiError, fetchHealth } from "@/api";
import { deleteArchive, importArchiveBackup, loadArchives, saveArchive, serializeArchiveBackup } from "@/archive-store";
import { REALITY_GATES } from "@/constants";
import { analysisInputFingerprint, riskCandidateFingerprint, toWireCrossState, toWireObservations, toWireRealityGates, toWireSubject } from "@/domain";
import AnalysisResult from "@/components/AnalysisResult.vue";
import ArchivePanel from "@/components/ArchivePanel.vue";
import ObservationPanel from "@/components/ObservationPanel.vue";
import PillarEditor from "@/components/PillarEditor.vue";
import RealityGatePanel from "@/components/RealityGatePanel.vue";
import type { AnalysisArchive, AnalysisMode, AnalysisResponse, AnalysisWorkspaceSnapshot, CrossStateDraft, HealthResponse, ObservationDraft, RealityGateDraft, RoleBasis, SubjectDraft } from "@/types";

const primarySubject = ref<SubjectDraft>(createSubject("主命盘"));
const secondarySubject = ref<SubjectDraft>(createSubject("另一方", { year: "己巳", month: "丙寅", day: "乙卯", hour: "丙子" }));
const analysisMode = ref<AnalysisMode>("profile");
const roleBasis = ref<RoleBasis>("female_traditional");
const hasSecondarySubject = ref(false);
const gates = ref<RealityGateDraft[]>(REALITY_GATES.map((gate) => ({ ...gate, status: "not_assessed", note: "" })));
const crossState = ref<CrossStateDraft>(createCrossState());
const observations = ref<ObservationDraft[]>([]);
const result = ref<AnalysisResponse | null>(null);
const health = ref<HealthResponse | null>(null);
const healthError = ref(false);
const isLoading = ref(false);
const errorMessage = ref("");
const errorDetails = ref<string[]>([]);
const archives = ref<AnalysisArchive[]>([]);
const archivesOpen = ref(false);
const archiveNotice = ref("");
let activeRequest: AbortController | null = null;
let resultFingerprint: string | null = null;

const isEvaluate = computed(() => analysisMode.value === "evaluate");
const submitLabel = computed(() => isEvaluate.value ? "生成现实评估" : "生成关系画像");
const currentInputFingerprint = computed(() => analysisInputFingerprint({
  analysisMode: analysisMode.value,
  roleBasis: roleBasis.value,
  primarySubject: primarySubject.value,
  hasSecondarySubject: hasSecondarySubject.value,
  secondarySubject: secondarySubject.value,
  gates: gates.value,
  crossState: crossState.value,
}));
const observableRiskChains = computed(() => {
  if (!result.value || result.value.report.safetyStatus === "safety_stop") return [];
  return result.value.relationship.m4.riskChains;
});

watch(
  () => result.value?.relationship.m4.riskChains,
  (chains) => {
    const currentResult = result.value;
    if (!currentResult) return;
    if (!chains?.length || !resultFingerprint || !isEvaluate.value) {
      observations.value = [];
      return;
    }
    const basisFingerprint = resultFingerprint;
    const previous = new Map(observations.value.map((observation) => [`${observation.chainId}:${observation.slot}`, observation]));
    observations.value = chains.flatMap((chain) => ([0, 1] as const).map((slot) => {
      const existing = previous.get(`${chain.id}:${slot}`);
      const candidateFingerprint = riskCandidateFingerprint(chain);
      const canReuse = existing?.basisFingerprint === basisFingerprint && existing.candidateFingerprint === candidateFingerprint;
      return {
        chainId: chain.id,
        slot,
        source: canReuse ? existing.source : slot === 0 ? "self_report" : "partner_report",
        context: canReuse ? existing.context : "",
        direction: canReuse ? existing.direction : "supports",
        basisFingerprint,
        candidateFingerprint,
        basisRequestId: currentResult.requestId,
      };
    }));
  },
);

watch(currentInputFingerprint, (fingerprint, previousFingerprint) => {
  if (fingerprint === previousFingerprint) return;
  const hasStaleResult = resultFingerprint !== null && resultFingerprint !== fingerprint;
  const hasStaleObservations = observations.value.some((observation) => observation.basisFingerprint !== fingerprint);
  if (!hasStaleResult && !hasStaleObservations) return;
  activeRequest?.abort();
  resultFingerprint = null;
  result.value = null;
  observations.value = [];
});

onMounted(() => {
  archives.value = loadArchives();
  void refreshHealth();
});
onBeforeUnmount(() => activeRequest?.abort());

async function refreshHealth(): Promise<void> {
  try {
    health.value = await fetchHealth();
    healthError.value = false;
  } catch {
    healthError.value = true;
  }
}

async function submitAnalysis(): Promise<void> {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  isLoading.value = true;
  errorMessage.value = "";
  errorDetails.value = [];
  const runId = Date.now().toString(36);
  const requestFingerprint = currentInputFingerprint.value;
  if (resultFingerprint !== null && resultFingerprint !== requestFingerprint) {
    resultFingerprint = null;
    result.value = null;
    observations.value = [];
  }
  const sourceResult = resultFingerprint === requestFingerprint ? result.value : null;
  const candidateFingerprints = new Map(sourceResult?.relationship.m4.riskChains.map((chain) => [chain.id, riskCandidateFingerprint(chain)]) ?? []);
  const completedObservations = sourceResult ? toWireObservations(observations.value, runId, {
    basisFingerprint: requestFingerprint,
    basisRequestId: sourceResult.requestId,
    candidateFingerprints,
  }) : [];
  const realityGates = toWireRealityGates(gates.value, runId);
  const crossStatePayload = toWireCrossState(crossState.value, runId);
  const payload = {
    analysis_mode: "production",
    role_basis: roleBasis.value,
    subject: toWireSubject(primarySubject.value),
    ...(hasSecondarySubject.value ? { subject_b: toWireSubject(secondarySubject.value) } : {}),
    requested_sections: ["m0", "m1", "m2", "m3", "m4", "m5"],
    ...(isEvaluate.value ? {
      reality_gates: realityGates,
      cross_state_validation: crossStatePayload.validation,
      ...(crossStatePayload.evidence.length ? { cross_state_evidence: crossStatePayload.evidence } : {}),
      ...(completedObservations.length ? {
        observations: completedObservations,
      } : {}),
    } : {}),
  };
  try {
    const response = await analyzeRelationship(isEvaluate.value ? "/v1/relationship/evaluate" : "/v1/relationship/profile", payload, controller.signal);
    if (controller.signal.aborted || currentInputFingerprint.value !== requestFingerprint) return;
    resultFingerprint = requestFingerprint;
    result.value = response;
    if (healthError.value) void refreshHealth();
    await nextTick();
    document.querySelector<HTMLElement>(".result-mast h2")?.focus({ preventScroll: true });
    document.querySelector(".analysis-result")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  } catch (error) {
    if (controller.signal.aborted) return;
    if (error instanceof ApiError) {
      errorMessage.value = friendlyError(error);
      errorDetails.value = error.issues.map((issue) => `${issue.code} · ${issue.message}`);
      if (error.issues.some((issue) => issue.code === "E_HTTP")) healthError.value = true;
    } else {
      errorMessage.value = "无法连接分析服务。请确认 API 已启动后重试。";
      healthError.value = true;
    }
    await nextTick();
    document.querySelector<HTMLElement>(".error-summary")?.focus();
  } finally {
    if (activeRequest === controller) isLoading.value = false;
  }
}

function downloadResult(): void {
  if (!result.value) return;
  const blob = new Blob([`${JSON.stringify(result.value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bazi-relationship-${result.value.requestId}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function saveCurrentAnalysis(): void {
  if (!result.value) return;
  try {
    archives.value = saveArchive(currentWorkspace(result.value));
    archiveNotice.value = "本次看盘已保存到这台设备。";
  } catch {
    archiveNotice.value = "浏览器没有足够的本地存储空间，未能保存档案。";
  }
}

async function restoreArchive(archive: AnalysisArchive): Promise<void> {
  activeRequest?.abort();
  const workspace = cloneJson(archive.workspace);
  analysisMode.value = workspace.analysisMode;
  roleBasis.value = workspace.roleBasis;
  primarySubject.value = workspace.primarySubject;
  secondarySubject.value = workspace.secondarySubject;
  hasSecondarySubject.value = workspace.hasSecondarySubject;
  gates.value = workspace.gates;
  crossState.value = workspace.crossState;
  observations.value = workspace.observations;
  await nextTick();
  resultFingerprint = currentInputFingerprint.value;
  result.value = workspace.result;
  archivesOpen.value = false;
  archiveNotice.value = `已打开“${archive.title}”。`;
  await nextTick();
  document.querySelector<HTMLElement>(".result-mast h2")?.focus({ preventScroll: true });
}

function removeArchive(id: string): void {
  try {
    archives.value = deleteArchive(id);
    archiveNotice.value = "档案已从这台设备删除。";
  } catch {
    archiveNotice.value = "档案删除失败，请检查浏览器存储权限。";
  }
}

function exportArchives(): void {
  if (!archives.value.length) return;
  try {
    const blob = new Blob([serializeArchiveBackup(archives.value)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bazi-reading-archives-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    archiveNotice.value = `已导出 ${archives.value.length} 份档案；文件未加密，请妥善保管。`;
  } catch {
    archiveNotice.value = "档案导出失败，请重试。";
  }
}

async function importArchives(file: File): Promise<void> {
  if (file.size > 20_000_000) {
    archiveNotice.value = "备份文件超过 20 MB，未执行导入。";
    return;
  }
  try {
    const imported = importArchiveBackup(await file.text());
    archives.value = imported.archives;
    archiveNotice.value = `导入完成：新增 ${imported.added}，更新 ${imported.updated}，跳过 ${imported.skipped}。`;
  } catch (error) {
    archiveNotice.value = error instanceof Error ? error.message : "备份导入失败。";
  }
}

function currentWorkspace(analysisResult: AnalysisResponse): AnalysisWorkspaceSnapshot {
  return {
    analysisMode: analysisMode.value,
    roleBasis: roleBasis.value,
    primarySubject: cloneJson(primarySubject.value),
    secondarySubject: cloneJson(secondarySubject.value),
    hasSecondarySubject: hasSecondarySubject.value,
    gates: cloneJson(gates.value),
    crossState: cloneJson(crossState.value),
    observations: cloneJson(observations.value),
    result: cloneJson(analysisResult),
  };
}

function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function resetWorkspace(): void {
  activeRequest?.abort();
  primarySubject.value = createSubject("主命盘");
  secondarySubject.value = createSubject("另一方", { year: "己巳", month: "丙寅", day: "乙卯", hour: "丙子" });
  gates.value = REALITY_GATES.map((gate) => ({ ...gate, status: "not_assessed", note: "" }));
  crossState.value = createCrossState();
  observations.value = [];
  hasSecondarySubject.value = false;
  resultFingerprint = null;
  result.value = null;
  errorMessage.value = "";
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function createSubject(subjectId: string, overrides: Partial<Pick<SubjectDraft, "year" | "month" | "day" | "hour">> = {}): SubjectDraft {
  return { subjectId, year: "庚申", month: "己丑", day: "甲寅", hour: "庚午", birthTimeStatus: "exact", dataQuality: "high", ...overrides };
}

function createCrossState(): CrossStateDraft {
  return {
    steady: false,
    pressure: false,
    repair: false,
    turningPoint: false,
    counterevidenceReviewed: false,
    evidence: { steady: "", pressure: "", repair: "", turningPoint: "", counterevidenceReviewed: "" },
  };
}

function friendlyError(error: ApiError): string {
  const codes = new Set(error.issues.map((issue) => issue.code));
  if (codes.has("E_FIVE_TIGERS_MISMATCH")) return "月柱与年柱不一致，请重新选择年柱或月柱。";
  if (codes.has("E_FIVE_RATS_MISMATCH")) return "时柱与日柱不一致，请重新选择日柱或时柱。";
  if (codes.has("E_INVALID_PILLAR")) return "存在无效干支，请检查四柱输入。";
  if (codes.has("E_EXACT_HOUR_REQUIRED")) return "出生时间标记为准确时，必须提供时柱。";
  if (codes.has("E_REQUEST_SCHEMA")) return "部分表单内容未通过校验，请检查后重试。";
  if (codes.has("E_HTTP")) return "分析服务暂时不可用。请确认 API 已启动后重试。";
  if (codes.has("E_RESPONSE_SCHEMA")) return "服务返回内容与当前界面版本不一致，请刷新页面或重启服务。";
  return error.message || "分析未完成，请检查输入后重试。";
}

function prefersReducedMotion(): boolean { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <a href="#top" class="brand" aria-label="关系脉络首页">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span><strong>关系脉络</strong><small>M0—M5 证据工作台</small></span>
      </a>
      <div class="service-state" :class="{ 'is-offline': healthError }" role="status">
        <span aria-hidden="true"></span>
        {{ healthError ? "分析服务未连接" : health ? `规则已就绪 · ${health.catalog.compiledRecords.toLocaleString('zh-CN')} 条` : "正在连接规则引擎" }}
      </div>
      <div class="header-actions">
        <button type="button" class="quiet-button" @click="archivesOpen = true">看盘档案 <span v-if="archives.length">{{ archives.length }}</span></button>
        <button type="button" class="quiet-button" @click="resetWorkspace">新建分析</button>
      </div>
    </header>

    <main id="analysis-workspace" class="workspace">
      <section id="top" class="intro-panel" aria-labelledby="page-title">
        <div class="intro-copy">
          <p class="eyebrow">静态关系结构 · 现实证据优先</p>
          <h1 id="page-title">从四柱到关系，<br /><em>把推断放回证据链。</em></h1>
          <p>输入已经排好的四柱，查看吸引入口、选择机制、相处惯性、风险候选和现实闸门。系统不预测命定对象，也不替你做关系决定。</p>
        </div>
        <div class="thesis-rail" aria-label="M0 到 M5 分析流程">
          <span v-for="index in 6" :key="index"><i>{{ index - 1 }}</i>{{ ['结构','吸引','选择','相处','风险','现实'][index - 1] }}</span>
        </div>
      </section>

      <div class="workbench">
        <form class="input-panel" aria-labelledby="input-title" :aria-busy="isLoading" @submit.prevent="submitAnalysis">
          <div class="panel-title">
            <div><p class="eyebrow">分析设置</p><h2 id="input-title">建立本次输入</h2></div>
            <span>中国标准时间（UTC+8）</span>
          </div>

          <fieldset class="mode-switch">
            <legend>分析方式</legend>
            <label :class="{ active: analysisMode === 'profile' }">
              <input v-model="analysisMode" type="radio" value="profile" />
              <strong>关系画像</strong><small>只读一张命盘的结构倾向</small>
            </label>
            <label :class="{ active: analysisMode === 'evaluate' }">
              <input v-model="analysisMode" type="radio" value="evaluate" />
              <strong>现实评估</strong><small>加入八道现实闸门</small>
            </label>
          </fieldset>

          <PillarEditor v-model="primarySubject" id-prefix="primary" title="主要命盘" description="当前版本只接受已经排好的四柱，不进行公历生日自动排盘。" />

          <fieldset class="role-basis">
            <legend>传统夫妻星计算口径</legend>
            <p class="field-help">这是明确的计算路径，不用于推断性别、身份或伴侣质量。</p>
            <label><input v-model="roleBasis" type="radio" value="female_traditional" /><span><strong>女性传统口径</strong><small>正官 / 七杀</small></span></label>
            <label><input v-model="roleBasis" type="radio" value="male_traditional" /><span><strong>男性传统口径</strong><small>正财 / 偏财</small></span></label>
            <label><input v-model="roleBasis" type="radio" value="unspecified" /><span><strong>暂不指定</strong><small>相关模块保留等待依赖</small></span></label>
          </fieldset>

          <div class="secondary-toggle">
            <label><input v-model="hasSecondarySubject" type="checkbox" /><span><strong>加入另一方命盘</strong><small>只作结构辅助，不替代现实证据</small></span></label>
          </div>
          <Transition name="fold">
            <PillarEditor v-if="hasSecondarySubject" v-model="secondarySubject" id-prefix="secondary" title="另一方命盘" description="双盘仅提供结构补充，不生成现实适配分数。" />
          </Transition>

          <Transition name="fold">
            <RealityGatePanel v-if="isEvaluate" v-model:gates="gates" v-model:cross-state="crossState" />
          </Transition>

          <Transition name="fold">
            <ObservationPanel
              v-if="isEvaluate && observableRiskChains.length"
              v-model="observations"
              :chains="observableRiskChains"
            />
          </Transition>

          <div v-if="errorMessage" class="error-summary" role="alert" tabindex="-1">
            <strong>{{ errorMessage }}</strong>
            <details v-if="errorDetails.length"><summary>查看技术信息</summary><ul><li v-for="detail in errorDetails" :key="detail">{{ detail }}</li></ul></details>
          </div>

          <div class="submit-bar">
            <div><span>输出范围</span><strong>M0—M5 全链路</strong></div>
            <button type="submit" class="primary-button" :disabled="isLoading">
              <span v-if="isLoading" class="spinner" aria-hidden="true"></span>
              {{ isLoading ? "正在沿证据链分析" : submitLabel }}
            </button>
          </div>
        </form>

        <section class="result-panel" aria-label="分析结果">
          <p v-if="archiveNotice" class="archive-notice" role="status">{{ archiveNotice }}</p>
          <AnalysisResult v-if="result" :result="result" :can-add-observations="isEvaluate" @save="saveCurrentAnalysis" @download="downloadResult" />
          <div v-else class="empty-result">
            <div class="empty-orbit" aria-hidden="true"><span>命</span><i></i><i></i><i></i><i></i><i></i></div>
            <p class="eyebrow">等待一次完整输入</p>
            <h2>结果会沿 M0—M5<br />逐层展开</h2>
            <p>先读边界，再读结构；先看现实，再看适配。未知和候选会被明确保留，不会被包装成确定答案。</p>
            <ul><li>45 项 M0 结构字段</li><li>吸引、选择与相处链路</li><li>现实闸门与安全停止</li><li>规则与快照追踪</li></ul>
          </div>
        </section>
      </div>
    </main>

    <footer class="app-footer">
      <p>关系脉络不是命运判决，也不替代安全、同意和现实决定。</p>
      <span v-if="health">规则快照 {{ health.catalog.rulesetDigest.slice(0, 10) }}</span>
    </footer>
    <ArchivePanel :open="archivesOpen" :archives="archives" :notice="archiveNotice" @close="archivesOpen = false" @restore="restoreArchive" @delete="removeArchive" @export="exportArchives" @import="importArchives" />
  </div>
</template>
