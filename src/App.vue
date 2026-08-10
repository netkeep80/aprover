<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Editor from './components/Editor.vue'
import ASTViewer from './components/ASTViewer.vue'
import GraphView from './components/GraphView.vue'
import AnumDenotationPanel from './components/AnumDenotationPanel.vue'
import ProofReplayPanel from './components/ProofReplayPanel.vue'
import type { ASTNode, File, SourceLocation } from './core/ast'
import { parseWithRecovery } from './core/parser'
import type { ParseError } from './core/parser'
import {
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  saveAutosave,
  loadAutosave,
  clearAutosave,
  downloadFile,
  openFileDialog,
  getFileExtension,
  isSupportedFile,
  readFileContent,
  type FileMetadata,
} from './core/fileIO'
import {
  parseStringAnum,
  stringAnumToFormal,
  stringAnumFileToMtl,
  visualizeConversion,
  type ConversionStep,
} from './core/stringAnum'
import {
  validateQuatAnum,
  quatAnumToStringAnum,
  quatAnumFileToMtl,
  visualizeQuatConversion,
  type QuatConversionStep,
} from './core/quatAnum'
import { projectStatementsToGraph, type LinkGraph } from './core/linkGraph'
import packageJson from '../package.json'

const appVersion = packageJson.version

const defaultSource = `# Каноническая корневая библиотека МТС v0.2
∞ : {◁ = ∞, ▷ = ∞}
♀∞ : {◁ = ∞, ▷ = ♀∞}
∞♂ : {◁ = ∞♂, ▷ = ∞}
(⟼) : {◁ = ♀∞, ▷ = ∞♂}
(↛) : ¬(⟼)
1 : [(⟼)]
0 : [(↛)]
(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}
(!=) : ¬(=)
(:) : {(⟼) = ◁, (=) = ▷}
`

const input = ref(defaultSource)
const ast = ref<File | null>(null)
const error = ref<ParseError | null>(null)
const highlightedNodeLoc = ref<SourceLocation | null>(null)
const showAST = ref(true)
const showGraph = ref(false)
const showConversion = ref(false)
const showProofReplay = ref(false)
const proofSource = ref('')
const graph = ref<LinkGraph | null>(null)
const currentFileName = ref('untitled.mtl')
const currentFileType = ref<'mtl' | 'astr' | 'anum'>('mtl')
const conversionSteps = ref<ConversionStep[]>([])
const quatConversionSteps = ref<QuatConversionStep[]>([])
const anumRawLines = ref<string[]>([])
const recentFiles = ref<FileMetadata[]>([])
const showRecentFiles = ref(false)
const autosaveInterval = ref<ReturnType<typeof setInterval> | null>(null)

const statementCount = computed(() => ast.value?.statements.length ?? 0)

const parseInput = () => {
  const result = parseWithRecovery(input.value)
  ast.value = result.ast
  error.value = result.errors[0] ?? null
  graph.value = result.ast ? projectStatementsToGraph(result.ast.statements) : null
}

watch(input, () => {
  parseInput()
  saveAutosave(input.value)
})

const handleNodeHover = (node: ASTNode | null) => {
  highlightedNodeLoc.value = node?.loc ?? null
}

const toggleAST = () => {
  showAST.value = !showAST.value
}

const toggleGraph = () => {
  showGraph.value = !showGraph.value
}

const toggleConversion = () => {
  showConversion.value = !showConversion.value
}

const toggleProofReplay = () => {
  showProofReplay.value = !showProofReplay.value
}

const handleNewFile = () => {
  input.value = defaultSource
  currentFileName.value = 'untitled.mtl'
  currentFileType.value = 'mtl'
  conversionSteps.value = []
  quatConversionSteps.value = []
  anumRawLines.value = []
  clearAutosave()
}

const handleFileOpen = async () => {
  const file = await openFileDialog()
  if (!file || !isSupportedFile(file.name)) return

  const content = await readFileContent(file)
  const extension = getFileExtension(file.name)
  currentFileName.value = file.name
  currentFileType.value = extension
  addRecentFile(file.name, content)
  recentFiles.value = getRecentFiles()

  if (extension === 'astr') {
    const parsed = parseStringAnum(content)
    input.value = stringAnumFileToMtl(parsed)
    conversionSteps.value = parsed.flatMap((node, index) =>
      visualizeConversion(node, index + 1).map(step => ({ ...step, formal: stringAnumToFormal(node) }))
    )
    quatConversionSteps.value = []
    anumRawLines.value = []
    showConversion.value = true
    return
  }

  if (extension === 'anum') {
    const rawLines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
    anumRawLines.value = rawLines
    const formalLines: string[] = []
    const stringLines: string[] = []
    const steps: QuatConversionStep[] = []
    for (const [index, raw] of rawLines.entries()) {
      const validation = validateQuatAnum(raw)
      if (!validation.valid) continue
      const stringAnum = quatAnumToStringAnum(raw)
      stringLines.push(stringAnum)
      formalLines.push(quatAnumFileToMtl(raw))
      steps.push(...visualizeQuatConversion(raw, index + 1))
    }
    input.value = formalLines.join('\n')
    quatConversionSteps.value = steps
    conversionSteps.value = stringLines.flatMap((line, index) => {
      const parsed = parseStringAnum(line)
      return parsed.flatMap(node => visualizeConversion(node, index + 1))
    })
    showConversion.value = true
    return
  }

  input.value = content
  conversionSteps.value = []
  quatConversionSteps.value = []
  anumRawLines.value = []
}

