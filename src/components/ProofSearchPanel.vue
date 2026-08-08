<script setup lang="ts">
import { ref } from 'vue'
import type { ContextFrame, LinkRef } from '../core/interpreter'
import type { DistinguishedLink } from '../core/memoryView'
import { searchInterpretProof } from '../core/proofSearch'
import { checkProof } from '../core/proofReplay'

const emit = defineEmits<{
  close: []
  'open-replay': [source: string]
}>()

const expression = ref('[] = ◁')
const contextSource = ref(JSON.stringify({ start: 10, end: 12 }, null, 2))
const symbolsSource = ref('{}')
const memorySource = ref('[]')
const searchStatus = ref<'idle' | 'proven' | 'not-proven' | 'error'>('idle')
const searchMessage = ref('')
const proofSource = ref('')
const replayAccepted = ref<boolean | null>(null)

type UnknownRecord = Record<string, unknown>

function record(value: unknown, label: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label}: expected object`)
  }
  return value as UnknownRecord
}

function linkRef(value: unknown, label: string): LinkRef {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${label}: expected integer LinkRef`)
  }
  return value
}

function parseJson(source: string, label: string): unknown {
  try {
    return JSON.parse(source) as unknown
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'invalid JSON'
    throw new Error(`${label}: ${message}`)
  }
}

function contextFrame(value: unknown, label: string): ContextFrame {
  const source = record(value, label)
  const frame: ContextFrame = {
    start: linkRef(source.start, `${label}.start`),
    end: linkRef(source.end, `${label}.end`),
  }
  if (source.parent === undefined) return frame
  return { ...frame, parent: contextFrame(source.parent, `${label}.parent`) }
}

function symbols(value: unknown, label: string): Readonly<Record<string, LinkRef>> | undefined {
  const source = record(value, label)
  const result: Record<string, LinkRef> = {}
  for (const [name, reference] of Object.entries(source)) {
    result[name] = linkRef(reference, `${label}.${JSON.stringify(name)}`)
  }
  return Object.keys(result).length === 0 ? undefined : result
}

function distinguishedMemory(value: unknown, label: string): readonly DistinguishedLink[] | undefined {
  if (!Array.isArray(value)) throw new Error(`${label}: expected array`)
  const links = value.map((entry, index) => {
    const source = record(entry, `${label}[${index}]`)
    return {
      id: linkRef(source.id, `${label}[${index}].id`),
      start: linkRef(source.start, `${label}[${index}].start`),
      end: linkRef(source.end, `${label}[${index}].end`),
    }
  })
  return links.length === 0 ? undefined : links
}

const runSearch = () => {
  searchStatus.value = 'idle'
  searchMessage.value = ''
  proofSource.value = ''
  replayAccepted.value = null

  let context: ContextFrame
  let parsedSymbols: Readonly<Record<string, LinkRef>> | undefined
  let parsedMemory: readonly DistinguishedLink[] | undefined

  try {
    context = contextFrame(parseJson(contextSource.value, 'context'), 'context')
    parsedSymbols = symbols(parseJson(symbolsSource.value, 'symbols'), 'symbols')
    parsedMemory = distinguishedMemory(parseJson(memorySource.value, 'memory'), 'memory')
  } catch (cause) {
    searchStatus.value = 'error'
    searchMessage.value = cause instanceof Error ? cause.message : 'Invalid proof search input'
    return
  }

  const result = searchInterpretProof({
    expression: expression.value,
    context,
    ...(parsedSymbols === undefined ? {} : { symbols: parsedSymbols }),
    ...(parsedMemory === undefined ? {} : { distinguishedMemory: parsedMemory }),
  })

  if (result.status === 'error') {
    searchStatus.value = 'error'
    searchMessage.value = `${result.stage}: ${result.message}`
    return
  }

  if (result.status === 'not-proven') {
    searchStatus.value = 'not-proven'
    searchMessage.value = result.reason
    return
  }

  searchStatus.value = 'proven'
  proofSource.value = JSON.stringify(result.proof, null, 2)
  replayAccepted.value = checkProof(result.proof)
}

const openReplay = () => {
  if (proofSource.value) emit('open-replay', proofSource.value)
}
</script>

