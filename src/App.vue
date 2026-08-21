<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { parseWithRecovery, ParseError } from './core/parser'
import type { File as MtsFile, SourceLocation } from './core/ast'
import Editor from './components/Editor.vue'
import ASTViewer from './components/ASTViewer.vue'
import ErrorPanel from './components/ErrorPanel.vue'
import LinkGraphViewer from './components/LinkGraphViewer.vue'
import AnumDenotationPanel from './components/AnumDenotationPanel.vue'
import SplitPane from './components/SplitPane.vue'
import {
  readFileContent,
  getFilePreview,
  isSupportedFile,
  getFileExtension,
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  saveAutosave,
  downloadFile,
  openFileDialog,
  type FileMetadata,
} from './core/fileIO'
import { stringAnumFileToMtl, visualizeConversion, type ConversionStep } from './core/stringAnum'
import {
  quatAnumFileToMtl,
  visualizeQuatConversion,
  type QuatConversionStep,
} from './core/quatAnum'

const CANONICAL_ROOT = `// Application notation sample
// Теория и current semantic authority: exact-pinned @mts/core v0.10 from netkeep80/anum_docs

∞ : {◁ = ∞, ▷ = ∞}
() : ♀() ⟼ ()♂
([) : (♀∞)
(]) : (∞♂)
(⟼) : (♀∞ ⟼ ∞♂)
(↛) : (∞♂ ⟼ ♀∞)
[1] : (⟼)
[0] : (↛)
(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}
(!=) : ¬(=)
`

const input = ref(CANONICAL_ROOT)
const error = ref<string | null>(null)
const errorLocation = ref<SourceLocation | null>(null)
const ast = ref<MtsFile | null>(null)

const showAST = ref(true)
const showGraph = ref(false)
const highlightedLoc = ref<SourceLocation | null>(null)
const highlightedNodeLoc = ref<SourceLocation | null>(null)

const currentFileName = ref<string | null>(null)
const currentFileType = ref<'mtl' | 'astr' | 'anum'>('mtl')
const showRecentFiles = ref(false)
const recentFiles = ref<FileMetadata[]>([])

const showConversion = ref(false)
const conversionSteps = ref<ConversionStep[]>([])
const quatConversionSteps = ref<QuatConversionStep[]>([])
const anumRawLines = ref<string[]>([])

const appVersion = __APP_VERSION__
const splitPaneRef = ref<InstanceType<typeof SplitPane> | null>(null)
const autosaveInterval = ref<ReturnType<typeof setInterval> | null>(null)

const handleSplitResize = () => window.dispatchEvent(new Event('resize'))
const toggleAST = () => (showAST.value = !showAST.value)
const toggleGraph = () => (showGraph.value = !showGraph.value)

const handleNodeHover = (loc: SourceLocation | null) => {
  highlightedLoc.value = loc
}

const handleCursorPosition = (loc: SourceLocation | null) => {
  highlightedNodeLoc.value = loc
}

const parseInput = () => {
  error.value = null
  errorLocation.value = null
  ast.value = null

  try {
    const result = parseWithRecovery(input.value)
    if (result.error) {
      error.value = result.error.message
      errorLocation.value = result.errorLocation ?? null
    }
    ast.value = result.file
  } catch (cause) {
    if (cause instanceof ParseError) {
      error.value = cause.message
      errorLocation.value = cause.token.loc
    } else if (cause instanceof Error) {
      error.value = cause.message
    } else {
      error.value = 'Unknown error'
    }
  }
}

watch(input, parseInput, { immediate: true })

const loadRecentFiles = () => {
  recentFiles.value = getRecentFiles()
}

const handleFileOpen = async () => {
  const files = await openFileDialog('.mtl,.astr,.anum', false)
  if (files?.length) await loadFile(files[0])
}

