<script setup lang="ts">
import { MODULES, STATUS_LABELS } from "@/constants";
import type { AnalysisResponse } from "@/types";

const props = defineProps<{ result: AnalysisResponse }>();

function statusFor(moduleId: (typeof MODULES)[number]["id"]): string {
  switch (moduleId) {
    case "M0": return props.result.m0.status;
    case "M1": return props.result.relationship.m1.status;
    case "M2": return props.result.relationship.m2.status;
    case "M3": return props.result.relationship.m3.status;
    case "M4": return props.result.relationship.m4.status;
    case "M5": return props.result.relationship.m5.reportStatus;
  }
  throw new Error(`未知模块：${moduleId}`);
}
</script>

<template>
  <nav class="module-rail" aria-label="分析链路">
    <a v-for="module in MODULES" :key="module.id" :href="`#result-${module.id.toLowerCase()}`" class="module-stop">
      <span class="module-knot" aria-hidden="true">{{ module.id.slice(1) }}</span>
      <span class="module-copy">
        <strong>{{ module.title }}</strong>
        <small>{{ module.note }}</small>
      </span>
      <span class="status-pill" :data-status="statusFor(module.id)">{{ STATUS_LABELS[statusFor(module.id)] ?? statusFor(module.id) }}</span>
    </a>
  </nav>
</template>
