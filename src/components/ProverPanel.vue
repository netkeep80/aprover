<script setup lang="ts">
import { defineProps, computed, ref } from 'vue'
import type { ProofResult, VerificationHint } from '../core/prover'

const props = defineProps<{
  results: { stmt: string; result: ProofResult }[]
}>()

// Track which results have expanded proof details
const expandedResults = ref<Set<number>>(new Set())

const toggleExpanded = (index: number) => {
  if (expandedResults.value.has(index)) {
    expandedResults.value.delete(index)
  } else {
    expandedResults.value.add(index)
  }
  // Force reactivity
  expandedResults.value = new Set(expandedResults.value)
}

const isExpanded = (index: number) => expandedResults.value.has(index)

const stats = computed(() => {
  const total = props.results.length
  const passed = props.results.filter(r => r.result.success).length
  const failed = total - passed
  return { total, passed, failed }
})

// Check if result has detailed proof information
const hasDetails = (result: ProofResult): boolean => {
  return !!(
    (result.proofSteps && result.proofSteps.length > 0) ||
    (result.appliedAxioms && result.appliedAxioms.length > 0) ||
    (result.hints && result.hints.length > 0)
  )
}

// Get hint type class
const getHintClass = (hint: VerificationHint): string => {
  switch (hint.type) {
    case 'structural':
      return 'hint-structural'
    case 'definition':
      return 'hint-definition'
    case 'axiom':
      return 'hint-axiom'
    case 'suggestion':
    default:
      return 'hint-suggestion'
  }
}
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
          <div class="result-header" @click="hasDetails(item.result) && toggleExpanded(index)">
            <span class="result-status">
              {{ item.result.success ? '✓' : '✗' }}
            </span>
            <span class="result-stmt">{{ item.stmt }}</span>
            <span v-if="hasDetails(item.result)" class="expand-toggle">
              {{ isExpanded(index) ? '▼' : '▶' }}
            </span>
          </div>
          <div class="result-message">
            {{ item.result.message }}
          </div>

          <!-- Applied axioms (always visible when present) -->
          <div
            v-if="item.result.appliedAxioms && item.result.appliedAxioms.length > 0"
            class="applied-axioms"
          >
            <span class="axioms-label">Применённые аксиомы:</span>
            <div class="axioms-list">
              <span
                v-for="axiom in item.result.appliedAxioms"
                :key="axiom.id"
                class="axiom-badge"
                :title="`${axiom.name}: ${axiom.formula}`"
              >
                {{ axiom.id }}
              </span>
            </div>
          </div>

          <!-- Expandable detailed proof steps -->
          <div
            v-if="isExpanded(index) && item.result.proofSteps && item.result.proofSteps.length > 0"
            class="proof-details"
          >
            <div class="proof-steps-header">Шаги доказательства:</div>
            <div class="proof-steps-list">
              <div v-for="step in item.result.proofSteps" :key="step.index" class="proof-step">
                <div class="step-header">
                  <span class="step-index">{{ step.index }}.</span>
                  <span class="step-action">{{ step.action }}</span>
                  <span v-if="step.axiom" class="step-axiom" :title="step.axiom.formula">
                    [{{ step.axiom.id }}]
                  </span>
                </div>
                <div v-if="step.before || step.after" class="step-transformation">
                  <span v-if="step.before" class="step-before">{{ step.before }}</span>
                  <span v-if="step.before && step.after" class="step-arrow">→</span>
                  <span v-if="step.after" class="step-after">{{ step.after }}</span>
                </div>
                <div v-if="step.details" class="step-details">
                  {{ step.details }}
                </div>
              </div>
            </div>
          </div>

          <!-- Hints for failed verification -->
          <div
            v-if="!item.result.success && item.result.hints && item.result.hints.length > 0"
            class="hints-section"
          >
            <div class="hints-header">Подсказки:</div>
            <div class="hints-list">
              <div
                v-for="(hint, hintIndex) in item.result.hints"
                :key="hintIndex"
                class="hint-item"
                :class="getHintClass(hint)"
              >
                <span class="hint-icon">💡</span>
                <span class="hint-message">{{ hint.message }}</span>
                <span v-if="hint.relatedAxiom" class="hint-axiom">[{{ hint.relatedAxiom }}]</span>
              </div>
            </div>
          </div>

          <!-- Legacy steps (fallback) -->
          <div
            v-if="
              !isExpanded(index) &&
              item.result.steps &&
              item.result.steps.length > 0 &&
              (!item.result.proofSteps || item.result.proofSteps.length === 0)
            "
            class="result-steps"
          >
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
  cursor: pointer;
}

.result-header:hover .expand-toggle {
  color: var(--text-color);
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
  flex: 1;
}

.expand-toggle {
  color: #64748b;
  font-size: 0.75rem;
  padding: 0 0.25rem;
  transition: color 0.2s;
}

.result-message {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-left: 1.5rem;
}

/* Applied axioms section */
.applied-axioms {
  margin-top: 0.5rem;
  margin-left: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.axioms-label {
  color: #64748b;
  font-size: 0.75rem;
}

.axioms-list {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.axiom-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: bold;
  cursor: help;
}

/* Proof details section */
.proof-details {
  margin-top: 0.75rem;
  margin-left: 1.5rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.proof-steps-header {
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.proof-steps-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.proof-step {
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
  border-left: 2px solid #667eea;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.step-index {
  color: #667eea;
  font-weight: bold;
  font-size: 0.85rem;
}

.step-action {
  color: var(--text-color);
  font-size: 0.85rem;
}

.step-axiom {
  color: #a78bfa;
  font-size: 0.75rem;
  cursor: help;
}

.step-transformation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem 0;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
}

.step-before {
  color: #f87171;
}

.step-arrow {
  color: #64748b;
}

.step-after {
  color: #4ade80;
}

.step-details {
  color: #94a3b8;
  font-size: 0.8rem;
  margin-top: 0.25rem;
  font-style: italic;
}

/* Hints section */
.hints-section {
  margin-top: 0.75rem;
  margin-left: 1.5rem;
  padding: 0.5rem;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.hints-header {
  color: #fbbf24;
  font-size: 0.8rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.hints-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hint-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8rem;
  padding: 0.25rem 0;
}

.hint-icon {
  flex-shrink: 0;
}

.hint-message {
  color: #fbbf24;
  flex: 1;
}

.hint-axiom {
  color: #a78bfa;
  font-size: 0.75rem;
}

.hint-structural .hint-message {
  color: #f87171;
}

.hint-definition .hint-message {
  color: #60a5fa;
}

.hint-axiom .hint-message {
  color: #a78bfa;
}

.hint-suggestion .hint-message {
  color: #fbbf24;
}

/* Legacy steps (fallback) */
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