const loadFile = async (file: globalThis.File) => {
  if (!isSupportedFile(file.name)) {
    error.value = `Неподдерживаемый формат файла: ${file.name}. Поддерживаются: .mtl, .astr, .anum`
    return
  }

  try {
    const content = await readFileContent(file)
    const extension = getFileExtension(file.name)
    currentFileName.value = file.name
    conversionSteps.value = []
    quatConversionSteps.value = []
    anumRawLines.value = []
    showConversion.value = false

    if (extension === '.astr') {
      currentFileType.value = 'astr'
      const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'))
      if (lines.length) {
        conversionSteps.value = visualizeConversion(lines[0].trim())
        showConversion.value = true
      }
      input.value = stringAnumFileToMtl(content)
    } else if (extension === '.anum') {
      currentFileType.value = 'anum'
      const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'))
      anumRawLines.value = lines.map(line => line.trim())
      if (lines.length) {
        quatConversionSteps.value = visualizeQuatConversion(lines[0].trim())
        showConversion.value = true
      }
      input.value = quatAnumFileToMtl(content)
    } else {
      currentFileType.value = 'mtl'
      input.value = content
    }

    addRecentFile(file.name, file.size, getFilePreview(content))
    loadRecentFiles()
    showRecentFiles.value = false
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Ошибка чтения файла'
  }
}

const handleFileDrop = (file: globalThis.File) => {
  void loadFile(file)
}

const handleSaveCode = () => {
  downloadFile(input.value, currentFileName.value || 'code.mtl', 'text/plain')
}

const handleNewFile = () => {
  currentFileName.value = null
  currentFileType.value = 'mtl'
  showConversion.value = false
  conversionSteps.value = []
  quatConversionSteps.value = []
  anumRawLines.value = []
  input.value = CANONICAL_ROOT
}

const toggleConversion = () => {
  showConversion.value = !showConversion.value
}

const toggleRecentFiles = () => {
  showRecentFiles.value = !showRecentFiles.value
  if (showRecentFiles.value) loadRecentFiles()
}

const handleRecentFileClick = (file: FileMetadata) => {
  showRecentFiles.value = false
  alert(`Для открытия файла "${file.name}" используйте кнопку "Открыть"`)
}

const handleRemoveRecentFile = (event: Event, name: string) => {
  event.stopPropagation()
  removeRecentFile(name)
  loadRecentFiles()
}

const handleClearRecentFiles = () => {
  clearRecentFiles()
  loadRecentFiles()
}

const handleKeyDown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
    event.preventDefault()
    void handleFileOpen()
  } else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
    handleSaveCode()
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
    event.preventDefault()
    handleNewFile()
  } else if (event.key === 'Escape') {
    showRecentFiles.value = false
  }
}

const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (
    showRecentFiles.value &&
    !target.closest('.recent-files-dropdown') &&
    !target.closest('.recent-btn')
  ) {
    showRecentFiles.value = false
  }
}

