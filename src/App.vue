<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { parse, ParseError } from './core/parser'
import { normalize } from './core/normalizer'
import { createProverState, verify, type ProofResult } from './core/prover'
import { astToString, type File } from './core/ast'
import Editor from './components/Editor.vue'
import ASTViewer from './components/ASTViewer.vue'
import ProverPanel from './components/ProverPanel.vue'
import ErrorPanel from './components/ErrorPanel.vue'

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
`)

const error = ref<string | null>(null)
const ast = ref<File | null>(null)
const results = ref<{ stmt: string; result: ProofResult }[]>([])

// Panel visibility state
const showAST = ref(true)

const toggleAST = () => {
  showAST.value = !showAST.value
}

const parseAndVerify = () => {
  error.value = null
  ast.value = null
  results.value = []

  try {
    const file = parse(input.value)
    ast.value = file
    const state = createProverState()

    for (const stmt of file.statements) {
      const stmtStr = astToString(stmt.expr)
      const normalized = normalize(stmt.expr)
      const result = verify(normalized, state)
      results.value.push({ stmt: stmtStr, result })
    }
  } catch (e) {
    if (e instanceof ParseError) {
      error.value = e.message
    } else if (e instanceof Error) {
      error.value = e.message
    } else {
      error.value = 'Unknown error'
    }
  }
}

// Auto-verify on input change
watch(input, parseAndVerify, { immediate: true })

// Stats for header
const stats = computed(() => {
  const total = results.value.length
  const passed = results.value.filter(r => r.result.success).length
  return { total, passed }
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <h1>aprover</h1>
        <span class="version">v0.1.0</span>
      </div>
      <p class="subtitle">Ассоциативный прувер для формальной нотации Метатеории Связей (МТС)</p>
      <div class="header-right">
        <button class="toggle-btn" :class="{ active: showAST }" @click="toggleAST">
          {{ showAST ? 'Hide AST' : 'Show AST' }}
        </button>
      </div>
    </header>

    <main class="app-main" :class="{ 'with-ast': showAST }">
      <div class="panel editor-panel">
        <Editor v-model="input" />
      </div>

      <div v-if="showAST" class="panel ast-panel">
        <ASTViewer :ast="ast" :error="error" />
      </div>

      <div class="panel results-panel">
        <ErrorPanel :error="error" />
        <ProverPanel v-if="!error" :results="results" />
      </div>
    </main>

    <footer class="app-footer">
      <div v-if="stats.total > 0" class="footer-stats">
        <span>{{ stats.passed }}/{{ stats.total }} statements verified</span>
      </div>
      <div class="footer-links">
        <span>МТС — Метатеория Связей</span>
        <span class="separator">|</span>
        <a href="https://github.com/netkeep80/aprover" target="_blank" rel="noopener">GitHub</a>
      </div>
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
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.6;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-width: 1800px;
  margin: 0 auto;
  padding: 0.5rem;
}

.app-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--panel-bg);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.app-header h1 {
  font-size: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.version {
  color: #64748b;
  font-size: 0.75rem;
}

.subtitle {
  color: #64748b;
  font-size: 0.8rem;
  margin-left: 1.5rem;
  flex: 1;
}

.header-right {
  margin-left: auto;
}

.toggle-btn {
  background: var(--accent-color);
  color: #94a3b8;
  border: 1px solid var(--border-color);
  padding: 0.4rem 0.75rem;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: #1a3a5c;
  color: var(--text-color);
}

.toggle-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.app-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
}

.app-main.with-ast {
  grid-template-columns: 1fr 1fr 1fr;
}

@media (max-width: 1200px) {
  .app-main.with-ast {
    grid-template-columns: 1fr 1fr;
  }

  .app-main.with-ast .ast-panel {
    grid-column: span 2;
    max-height: 300px;
  }
}

@media (max-width: 768px) {
  .app-main,
  .app-main.with-ast {
    grid-template-columns: 1fr;
  }

  .app-main.with-ast .ast-panel {
    grid-column: span 1;
  }

  .panel {
    max-height: 400px;
  }

  .app-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .subtitle {
    width: 100%;
    margin-left: 0;
    order: 3;
  }
}

.panel {
  background: var(--panel-bg);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  min-height: 400px;
}

.app-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  margin-top: 0.5rem;
  color: #64748b;
  font-size: 0.8rem;
  background: var(--panel-bg);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.footer-stats {
  color: var(--success-color);
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.separator {
  color: #4a5568;
}

.footer-links a {
  color: #667eea;
  text-decoration: none;
}

.footer-links a:hover {
  text-decoration: underline;
}
</style>
