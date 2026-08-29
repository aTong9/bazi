<script setup lang="ts">
import type { ObservationDraft } from "@/types";

defineProps<{
  chains: readonly { id: string; structuralCandidate: string }[];
}>();

const observations = defineModel<ObservationDraft[]>({ required: true });

const sources = [
  { value: "self_report", label: "本人观察" },
  { value: "partner_report", label: "另一方观察" },
  { value: "joint_record", label: "双方共同记录" },
  { value: "third_party_record", label: "第三方事实记录" },
] as const;

</script>

<template>
  <section id="observation-inputs" class="observation-panel" aria-labelledby="observation-title">
    <div class="section-heading compact">
      <div>
        <p class="eyebrow">候选事实核验</p>
        <h3 id="observation-title">风险链现实观察</h3>
      </div>
      <span class="boundary-chip">至少两份独立观察</span>
    </div>
    <p class="section-intro">
      结构风险不是已经发生的事实。每条候选可补两份不同来源或不同情境的观察；空白行不会发送，也不会被计为证据。
    </p>

    <article v-for="chain in chains" :key="chain.id" class="observation-chain">
      <header>
        <code>{{ chain.id }}</code>
        <p>{{ chain.structuralCandidate }}</p>
      </header>

      <div
        v-for="observation in observations.filter((item) => item.chainId === chain.id)"
        :key="`${chain.id}-${observation.slot}`"
        class="observation-entry"
      >
        <span class="observation-number">观察 {{ observation.slot + 1 }}</span>
        <label>
          <span>来源</span>
          <select v-model="observation.source" :aria-label="`${chain.id} 观察 ${observation.slot + 1} 来源`">
            <option v-for="source in sources" :key="source.value" :value="source.value">{{ source.label }}</option>
          </select>
        </label>
        <label>
          <span>方向</span>
          <select v-model="observation.direction" :aria-label="`${chain.id} 观察 ${observation.slot + 1} 方向`">
            <option value="supports">支持候选</option>
            <option value="contradicts">构成反证</option>
          </select>
        </label>
        <label class="observation-context">
          <span>可观察事实</span>
          <input
            v-model.trim="observation.context"
            type="text"
            :aria-label="`${chain.id} 观察 ${observation.slot + 1} 的事实`"
            placeholder="写发生了什么、处于什么情境，不写人格判断"
          />
        </label>
      </div>
    </article>
  </section>
</template>