const handleSaveCode = () => {
  downloadFile(currentFileName.value, input.value)
}

const toggleRecentFiles = (event: Event) => {
  event.stopPropagation()
  showRecentFiles.value = !showRecentFiles.value
}

const handleRecentFileClick = (file: FileMetadata) => {
  input.value = file.content
  currentFileName.value = file.name
  currentFileType.value = getFileExtension(file.name)
  showRecentFiles.value = false
}

const handleRemoveRecentFile = (event: Event, name: string) => {
  event.stopPropagation()
  removeRecentFile(name)
  recentFiles.value = getRecentFiles()
}

const handleClearRecentFiles = () => {
  clearRecentFiles()
  recentFiles.value = []
}

const handleClickOutside = () => {
  showRecentFiles.value = false
}

const handleKeyDown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    handleSaveCode()
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    handleNewFile()
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
    event.preventDefault()
    void handleFileOpen()
  }
}

onMounted(() => {
  recentFiles.value = getRecentFiles()
  const autosave = loadAutosave()
  if (autosave) input.value = autosave
  parseInput()
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
      <p class="subtitle">Визуальный consumer канонической формальной нотации МТС v0.2</p>
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
          <button
            class="toolbar-btn proof-replay-toggle"
            :class="{ active: showProofReplay }"
            title="Trusted proof replay"
            @click="toggleProofReplay"
          >
            PRF <span>Proof</span>
          </button>
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
      Current trusted proof path: <code>mts-proof/v0.4</code> under <code>mts-contract/v0.5</code>. Search строит только current artifact; acceptance всегда определяется independent replay.
    </div>

    <ProofReplayPanel
      v-if="showProofReplay"
      v-model="proofSource"
      @close="showProofReplay = false"
    />

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

    <main class="main-content">
      <section class="editor-panel">
        <Editor v-model="input" :highlighted-loc="highlightedNodeLoc" />
      </section>

      <section v-if="showAST" class="ast-panel">
        <ASTViewer
          :ast="ast"
          :error="error"
          :highlighted-node-loc="highlightedNodeLoc"
          @node-hover="handleNodeHover"
        />
      </section>

      <section v-if="showGraph" class="graph-panel">
        <GraphView :graph="graph" />
      </section>
    </main>

    <footer class="app-footer">
      <span>{{ statementCount }} statements parsed</span>
      <span class="separator">·</span>
      <a href="https://github.com/netkeep80/anum_docs" target="_blank" rel="noopener">anum_docs</a>
      <span class="separator">·</span>
      <a href="https://github.com/netkeep80/aprover" target="_blank" rel="noopener">GitHub</a>
    </footer>
  </div>
</template>

<style>
:root {
  --bg-color: #020617;
  --panel-bg: #0f172a;
  --accent-color: #1e293b;
  --border-color: #334155;
  --text-color: #e2e8f0;
  --success-color: #4ade80;
  --error-color: #f87171;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; width: 100%; }
body { font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; background: var(--bg-color); color: var(--text-color); line-height: 1.5; }
button, textarea { font-family: inherit; }
.app-container { display: flex; flex-direction: column; height: 100vh; width: 100%; padding: .5rem; overflow: hidden; gap: .5rem; }
.app-header { display: flex; align-items: center; gap: 1rem; padding: .65rem 1rem; background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 8px; }
.header-left { display: flex; align-items: baseline; gap: .5rem; }
.header-left h1 { font-size: 1.5rem; }
.version, .subtitle { color: #94a3b8; font-size: .78rem; }
.subtitle { flex: 1; }
.header-right, .toolbar, .view-controls { display: flex; align-items: center; gap: .35rem; }
.toolbar-btn, .toggle-btn, .recent-clear-btn { background: var(--accent-color); color: #cbd5e1; border: 1px solid var(--border-color); padding: .35rem .55rem; border-radius: 4px; cursor: pointer; }
.toolbar-btn:hover, .toggle-btn:hover, .recent-clear-btn:hover { color: white; }
.toolbar-btn.active, .toggle-btn.active { border-color: #667eea; color: white; }
.graph-btn-toggle:disabled { opacity: .45; cursor: not-allowed; }
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
.main-content { flex: 1; min-height: 0; overflow: hidden; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .5rem; }
.editor-panel, .ast-panel, .graph-panel { height: 100%; min-width: 0; overflow: hidden; }
.ast-panel, .graph-panel { border: 1px solid var(--border-color); border-radius: 4px; }
.app-footer { display: flex; align-items: center; justify-content: center; gap: .6rem; color: #64748b; font-size: .72rem; }
.app-footer a { color: #94a3b8; text-decoration: none; }
.separator { color: #334155; }
@media (max-width: 1100px) {
  .subtitle { display: none; }
  .main-content { grid-template-columns: 1fr; overflow: auto; }
  .ast-panel, .graph-panel { min-height: 320px; }
  .toolbar span { display: none; }
}
</style>
