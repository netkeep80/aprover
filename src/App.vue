<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { parse, ParseError } from './core/parser'
import { normalize } from './core/normalizer'
import { createProverState, verify, type ProofResult } from './core/prover'
import { astToString, type File, type SourceLocation } from './core/ast'
import Editor from './components/Editor.vue'
import ASTViewer from './components/ASTViewer.vue'
import ProverPanel from './components/ProverPanel.vue'
import ErrorPanel from './components/ErrorPanel.vue'
import {
  readFileContent,
  getFilePreview,
  isSupportedFile,
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  saveAutosave,
  loadAutosave,
  formatResultsForExport,
  downloadFile,
  openFileDialog,
  type FileMetadata,
} from './core/fileIO'

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

// Highlighted source location (from AST node hover)
const highlightedLoc = ref<SourceLocation | null>(null)

// File operations state
const currentFileName = ref<string | null>(null)
const showRecentFiles = ref(false)
const recentFiles = ref<FileMetadata[]>([])
const isDragOver = ref(false)

const toggleAST = () => {
  showAST.value = !showAST.value
}

// Handle AST node hover for source highlighting
const handleNodeHover = (loc: SourceLocation | null) => {
  highlightedLoc.value = loc
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

// File operations
const loadRecentFiles = () => {
  recentFiles.value = getRecentFiles()
}

const handleFileOpen = async () => {
  const files = await openFileDialog('.mtl,.astr,.anum', false)
  if (files && files.length > 0) {
    await loadFile(files[0])
  }
}

const loadFile = async (file: globalThis.File) => {
  if (!isSupportedFile(file.name)) {
    error.value = `Неподдерживаемый формат файла: ${file.name}. Поддерживаются: .mtl, .astr, .anum`
    return
  }

  try {
    const content = await readFileContent(file)
    input.value = content
    currentFileName.value = file.name
    const preview = getFilePreview(content)
    addRecentFile(file.name, file.size, preview)
    loadRecentFiles()
    showRecentFiles.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка чтения файла'
  }
}

const handleFileDrop = (file: globalThis.File) => {
  loadFile(file)
}

const handleSaveResults = () => {
  if (results.value.length === 0) return

  const content = formatResultsForExport(results.value, { includeDetails: true, format: 'text' })
  const baseName = currentFileName.value?.replace(/\.[^.]+$/, '') || 'results'
  downloadFile(content, `${baseName}-results.txt`, 'text/plain')
}

const handleSaveCode = () => {
  const baseName = currentFileName.value || 'code.mtl'
  downloadFile(input.value, baseName, 'text/plain')
}

const handleExportJson = () => {
  if (results.value.length === 0) return

  const content = formatResultsForExport(results.value, { includeDetails: true, format: 'json' })
  const baseName = currentFileName.value?.replace(/\.[^.]+$/, '') || 'results'
  downloadFile(content, `${baseName}-results.json`, 'application/json')
}

const handleNewFile = () => {
  currentFileName.value = null
  input.value = `// МТС — Ассоциативный прувер
// Введите формулы для верификации

`
}

const toggleRecentFiles = () => {
  showRecentFiles.value = !showRecentFiles.value
  if (showRecentFiles.value) {
    loadRecentFiles()
  }
}

const handleRecentFileClick = async (file: FileMetadata) => {
  // Recent files don't store content, so this is just a notification
  // In a real app, you'd need to re-open the file from disk
  // For now, we show a message indicating the file needs to be opened
  showRecentFiles.value = false
  // Note: In browser context, we can't re-read files from disk
  // This feature shows history but requires re-opening
  alert(`Для открытия файла "${file.name}" используйте кнопку "Открыть"`)
}

const handleRemoveRecentFile = (e: Event, name: string) => {
  e.stopPropagation()
  removeRecentFile(name)
  loadRecentFiles()
}

const handleClearRecentFiles = () => {
  clearRecentFiles()
  loadRecentFiles()
}

// Autosave
const autosaveInterval = ref<ReturnType<typeof setInterval> | null>(null)

const setupAutosave = () => {
  // Save every 30 seconds
  autosaveInterval.value = setInterval(() => {
    saveAutosave(input.value)
  }, 30000)
}

const loadAutosavedContent = () => {
  const saved = loadAutosave()
  if (saved && saved !== input.value) {
    // Could show a prompt here, but for simplicity we just load it
    // only if the current content is the default
    const defaultStart = '// МТС — Ассоциативный прувер'
    if (input.value.startsWith(defaultStart) && !saved.startsWith(defaultStart)) {
      // Don't overwrite default with empty/different autosave
    } else if (saved.trim()) {
      // input.value = saved
      // Disabled: don't auto-restore, let user choose via file operations
    }
  }
}

// Keyboard shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
  // Ctrl+O: Open file
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault()
    handleFileOpen()
    return
  }

  // Ctrl+S: Save code
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleSaveCode()
    return
  }

  // Ctrl+Shift+S: Save results
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
    e.preventDefault()
    handleSaveResults()
    return
  }

  // Ctrl+N: New file
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault()
    handleNewFile()
    return
  }

  // Escape: Close recent files dropdown
  if (e.key === 'Escape' && showRecentFiles.value) {
    showRecentFiles.value = false
    return
  }
}