<template>
  <section class="proof-search-panel" data-testid="proof-search-panel">
    <header class="proof-search-header">
      <div>
        <strong>Untrusted proof search</strong>
        <span class="proof-search-subtitle">mts-proof/v0.2 · interpret only</span>
      </div>
      <button type="button" class="proof-search-action close" aria-label="Close proof search" @click="emit('close')">
        ×
      </button>
    </header>

    <div class="proof-search-body">
      <div class="proof-search-inputs">
        <label for="proof-search-expression">Expression</label>
        <textarea
          id="proof-search-expression"
          v-model="expression"
          class="proof-search-source"
          spellcheck="false"
        />

        <label for="proof-search-context">ContextFrame JSON</label>
        <textarea
          id="proof-search-context"
          v-model="contextSource"
          class="proof-search-json"
          spellcheck="false"
        />

        <label for="proof-search-symbols">Symbols JSON</label>
        <textarea
          id="proof-search-symbols"
          v-model="symbolsSource"
          class="proof-search-json compact"
          spellcheck="false"
        />

        <label for="proof-search-memory">Distinguished memory JSON</label>
        <textarea
          id="proof-search-memory"
          v-model="memorySource"
          class="proof-search-json"
          spellcheck="false"
        />

        <button type="button" class="proof-search-action primary proof-search-run" @click="runSearch">
          Run search
        </button>
      </div>

      <div class="proof-search-result">
        <div v-if="searchStatus === 'idle'" class="proof-search-empty">
          Search is untrusted. Any generated artifact is independently replayed before it is shown as accepted.
        </div>

        <div v-else class="proof-search-summary">
          <span class="proof-search-status" :class="`status-${searchStatus}`">
            {{ searchStatus === 'proven' ? 'SEARCH PROVEN' : searchStatus === 'not-proven' ? 'NOT PROVEN' : 'SEARCH ERROR' }}
          </span>
          <span v-if="searchMessage" class="proof-search-message">{{ searchMessage }}</span>
        </div>

        <template v-if="searchStatus === 'proven'">
          <div class="proof-search-replay">
            <span>Independent replay</span>
            <strong
              class="proof-search-replay-verdict"
              :class="{ accepted: replayAccepted === true, rejected: replayAccepted === false }"
            >
              {{ replayAccepted ? 'REPLAY ACCEPTED' : 'REPLAY REJECTED' }}
            </strong>
          </div>

          <textarea
            class="proof-search-artifact"
            :value="proofSource"
            readonly
            spellcheck="false"
            aria-label="Generated proof artifact JSON"
          />

          <button type="button" class="proof-search-action" @click="openReplay">
            Open in trusted replay
          </button>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.proof-search-panel {
  display: flex;
  flex-direction: column;
  min-height: 280px;
  max-height: 58vh;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.proof-search-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0.75rem;
  background: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
}

.proof-search-header > div {
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
}

.proof-search-subtitle,
.proof-search-inputs label,
.proof-search-empty,
.proof-search-message,
.proof-search-replay > span {
  color: #94a3b8;
  font-size: 0.72rem;
}

.proof-search-body {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(360px, 1.1fr);
  gap: 0.7rem;
  min-height: 0;
  padding: 0.65rem;
  overflow: hidden;
}

.proof-search-inputs,
.proof-search-result {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-height: 0;
}

.proof-search-result {
  overflow: auto;
  padding: 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.proof-search-source,
.proof-search-json,
.proof-search-artifact {
  width: 100%;
  resize: vertical;
  padding: 0.5rem;
  color: #e2e8f0;
  background: #0f172a;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.75rem;
}

.proof-search-source {
  min-height: 54px;
}

.proof-search-json {
  min-height: 76px;
}

.proof-search-json.compact {
  min-height: 48px;
}

.proof-search-artifact {
  min-height: 150px;
}

.proof-search-action {
  align-self: flex-start;
  padding: 0.28rem 0.55rem;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.proof-search-action:hover {
  color: white;
}

.proof-search-action.primary {
  margin-top: 0.25rem;
  font-weight: 700;
}

.proof-search-action.close {
  align-self: auto;
  font-size: 1rem;
  line-height: 1;
}

.proof-search-summary,
.proof-search-replay {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.proof-search-status,
.proof-search-replay-verdict {
  padding: 0.12rem 0.35rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 700;
}

.status-proven,
.accepted {
  color: var(--success-color);
  background: rgba(74, 222, 128, 0.1);
}

.status-not-proven {
  color: #facc15;
  background: rgba(250, 204, 21, 0.1);
}

.status-error,
.rejected {
  color: var(--error-color);
  background: rgba(248, 113, 113, 0.1);
}

.proof-search-replay {
  margin-top: 0.45rem;
}

@media (max-width: 900px) {
  .proof-search-panel {
    max-height: 70vh;
  }

  .proof-search-body {
    display: flex;
    flex-direction: column;
    overflow: auto;
  }
}
</style>