onMounted(() => {
  loadRecentFiles()
  autosaveInterval.value = setInterval(() => saveAutosave(input.value), 30000)
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (autosaveInterval.value) clearInterval(autosaveInterval.value)
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <h1>aprover</h1>
        <span class="version">v{{ appVersion }}</span>
      </div>
      <p class="subtitle">Визуальный consumer МТС · current semantics: exact @mts/core v0.10</p>
      <div class="header-right">
        <div class="toolbar">
          <button class="toolbar-btn" title="Новый файл (Ctrl+N)" @click="handleNewFile">📄 <span>Новый</span></button>
          <button class="toolbar-btn" title="Открыть файл (Ctrl+O)" @click="handleFileOpen">📂 <span>Открыть</span></button>
          <div class="dropdown-container">
            <button class="toolbar-btn recent-btn" title="Недавние файлы" @click="toggleRecentFiles">🕐 <span>Недавние</span></button>
            <div v-if="showRecentFiles" class="recent-files-dropdown">
              <div v-if="recentFiles.length === 0" class="recent-empty">Нет недавних файлов</div>
              <template v-else>
                <div v-for="file in recentFiles" :key="file.name" class="recent-file-item" @click="handleRecentFileClick(file)">
                  <span class="recent-file-name">{{ file.name }}</span>
                  <span class="recent-file-preview">{{ file.preview }}</span>
                  <button class="recent-file-remove" title="Удалить из списка" @click="handleRemoveRecentFile($event, file.name)">×</button>
                </div>
                <button class="recent-clear-btn" @click="handleClearRecentFiles">Очистить историю</button>
              </template>
            </div>
          </div>
          <button class="toolbar-btn" title="Сохранить код (Ctrl+S)" @click="handleSaveCode">💾 <span>Сохранить</span></button>
        </div>
        <div class="view-controls">
          <button
            v-if="currentFileType === 'astr' || currentFileType === 'anum'"
            class="toggle-btn"
            :class="{ active: showConversion }"
            @click="toggleConversion"
          >
            {{ showConversion ? 'Hide Conv' : 'Show Conv' }}
          </button>
          <button class="toggle-btn" :class="{ active: showAST }" @click="toggleAST">
            {{ showAST ? 'Hide AST' : 'Show AST' }}
          </button>
          <button
            class="toggle-btn graph-btn-toggle"
            :class="{ active: showGraph }"
            :disabled="!ast || ast.statements.length === 0"
            @click="toggleGraph"
          >
            {{ showGraph ? 'Hide Graph' : 'Graph' }}
          </button>
          <span v-if="currentFileType !== 'mtl'" class="file-type-badge">{{ currentFileType.toUpperCase() }}</span>
        </div>
      </div>
    </header>

    <div class="runtime-note">
      Current MTS semantic authority: <code>exact @mts/core v0.10</code> from the immutable consumer lock.
    </div>

    <div v-if="showConversion && conversionSteps.length" class="conversion-panel">
      <div v-for="(step, index) in conversionSteps" :key="index" class="conversion-step">
        <strong>{{ index }}</strong>
        <span>{{ step.description }}</span>
        <code>{{ step.formal }}</code>
      </div>
    </div>
    <div v-if="showConversion && quatConversionSteps.length" class="conversion-panel">
      <div v-for="(step, index) in quatConversionSteps" :key="index" class="conversion-step">
        <strong>{{ index }}</strong>
        <span>{{ step.description }}</span>
        <code>{{ step.formal }}</code>
      </div>
    </div>
    <AnumDenotationPanel
      v-if="showConversion && currentFileType === 'anum' && anumRawLines.length"
      :raw-lines="anumRawLines"
    />

    <ErrorPanel :error="error" />

    <main class="app-main">
      <SplitPane
        v-if="showAST && showGraph"
        key="ast-graph"
        ref="splitPaneRef"
        direction="horizontal"
        :min-size="150"
        :initial-sizes="[40, 30, 30]"
        @resize="handleSplitResize"
      >
        <template #pane-0>
          <div class="panel editor-panel">
            <Editor
              v-model="input"
              :highlighted-loc="highlightedLoc"
              :error-loc="errorLocation"
              :file-name="currentFileName || undefined"
              @file-drop="handleFileDrop"
              @cursor-position="handleCursorPosition"
            />
          </div>
        </template>
        <template #pane-1>
          <div class="panel ast-panel">
            <ASTViewer :ast="ast" :error="error" :highlighted-node-loc="highlightedNodeLoc" @node-hover="handleNodeHover" />
          </div>
        </template>
        <template #pane-2>
          <div class="panel graph-panel"><LinkGraphViewer :ast="ast" /></div>
        </template>
      </SplitPane>

      <SplitPane
        v-else-if="showAST"
        key="ast-only"
        ref="splitPaneRef"
        direction="horizontal"
        :min-size="150"
        :initial-sizes="[55, 45]"
        @resize="handleSplitResize"
      >
        <template #pane-0>
          <div class="panel editor-panel">
            <Editor
              v-model="input"
              :highlighted-loc="highlightedLoc"
              :error-loc="errorLocation"
              :file-name="currentFileName || undefined"
              @file-drop="handleFileDrop"
              @cursor-position="handleCursorPosition"
            />
          </div>
        </template>
        <template #pane-1>
          <div class="panel ast-panel">
            <ASTViewer :ast="ast" :error="error" :highlighted-node-loc="highlightedNodeLoc" @node-hover="handleNodeHover" />
          </div>
        </template>
      </SplitPane>

      <SplitPane
        v-else-if="showGraph"
        key="graph-only"
        ref="splitPaneRef"
        direction="horizontal"
        :min-size="150"
        :initial-sizes="[55, 45]"
        @resize="handleSplitResize"
      >
        <template #pane-0>
          <div class="panel editor-panel">
            <Editor
              v-model="input"
              :highlighted-loc="highlightedLoc"
              :error-loc="errorLocation"
              :file-name="currentFileName || undefined"
              @file-drop="handleFileDrop"
              @cursor-position="handleCursorPosition"
            />
          </div>
        </template>
        <template #pane-1>
          <div class="panel graph-panel"><LinkGraphViewer :ast="ast" /></div>
        </template>
      </SplitPane>

      <div v-else class="panel editor-panel single-editor">
        <Editor
          v-model="input"
          :highlighted-loc="highlightedLoc"
          :error-loc="errorLocation"
          :file-name="currentFileName || undefined"
          @file-drop="handleFileDrop"
          @cursor-position="handleCursorPosition"
        />
      </div>
    </main>

    <footer class="app-footer">
      <span>{{ ast?.statements.length ?? 0 }} statements parsed</span>
      <span class="footer-separator">|</span>
      <span>МТС theory: anum_docs</span>
      <span class="footer-separator">|</span>
      <a href="https://github.com/netkeep80/aprover" target="_blank" rel="noopener">GitHub</a>
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

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; background: var(--bg-color); color: var(--text-color); line-height: 1.5; }
button { font-family: inherit; }
.app-container { display: flex; flex-direction: column; height: 100vh; width: 100%; padding: .5rem; overflow: hidden; gap: .5rem; }
.app-header { display: flex; align-items: center; gap: 1rem; padding: .65rem 1rem; background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 8px; }
.header-left { display: flex; align-items: baseline; gap: .5rem; }
.app-header h1 { font-size: 1.5rem; }
.version, .subtitle { color: #94a3b8; font-size: .78rem; }
.subtitle { flex: 1; }
.header-right, .toolbar, .view-controls { display: flex; align-items: center; gap: .35rem; }
.toolbar-btn, .toggle-btn, .recent-clear-btn { background: var(--accent-color); color: #cbd5e1; border: 1px solid var(--border-color); padding: .35rem .55rem; border-radius: 4px; cursor: pointer; }
.toolbar-btn:hover, .toggle-btn:hover, .recent-clear-btn:hover { color: white; }
.toolbar-btn.active, .toggle-btn.active { border-color: #667eea; color: white; }
.toggle-btn:disabled { opacity: .45; cursor: not-allowed; }
.dropdown-container { position: relative; }
.recent-files-dropdown { position: absolute; right: 0; top: calc(100% + .25rem); z-index: 20; min-width: 290px; background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 4px; padding: .35rem; }
.recent-empty { color: #94a3b8; padding: .6rem; }
.recent-file-item { position: relative; display: flex; flex-direction: column; gap: .1rem; padding: .45rem 1.7rem .45rem .45rem; cursor: pointer; }
.recent-file-item:hover { background: rgba(255,255,255,.05); }
.recent-file-name { font-size: .8rem; }
.recent-file-preview { color: #64748b; font-size: .7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-file-remove { position: absolute; right: .35rem; top: .35rem; background: none; border: 0; color: #94a3b8; cursor: pointer; font-size: 1rem; }
.recent-clear-btn { width: 100%; margin-top: .25rem; font-size: .7rem; }
.file-type-badge { font-size: .7rem; color: #a78bfa; }
.runtime-note { padding: .45rem .7rem; border: 1px solid var(--border-color); border-radius: 4px; color: #94a3b8; font-size: .75rem; }
.runtime-note code { color: #c4b5fd; }
.conversion-panel { display: flex; flex-direction: column; gap: .25rem; max-height: 160px; overflow: auto; padding: .5rem; background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 4px; }
.conversion-step { display: grid; grid-template-columns: 2rem 1fr 1fr; gap: .5rem; font-size: .75rem; }
.conversion-step code { color: #c4b5fd; }
.app-main { flex: 1; min-height: 0; overflow: hidden; }
.panel { height: 100%; min-width: 0; overflow: hidden; }
.single-editor { border: 1px solid var(--border-color); border-radius: 4px; }
.app-footer { display: flex; align-items: center; justify-content: center; gap: .6rem; color: #64748b; font-size: .72rem; }
.app-footer a { color: #94a3b8; text-decoration: none; }
.footer-separator { color: #334155; }
@media (max-width: 1000px) {
  .subtitle { display: none; }
  .toolbar-btn span { display: none; }
  .app-header { gap: .5rem; }
}
</style>