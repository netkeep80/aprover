<script setup lang="ts">
import { computed } from 'vue'
import { deserializeAnumStream } from '../core/anumDenotation'

const props = defineProps<{
  rawLines: string[]
}>()

const entries = computed(() =>
  props.rawLines.map((raw, index) => {
    try {
      return {
        index,
        raw,
        value: deserializeAnumStream(raw),
        error: null as string | null,
      }
    } catch (cause) {
      return {
        index,
        raw,
        value: null,
        error: cause instanceof Error ? cause.message : 'Deserialization failed',
      }
    }
  })
)
</script>

<template>
  <section class="anum-denotation-panel" aria-label="Anum stream deserialization v0.3">
    <header class="denotation-header">
      <div>
        <strong>Anum stream deserialization v0.3</strong>
        <span class="boundary">pure read-only consumer</span>
      </div>
    </header>

    <div class="denotation-content">
      <div v-if="entries.length === 0" class="empty">No Anum source lines</div>

      <article v-for="entry in entries" :key="`${entry.index}:${entry.raw}`" class="entry">
        <div class="entry-heading">
          <span>line {{ entry.index + 1 }}</span>
          <code class="source">{{ entry.raw || 'ε' }}</code>
          <span v-if="entry.value" class="kind">semantic-link</span>
        </div>

        <div v-if="entry.error" class="error" role="alert">{{ entry.error }}</div>

        <dl v-else-if="entry.value" class="summary">
          <dt>result</dt>
          <dd><code class="result">{{ entry.value.result }}</code></dd>
          <dt>resolved</dt>
          <dd><code>{{ entry.value.resolvedValues.join(', ') || 'none' }}</code></dd>
          <dt>operations</dt>
          <dd><code>{{ entry.value.operations.join(' → ') || 'none' }}</code></dd>
          <dt>maxDepth</dt>
          <dd><code>{{ entry.value.maxDepth }}</code></dd>
        </dl>
      </article>

      <footer class="veto-note">
        Semantic Link identity is by ordered poles. Source positions and stack frames are not identities;
        no MemoryView, realize, delete or materialization action is available here.
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
.veto-note {
  color: #64748b;
  font-size: 0.75rem;
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

.source,
.result {
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

.error {
  margin-top: 0.5rem;
  color: var(--error-color);
  font-size: 0.75rem;
}

.empty {
  color: #64748b;
  font-size: 0.8rem;
}

.veto-note {
  margin-top: 0.65rem;
}
</style>
