<script setup lang="ts">
import { computed } from 'vue'
import type { InterpretationResult } from '../core/interpreter'
import { presentInterpretation } from '../core/interpretationPresentation'

const props = defineProps<{
  result: InterpretationResult | null
  error?: string | null
}>()

const view = computed(() => (props.result ? presentInterpretation(props.result) : null))
</script>

<template>
  <section class="interpretation-panel" aria-label="MTS interpretation">
    <header class="interpretation-header">
      <span class="interpretation-icon">MTS</span>
      <span class="interpretation-title">Canonical interpretation</span>
      <span
        v-if="view"
        class="interpretation-status"
        :class="view.status === 'matched' ? 'status-matched' : 'status-not-matched'"
      >
        {{ view.status === 'matched' ? 'matched' : 'not matched' }}
      </span>
    </header>

    <div class="interpretation-content">
      <div v-if="error" class="interpretation-error" role="alert">
        {{ error }}
      </div>

      <div v-else-if="!view" class="interpretation-empty">
        No interpretation result
      </div>

      <template v-else>
        <section class="interpretation-section">
          <h3>Substitutions</h3>
          <div v-if="view.substitutions.length === 0" class="section-empty">None</div>
          <dl v-else class="mapping-list">
            <template v-for="item in view.substitutions" :key="`${item.occurrence}:${item.link}`">
              <dt><code>[] @ {{ item.occurrence }}</code></dt>
              <dd><code>LinkRef {{ item.link }}</code></dd>
            </template>
          </dl>
        </section>

        <section class="interpretation-section">
          <h3>Aliases</h3>
          <div v-if="view.aliases.length === 0" class="section-empty">None</div>
          <dl v-else class="mapping-list">
            <template v-for="item in view.aliases" :key="`${item.occurrence}:${item.target}`">
              <dt><code>[] @ {{ item.occurrence }}</code></dt>
              <dd><code>→ [] @ {{ item.target }}</code></dd>
            </template>
          </dl>
        </section>

        <section class="interpretation-section">
          <h3>Resolution trace</h3>
          <div v-if="view.trace.length === 0" class="section-empty">None</div>
          <ol v-else class="trace-list">
            <li v-for="(step, index) in view.trace" :key="`${index}:${step}`">
              <code>{{ step }}</code>
            </li>
          </ol>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.interpretation-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.interpretation-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
}

.interpretation-icon {
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.16);
  color: var(--text-color);
  font-size: 0.7rem;
  font-weight: 700;
}

.interpretation-title {
  color: #94a3b8;
}

.interpretation-status {
  margin-left: auto;
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
  font-size: 0.75rem;
}

.status-matched {
  color: var(--success-color);
  background: rgba(74, 222, 128, 0.1);
}

.status-not-matched {
  color: var(--error-color);
  background: rgba(248, 113, 113, 0.1);
}

.interpretation-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.75rem;
}

.interpretation-empty,
.section-empty {
  color: #64748b;
  font-size: 0.85rem;
}

.interpretation-error {
  color: var(--error-color);
  font-size: 0.85rem;
}

.interpretation-section + .interpretation-section {
  margin-top: 1rem;
}

.interpretation-section h3 {
  margin: 0 0 0.5rem;
  color: #94a3b8;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.mapping-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.35rem 0.75rem;
  margin: 0;
}

.mapping-list dt,
.mapping-list dd {
  min-width: 0;
  margin: 0;
  font-size: 0.8rem;
}

.mapping-list dd {
  color: #94a3b8;
}

.mapping-list code,
.trace-list code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  word-break: break-word;
}

.trace-list {
  margin: 0;
  padding-left: 1.5rem;
  color: #94a3b8;
  font-size: 0.8rem;
}

.trace-list li + li {
  margin-top: 0.25rem;
}
</style>
