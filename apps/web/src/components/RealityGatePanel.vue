<script setup lang="ts">
import type { CrossStateDraft, CrossStateKey, RealityGateDraft, RealityGateStatus } from "@/types";

const gates = defineModel<RealityGateDraft[]>("gates", { required: true });
const crossState = defineModel<CrossStateDraft>("crossState", { required: true });

const statuses = [
  { value: "not_assessed", label: "未评估" },
  { value: "unknown", label: "未知" },
  { value: "pass", label: "通过" },
  { value: "conditional", label: "有条件" },
  { value: "fail", label: "未通过" },
] as const;

const crossStates = [
  { key: "steady", label: "日常稳定期", placeholder: "例如：连续数周的日常安排记录" },
  { key: "pressure", label: "压力情境", placeholder: "例如：工作高压期的具体互动事实" },
  { key: "repair", label: "分歧修复后", placeholder: "例如：一次分歧后的修复行为与结果" },
  { key: "turningPoint", label: "生活转折期", placeholder: "例如：搬迁或职业变化期的共同应对" },
  { key: "counterevidenceReviewed", label: "已主动检查反例", placeholder: "写明检查了什么反例及发现" },
] as const satisfies readonly { key: CrossStateKey; label: string; placeholder: string }[];

function requiresEvidence(status: RealityGateStatus): boolean {
  return status === "pass" || status === "conditional" || status === "fail";
}

function updateCrossState(key: CrossStateKey): void {
  if (!crossState.value[key]) crossState.value.evidence[key] = "";
}
</script>

<template>
  <section class="reality-panel" aria-labelledby="reality-title">
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">现实证据</p>
        <h3 id="reality-title">八道关系闸门</h3>
      </div>
      <span class="boundary-chip">现实优先于结构</span>
    </div>
    <p class="section-intro">只填写你能由现实行为支持的部分。未知不是失败，留空比猜测更可靠。</p>

    <div class="gate-list">
      <article v-for="(gate, index) in gates" :key="gate.id" class="gate-row">
        <div class="gate-identity">
          <span class="gate-index">{{ gate.id }}</span>
          <label :for="`gate-${gate.id}`">{{ gate.label }}</label>
        </div>
        <select :id="`gate-${gate.id}`" v-model="gate.status" :aria-label="`${gate.label}状态`">
          <option v-for="status in statuses" :key="status.value" :value="status.value">{{ status.label }}</option>
        </select>
        <input
          v-model.trim="gate.note"
          type="text"
          :aria-label="`${gate.label}的事实依据`"
          :aria-describedby="`gate-${gate.id}-help`"
          :aria-invalid="requiresEvidence(gate.status) && !gate.note.trim()"
          :required="requiresEvidence(gate.status)"
          :placeholder="index === 0 ? '例如：双方能自由表达并撤回同意' : '写一句已经发生的可观察事实'"
        />
        <p :id="`gate-${gate.id}-help`" class="evidence-requirement" :class="{ 'is-required': requiresEvidence(gate.status) && !gate.note.trim() }">
          {{ requiresEvidence(gate.status) ? "此状态必须填写具体事实依据；空白会按未知处理。" : "选择通过、有条件或未通过时，事实依据为必填。" }}
        </p>
      </article>
    </div>

    <details class="cross-state">
      <summary>跨情境核验</summary>
      <p>只有在不同状态下都观察过，才勾选。全选不代表关系成功，只提高证据覆盖。</p>
      <div class="check-grid">
        <div v-for="item in crossStates" :key="item.key" class="cross-state-item">
          <label :for="`cross-${item.key}`"><input :id="`cross-${item.key}`" v-model="crossState[item.key]" type="checkbox" @change="updateCrossState(item.key)" /> {{ item.label }}</label>
          <label v-if="crossState[item.key]" class="cross-evidence" :for="`cross-${item.key}-evidence`">
            <span>事实依据（必填）</span>
            <input
              :id="`cross-${item.key}-evidence`"
              v-model.trim="crossState.evidence[item.key]"
              type="text"
              required
              :aria-invalid="!crossState.evidence[item.key].trim()"
              :placeholder="item.placeholder"
            />
          </label>
        </div>
      </div>
    </details>
  </section>
</template>