// Click outside handler for recent files dropdown
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (
    showRecentFiles.value &&
    !target.closest('.recent-files-dropdown') &&
    !target.closest('.recent-btn')
  ) {
    showRecentFiles.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadRecentFiles()
  setupAutosave()
  loadAutosavedContent()
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (autosaveInterval.value) {
    clearInterval(autosaveInterval.value)
  }
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <h1>aprover</h1>
        <span class="version">v0.2.0</span>
      </div>
      <p class="subtitle">Ассоциативный прувер для формальной нотации Метатеории Связей (МТС)</p>
      <div class="header-right">
        <div class="toolbar">
          <button class="toolbar-btn" title="Новый файл (Ctrl+N)" @click="handleNewFile">
            <span class="btn-icon">📄</span>
            <span class="btn-text">Новый</span>
          </button>
          <button class="toolbar-btn" title="Открыть файл (Ctrl+O)" @click="handleFileOpen">
            <span class="btn-icon">📂</span>
            <span class="btn-text">Открыть</span>
          </button>
          <div class="dropdown-container">
            <button
              class="toolbar-btn recent-btn"
              title="Недавние файлы"
              @click="toggleRecentFiles"
            >
              <span class="btn-icon">🕐</span>
              <span class="btn-text">Недавние</span>
              <span class="dropdown-arrow">▼</span>
            </button>
            <div v-if="showRecentFiles" class="recent-files-dropdown">
              <div v-if="recentFiles.length === 0" class="recent-empty">Нет недавних файлов</div>
              <div v-else>
                <div
                  v-for="file in recentFiles"
                  :key="file.name"
                  class="recent-file-item"
                  @click="handleRecentFileClick(file)"
                >
                  <span class="recent-file-name">{{ file.name }}</span>
                  <span class="recent-file-preview">{{ file.preview }}</span>
                  <button
                    class="recent-file-remove"
                    title="Удалить из списка"
                    @click="handleRemoveRecentFile($event, file.name)"
                  >
                    ×
                  </button>
                </div>
                <div class="recent-actions">
                  <button class="recent-clear-btn" @click="handleClearRecentFiles">
                    Очистить историю
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="toolbar-separator"></div>
          <button class="toolbar-btn" title="Сохранить код (Ctrl+S)" @click="handleSaveCode">
            <span class="btn-icon">💾</span>
            <span class="btn-text">Сохранить</span>
          </button>
          <button
            class="toolbar-btn"
            :disabled="results.length === 0"
            title="Сохранить результаты"
            @click="handleSaveResults"
          >
            <span class="btn-icon">📋</span>
            <span class="btn-text">Результаты</span>
          </button>
          <button
            class="toolbar-btn"
            :disabled="results.length === 0"
            title="Экспорт в JSON"
            @click="handleExportJson"
          >
            <span class="btn-icon">{ }</span>
            <span class="btn-text">JSON</span>
          </button>
        </div>
        <div class="toolbar-separator"></div>
        <button class="toggle-btn" :class="{ active: showAST }" @click="toggleAST">
          {{ showAST ? 'Hide AST' : 'Show AST' }}
        </button>
      </div>
    </header>

    <main class="app-main" :class="{ 'with-ast': showAST }">
      <div class="panel editor-panel">
        <Editor
          v-model="input"
          :highlighted-loc="highlightedLoc"
          :file-name="currentFileName || undefined"
          :is-drag-over="isDragOver"
          @file-drop="handleFileDrop"
        />
      </div>

      <div v-if="showAST" class="panel ast-panel">
        <ASTViewer :ast="ast" :error="error" @node-hover="handleNodeHover" />
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Toolbar styles */
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--accent-color);
  color: #94a3b8;
  border: 1px solid var(--border-color);
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.toolbar-btn:hover:not(:disabled) {
  background: #1a3a5c;
  color: var(--text-color);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-btn .btn-icon {
  font-size: 0.85rem;
}

.toolbar-btn .btn-text {
  display: none;
}

@media (min-width: 1024px) {
  .toolbar-btn .btn-text {
    display: inline;
  }
}

.toolbar-separator {
  width: 1px;
  height: 1.5rem;
  background: var(--border-color);
  margin: 0 0.25rem;
}

.dropdown-arrow {
  font-size: 0.6rem;
  margin-left: 0.15rem;
}

/* Recent files dropdown */
.dropdown-container {
  position: relative;
}

.recent-files-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.25rem;
  min-width: 280px;
  max-width: 350px;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  overflow: hidden;
}

.recent-empty {
  padding: 1rem;
  color: #64748b;
  text-align: center;
  font-size: 0.85rem;
}

.recent-file-item {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
  position: relative;
}

.recent-file-item:hover {
  background: var(--accent-color);
}

.recent-file-item:last-child {
  border-bottom: none;
}

.recent-file-name {
  font-size: 0.85rem;
  color: var(--text-color);
  font-weight: 500;
}

.recent-file-preview {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.15rem;
}

.recent-file-remove {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #64748b;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.recent-file-item:hover .recent-file-remove {
  opacity: 1;
}

.recent-file-remove:hover {
  color: var(--error-color);
}

.recent-actions {
  padding: 0.5rem;
  border-top: 1px solid var(--border-color);
  text-align: center;
}

.recent-clear-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
}

.recent-clear-btn:hover {
  color: var(--error-color);
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
