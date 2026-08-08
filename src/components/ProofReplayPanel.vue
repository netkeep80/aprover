<script setup lang="ts">
import { computed, ref } from 'vue'
import { presentVersionedProofArtifactJson } from '../core/proofArtifactPresentationVersioned'
import ProofSearchPanel from './ProofSearchPanel.vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  close: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const mode = ref<'replay' | 'search'>('replay')
const view = computed(() => presentVersionedProofArtifactJson(props.modelValue))

const updateSource = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

const openFile = () => fileInput.value?.click()

const loadFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  emit('update:modelValue', await file.text())
  input.value = ''
}

const clear = () => emit('update:modelValue', '')
const openSearch = () => (mode.value = 'search')
const openGeneratedProof = (source: string) => {
  emit('update:modelValue', source)
  mode.value = 'replay'
}
</script>

<template>
  <ProofSearchPanel
    v-if="mode === 'search'"
    @close="emit('close')"
    @open-replay="openGeneratedProof"
  />

  <section v-else class="proof-replay-panel" data-testid="proof-replay-panel">
    <header class="proof-replay-header">
      <div>
        <strong>Trusted proof replay</strong>
        <span class="proof-replay-subtitle">mts-proof/v0.2 + v0.3 · replay-only</span>
      </div>
      <div class="proof-replay-actions">
        <input
          ref="fileInput"
          class="proof-file-input"
          type="file"
          accept=".json,application/json"
          @change="loadFile"
        />
        <button type="button" class="proof-action proof-search-open" @click="openSearch">Search</button>
        <button type="button" class="proof-action" @click="openFile">Load JSON</button>
        <button type="button" class="proof-action" @click="clear">Clear</button>
        <button type="button" class="proof-action close" aria-label="Close proof replay" @click="emit('close')">
          ×
        </button>
      </div>
    </header>

    <div class="proof-replay-body">
      <label class="proof-source-label" for="proof-artifact-source">Proof artifact JSON</label>
      <textarea
        id="proof-artifact-source"
        class="proof-source"
        :value="modelValue"
        spellcheck="false"
        placeholder="Paste an mts-proof/v0.2 or mts-proof/v0.3 JSON artifact here"
        @input="updateSource"
      />

      <div class="proof-result" :class="`status-${view.status}`">
        <div v-if="view.status === 'empty'" class="proof-empty">
          Load or paste a proof artifact. The artifact is validated before independent replay.
        </div>

        <div v-else-if="view.status === 'invalid'" class="proof-invalid">
          <strong>Validation error</strong>
          <code v-if="view.errorPath">{{ view.errorPath }}</code>
          <span>{{ view.error }}</span>
        </div>

        <template v-else>
          <div class="proof-summary">
            <span class="proof-verdict" :class="{ accepted: view.accepted, rejected: !view.accepted }">
              {{ view.accepted ? 'REPLAY ACCEPTED' : 'REPLAY REJECTED' }}
            </span>
            <code>{{ view.schema }}</code>
            <code>{{ view.contractVersion }}</code>
          </div>

          <div v-if="view.version === 'v0.2'" class="proof-steps">
            <article v-for="step in view.steps" :key="step.index" class="proof-step">
              <div class="proof-step-header">
                <span class="proof-step-number">#{{ step.index }}</span>
                <code>{{ step.rule }}</code>
                <span class="step-verdict" :class="{ accepted: step.accepted, rejected: !step.accepted }">
                  {{ step.accepted ? 'accepted' : 'rejected' }}
                </span>
              </div>

              <code class="proof-expression">{{ step.expression }}</code>

              <div class="proof-section">
                <span class="proof-section-title">Context</span>
                <div class="context-rows">
                  <code v-for="frame in step.context" :key="frame.depth">
                    {{ frame.depth === 0 ? 'current' : `parent↑${frame.depth}` }}:
                    ◁={{ frame.start }} · ▷={{ frame.end }}
                  </code>
                </div>
              </div>

              <div class="proof-meta">
                <span>symbols: {{ step.symbolCount }}</span>
                <span>distinguished links: {{ step.distinguishedLinkCount }}</span>
              </div>

              <div class="proof-section">
                <span class="proof-section-title">Expected substitutions</span>
                <div v-if="step.substitutions.length" class="proof-values">
                  <code v-for="item in step.substitutions" :key="`${item.occurrence}:${item.link}`">
                    [] @ {{ item.occurrence }} → LinkRef {{ item.link }}
                  </code>
                </div>
                <span v-else class="proof-none">none</span>
              </div>

              <div class="proof-section">
                <span class="proof-section-title">Expected aliases</span>
                <div v-if="step.aliases.length" class="proof-values">
                  <code v-for="item in step.aliases" :key="`${item.occurrence}:${item.target}`">
                    [] @ {{ item.occurrence }} → [] @ {{ item.target }}
                  </code>
                </div>
                <span v-else class="proof-none">none</span>
              </div>
            </article>
          </div>

          <div v-else class="proof-steps proof-judgments" data-testid="proof-v03-judgments">
            <article v-for="judgment in view.judgments" :key="judgment.index" class="proof-step">
              <div class="proof-step-header">
                <span class="proof-step-number">#{{ judgment.index }}</span>
                <code>{{ judgment.relation }}</code>
                <span
                  class="step-verdict"
                  :class="{ accepted: judgment.accepted, rejected: !judgment.accepted }"
                >
                  {{ judgment.accepted ? 'accepted' : 'rejected' }}
                </span>
              </div>

              <code class="proof-expression">{{ judgment.primary }}</code>

              <div v-if="judgment.context.length" class="proof-section">
                <span class="proof-section-title">Context</span>
                <div class="context-rows">
                  <code v-for="frame in judgment.context" :key="frame.depth">
                    {{ frame.depth === 0 ? 'current' : `parent↑${frame.depth}` }}:
                    ◁={{ frame.start }} · ▷={{ frame.end }}
                  </code>
                </div>
              </div>

              <div v-if="judgment.meta.length" class="proof-meta">
                <span v-for="item in judgment.meta" :key="item">{{ item }}</span>
              </div>

              <div v-if="judgment.details.length" class="proof-section">
                <span class="proof-section-title">Replay claim</span>
                <div class="proof-values">
                  <code v-for="item in judgment.details" :key="item">{{ item }}</code>
                </div>
              </div>

              <div v-if="judgment.substitutions.length" class="proof-section">
                <span class="proof-section-title">Expected substitutions</span>
                <div class="proof-values">
                  <code v-for="item in judgment.substitutions" :key="`${item.occurrence}:${item.link}`">
                    [] @ {{ item.occurrence }} → LinkRef {{ item.link }}
                  </code>
                </div>
              </div>

              <div v-if="judgment.aliases.length" class="proof-section">
                <span class="proof-section-title">Expected aliases</span>
                <div class="proof-values">
                  <code v-for="item in judgment.aliases" :key="`${item.occurrence}:${item.target}`">
                    [] @ {{ item.occurrence }} → [] @ {{ item.target }}
                  </code>
                </div>
              </div>
            </article>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.proof-replay-panel {
  display: flex;
  flex-direction: column;
  min-height: 240px;
  max-height: 48vh;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.proof-replay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0.75rem;
  background: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
}

