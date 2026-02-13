<script setup lang="ts">
import { defineProps, computed } from 'vue'
import type { ProofResult } from '../core/prover'

const props = defineProps<{
  results: { stmt: string; result: ProofResult }[]
}>()

const stats = computed(() => {
  const total = props.results.length
  const passed = props.results.filter(r => r.result.success).length
  const failed = total - passed
  return { total, passed, failed }
})
</script>

<template>
  <div class="prover-panel">
    <div class="prover-header">
      <span class="prover-icon">PRV</span>
      <span class="prover-title">Prover Results</span>
      <div v-if="results.length > 0" class="prover-stats">
        <span class="stat stat-passed">{{ stats.passed }} passed</span>
        <span v-if="stats.failed > 0" class="stat stat-failed">{{ stats.failed }} failed</span>
      </div>
    </div>

    <div class="prover-content">
      <div v-if="results.length === 0" class="prover-empty">
        <span>No statements to verify</span>
      </div>

      <div v-else class="results-list">
        <div
          v-for="(item, index) in results"
          :key="index"
          class="result-item"
          :class="{ success: item.result.success, failure: !item.result.success }"
        >
          <div class="result-header">
            <span class="result-status">
              {{ item.result.success ? '✓' : '✗' }}
            </span>
            <span class="result-stmt">{{ item.stmt }}</span>
          </div>
          <div class="result-message">
            {{ item.result.message }}
          </div>
          <div v-if="item.result.steps && item.result.steps.length > 0" class="result-steps">
            <div class="steps-header">Proof steps:</div>
            <ol class="steps-list">
              <li v-for="(step, stepIndex) in item.result.steps" :key="stepIndex">
                {{ step }}
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prover-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.prover-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
}

.prover-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: bold;
}

.prover-title {
  color: #94a3b8;
}

.prover-stats {
  margin-left: auto;
  display: flex;
  gap: 0.75rem;
}

.stat {
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
}

.stat-passed {
  color: var(--success-color);
  background: rgba(74, 222, 128, 0.1);
}

.stat-failed {
  color: var(--error-color);
  background: rgba(248, 113, 113, 0.1);
}

.prover-content {
  flex: 1;
  overflow: auto;
  padding: 0.5rem;
}

.prover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-item {
  background: var(--panel-bg);
  border-radius: 4px;
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--border-color);
}

.result-item.success {
  border-left-color: var(--success-color);
}

.result-item.failure {
  border-left-color: var(--error-color);
}

.result-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.result-status {
  font-weight: bold;
  font-size: 1rem;
}

.result-item.success .result-status {
  color: var(--success-color);
}

.result-item.failure .result-status {
  color: var(--error-color);
}

.result-stmt {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.result-message {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-left: 1.5rem;
}

.result-steps {
  margin-top: 0.5rem;
  margin-left: 1.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.steps-header {
  color: #64748b;
  font-size: 0.75rem;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.steps-list {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

.steps-list li {
  margin-bottom: 0.15rem;
}
</style>
