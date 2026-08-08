<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  canonicalAnum,
  denotateAnum,
  type AnumDenotationContext,
  type DenotationRef,
} from '../core/anumDenotation'

const props = defineProps<{
  rawLines: string[]
}>()

const context = ref<AnumDenotationContext>('root')

const formatRef = (ref: DenotationRef): string =>
  'anchor' in ref ? `anchor:${ref.anchor}` : `node:${ref.node}`

const entries = computed(() =>
  props.rawLines.map((raw, index) => {
    try {
      const value = denotateAnum(raw, context.value)
      let canonicalRaw: string | null = null
      let inverseError: string | null = null

      if (value.kind === 'structural') {
        try {
          canonicalRaw = canonicalAnum(value)
        } catch (cause) {
          inverseError = cause instanceof Error ? cause.message : 'Canonical inverse unavailable'
        }
      }

      return { index, raw, value, canonicalRaw, inverseError, error: null as string | null }
    } catch (cause) {
      return {
        index,
        raw,
        value: null,
        canonicalRaw: null,
        inverseError: null,
        error: cause instanceof Error ? cause.message : 'Denotation failed',
      }
    }
  })
)
</script>

<template>
  <section class="anum-denotation-panel" aria-label="Anum denotation v0.2">
    <header class="denotation-header">
      <div>
        <strong>Anum denotation v0.2</strong>
        <span class="boundary">read-only L3 consumer</span>
      </div>
      <label class="context-control">
        Context
        <select v-model="context" aria-label="Anum denotation context">
          <option value="root">root</option>
          <option value="quote">quote</option>
          <option value="relative">relative</option>
        </select>
      </label>
    </header>

    <div class="denotation-content">
      <div v-if="entries.length === 0" class="empty">No Anum source lines</div>

      <article v-for="entry in entries" :key="`${entry.index}:${entry.raw}`" class="entry">
        <div class="entry-heading">
          <span>line {{ entry.index + 1 }}</span>
          <code class="source">{{ entry.raw }}</code>
          <span v-if="entry.value" class="kind">{{ entry.value.kind }}</span>
        </div>

        <div v-if="entry.error" class="error" role="alert">{{ entry.error }}</div>

        <template v-else-if="entry.value?.kind === 'structural'">
          <dl class="summary">
            <dt>anchors</dt>
            <dd><code>{{ entry.value.anchors.join(', ') || 'none' }}</code></dd>
            <dt>root</dt>
            <dd><code>{{ formatRef(entry.value.root) }}</code></dd>
            <dt>canonicalRaw</dt>
            <dd>
              <code v-if="entry.canonicalRaw !== null">{{ entry.canonicalRaw }}</code>
              <span v-else class="muted">not defined for this general IR value</span>
            </dd>
          </dl>

          <div v-if="entry.inverseError" class="inverse-note">
            {{ entry.inverseError }}
          </div>

          <table v-if="entry.value.nodes.length" class="nodes">
            <thead>
              <tr><th>id</th><th>start</th><th>end</th></tr>
            </thead>
            <tbody>
              <tr v-for="node in entry.value.nodes" :key="node.id">
                <td><code>{{ node.id }}</code></td>
                <td><code>{{ formatRef(node.start) }}</code></td>
                <td><code>{{ formatRef(node.end) }}</code></td>
              </tr>
            </tbody>
          </table>
          <div v-else class="muted">No structural nodes; root is an anchor.</div>
        </template>

        <dl v-else-if="entry.value" class="summary">
          <dt>payload</dt>
          <dd><code>{{ entry.value.raw }}</code></dd>
        </dl>
      </article>

      <footer class="veto-note">
        Presentation only — no MemoryView, realize, delete or materialization action.
      </footer>
    </div>
  </section>
</template>

<style scoped>
.anum-denotation-panel {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--panel-bg);
  overflow: hidden;
}

.denotation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--accent-color);
  font-size: 0.8rem;
}

.denotation-header > div {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.boundary,
.muted,
.inverse-note,
.veto-note {
  color: #64748b;
  font-size: 0.75rem;
}

.context-control {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #94a3b8;
}

.context-control select {
  background: var(--bg-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 0.2rem 0.35rem;
}

.denotation-content {
  padding: 0.65rem;
  max-height: 320px;
  overflow: auto;
}

.entry {
  padding: 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.entry + .entry {
  margin-top: 0.55rem;
}

.entry-heading {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.76rem;
}

.source {
  color: #c4b5fd;
}

.kind {
  margin-left: auto;
  color: #94a3b8;
}

.summary {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.25rem 0.7rem;
  margin: 0.55rem 0 0;
  font-size: 0.75rem;
}

.summary dt {
  color: #64748b;
}

.summary dd {
  margin: 0;
  min-width: 0;
}

.nodes {
  width: 100%;
  margin-top: 0.55rem;
  border-collapse: collapse;
  font-size: 0.73rem;
}

.nodes th,
.nodes td {
  padding: 0.25rem 0.4rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.error {
  margin-top: 0.5rem;
  color: var(--error-color);
  font-size: 0.75rem;
}

.inverse-note {
  margin-top: 0.4rem;
}

.empty {
  color: #64748b;
  font-size: 0.8rem;
}

.veto-note {
  margin-top: 0.65rem;
}
</style>