.proof-replay-header > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
}

.proof-replay-subtitle,
.proof-source-label,
.proof-meta,
.proof-none {
  color: #94a3b8;
  font-size: 0.72rem;
}

.proof-replay-actions {
  display: flex;
  gap: 0.35rem;
}

.proof-file-input {
  display: none;
}

.proof-action {
  padding: 0.25rem 0.5rem;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.proof-action:hover {
  color: white;
}

.proof-action.close {
  font-size: 1rem;
  line-height: 1;
}

.proof-replay-body {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(360px, 1.2fr);
  gap: 0.6rem;
  min-height: 0;
  padding: 0.6rem;
  overflow: hidden;
}

.proof-source-label {
  grid-column: 1;
}

.proof-source {
  grid-column: 1;
  min-height: 160px;
  width: 100%;
  resize: vertical;
  padding: 0.55rem;
  color: #e2e8f0;
  background: #0f172a;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.75rem;
}

.proof-result {
  grid-column: 2;
  grid-row: 1 / span 2;
  min-height: 0;
  overflow: auto;
  padding: 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.proof-empty,
.proof-invalid {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: #94a3b8;
}

.proof-invalid {
  color: var(--error-color);
}

.proof-summary,
.proof-step-header,
.proof-meta {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.proof-summary {
  margin-bottom: 0.6rem;
}

.proof-verdict,
.step-verdict {
  padding: 0.12rem 0.35rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 700;
}

.accepted {
  color: var(--success-color);
  background: rgba(74, 222, 128, 0.1);
}

.rejected {
  color: var(--error-color);
  background: rgba(248, 113, 113, 0.1);
}

.proof-steps,
.proof-values,
.context-rows {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.proof-step {
  padding: 0.55rem;
  background: rgba(15, 23, 42, 0.55);
  border-left: 3px solid var(--border-color);
  border-radius: 4px;
}

.proof-step-number {
  color: #94a3b8;
  font-size: 0.72rem;
}

.proof-expression {
  display: block;
  margin: 0.5rem 0;
  color: #c4b5fd;
}

.proof-section {
  margin-top: 0.45rem;
}

.proof-section-title {
  display: block;
  margin-bottom: 0.2rem;
  color: #94a3b8;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.proof-values code,
.context-rows code {
  font-size: 0.72rem;
}

@media (max-width: 900px) {
  .proof-replay-panel {
    max-height: 60vh;
  }

  .proof-replay-body {
    display: flex;
    flex-direction: column;
    overflow: auto;
  }

  .proof-source {
    min-height: 120px;
  }

  .proof-result {
    min-height: 160px;
  }
}
</style>
