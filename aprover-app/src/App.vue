<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { parse, ParseError } from './core/parser';
import { normalize, normalizeFile, toCanonicalString } from './core/normalizer';
import { createProverState, verify, type ProofResult } from './core/prover';
import { astToString, type File } from './core/ast';

const input = ref(`// МТС — Ассоциативный прувер
// Примеры аксиом и формул

// А4. Смысл (акорень): ∞ : (∞ -> ∞)
∞ = ∞ -> ∞.

// А5. Самозамыкание начала: ♂x : (♂x -> x)
♂v = ♂v -> v.

// А6. Самозамыкание конца: x♀ : (x -> x♀)
r♀ = r -> r♀.

// А7. Инверсия
!♂x = x♀.
!x♀ = ♂x.

// А11. Левоассоциативность
a -> b -> c = (a -> b) -> c.

// Степени
a^2 = a -> a.
a^3 = (a -> a) -> a.
`);

const error = ref<string | null>(null);
const results = ref<{ stmt: string; result: ProofResult }[]>([]);

const parseAndVerify = () => {
  error.value = null;
  results.value = [];

  try {
    const file = parse(input.value);
    const state = createProverState();

    for (const stmt of file.statements) {
      const stmtStr = astToString(stmt.expr);
      const normalized = normalize(stmt.expr);
      const result = verify(normalized, state);
      results.value.push({ stmt: stmtStr, result });
    }
  } catch (e) {
    if (e instanceof ParseError) {
      error.value = e.message;
    } else if (e instanceof Error) {
      error.value = e.message;
    } else {
      error.value = 'Unknown error';
    }
  }
};

// Auto-verify on input change
watch(input, parseAndVerify, { immediate: true });
</script>

<template>
  <div class="container">
    <header>
      <h1>aprover</h1>
      <p class="subtitle">Ассоциативный прувер для формальной нотации Метатеории Связей (МТС)</p>
    </header>

    <main>
      <div class="editor-panel">
        <h2>Ввод</h2>
        <textarea
          v-model="input"
          class="code-editor"
          spellcheck="false"
          placeholder="Введите формулы МТС..."
        ></textarea>
      </div>

      <div class="results-panel">
        <h2>Результаты</h2>

        <div v-if="error" class="error-box">
          {{ error }}
        </div>

        <div v-else class="results-list">
          <div
            v-for="(item, index) in results"
            :key="index"
            class="result-item"
            :class="{ success: item.result.success, failure: !item.result.success }"
          >
            <div class="stmt">{{ item.stmt }}</div>
            <div class="result">
              <span class="status">{{ item.result.success ? '✓' : '✗' }}</span>
              <span class="message">{{ item.result.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer>
      <p>
        МТС — Метатеория Связей |
        <a href="https://github.com/netkeep80/aprover" target="_blank">GitHub</a>
      </p>
    </footer>
  </div>
</template>

<style>
:root {
  --bg-color: #1a1a2e;
  --panel-bg: #16213e;
  --text-color: #eee;
  --accent-color: #0f3460;
  --success-color: #4ade80;
  --error-color: #f87171;
  --border-color: #334155;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.6;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  text-align: center;
  padding: 2rem 0;
}

header h1 {
  font-size: 2.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #94a3b8;
  margin-top: 0.5rem;
}

main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  flex: 1;
}

@media (max-width: 900px) {
  main {
    grid-template-columns: 1fr;
  }
}

.editor-panel, .results-panel {
  background: var(--panel-bg);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--border-color);
}

.editor-panel h2, .results-panel h2 {
  font-size: 1rem;
  color: #94a3b8;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.code-editor {
  width: 100%;
  height: calc(100% - 2rem);
  min-height: 400px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-color);
  font-family: inherit;
  font-size: 0.9rem;
  padding: 1rem;
  resize: vertical;
  outline: none;
}

.code-editor:focus {
  border-color: #667eea;
}

.error-box {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid var(--error-color);
  border-radius: 4px;
  padding: 1rem;
  color: var(--error-color);
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.result-item {
  background: var(--bg-color);
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

.stmt {
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
}

.result {
  font-size: 0.85rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status {
  font-weight: bold;
}

.result-item.success .status {
  color: var(--success-color);
}

.result-item.failure .status {
  color: var(--error-color);
}

footer {
  text-align: center;
  padding: 1rem 0;
  color: #64748b;
  font-size: 0.85rem;
}

footer a {
  color: #667eea;
  text-decoration: none;
}

footer a:hover {
  text-decoration: underline;
}
</style>
