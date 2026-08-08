<script setup lang="ts">
import { defineEmits, defineProps, ref, watch, computed } from 'vue'
import type { SourceLocation } from '../core/ast'

const props = defineProps<{
  modelValue: string
  highlightedLoc?: SourceLocation | null
  errorLoc?: SourceLocation | null
  fileName?: string
  isDragOver?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'file-drop': [file: File]
  'cursor-position': [loc: SourceLocation | null]
}>()

const insertSymbol = (symbol: string) => {
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const currentValue = props.modelValue
  const newValue = currentValue.substring(0, start) + symbol + currentValue.substring(end)

  emit('update:modelValue', newValue)

  setTimeout(() => {
    textarea.focus()
    const newCursorPos = start + symbol.length
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  }, 0)
}

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const localValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

interface Token {
  type: string
  value: string
}

/** Presentation-only highlighter for accepted MTS v0.2 spellings. */
function tokenizeLine(code: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < code.length) {
    if (code.slice(pos, pos + 2) === '!=') {
      tokens.push({ type: 'equality', value: '!=' })
      pos += 2
      continue
    }

    const char = code[pos]

    if (char === '⟼') {
      tokens.push({ type: 'operator', value: char })
      pos++
      continue
    }
    if (char === '↛') {
      // `↛` is a canonical glyph only as a formal literal such as `(↛)`;
      // highlighting it does not turn it into a binary operator.
      tokens.push({ type: 'symbol', value: char })
      pos++
      continue
    }
    if (char === '∞') {
      tokens.push({ type: 'symbol infinity', value: char })
      pos++
      continue
    }
    if (char === '♂') {
      tokens.push({ type: 'symbol male', value: char })
      pos++
      continue
    }
    if (char === '♀') {
      tokens.push({ type: 'symbol female', value: char })
      pos++
      continue
    }
    if (char === '¬') {
      tokens.push({ type: 'negation', value: char })
      pos++
      continue
    }
    if (char === '◁' || char === '▷' || char === '↑') {
      tokens.push({ type: 'symbol context', value: char })
      pos++
      continue
    }

    if (
      char === ':' &&
      pos > 0 &&
      pos < code.length - 1 &&
      /\s/.test(code[pos - 1]) &&
      /\s/.test(code[pos + 1])
    ) {
      tokens.push({ type: 'define', value: char })
      pos++
      continue
    }

    if (char === '=') {
      tokens.push({ type: 'equality', value: char })
      pos++
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'bracket paren', value: char })
      pos++
      continue
    }
    if (char === '{' || char === '}') {
      tokens.push({ type: 'bracket brace', value: char })
      pos++
      continue
    }
    if (char === '[' || char === ']') {
      tokens.push({ type: 'bracket square', value: char })
      pos++
      continue
    }

    if (char === '.' && (pos === code.length - 1 || /\s/.test(code[pos + 1]))) {
      tokens.push({ type: 'dot', value: char })
      pos++
      continue
    }

    if (
      (char === '0' || char === '1') &&
      (pos === 0 || !/[a-zA-Zа-яА-ЯёЁ0-9_]/.test(code[pos - 1])) &&
      (pos === code.length - 1 || !/[a-zA-Zа-яА-ЯёЁ0-9_]/.test(code[pos + 1]))
    ) {
      tokens.push({ type: 'number', value: char })
      pos++
      continue
    }

    if (/[a-zA-Zа-яА-ЯёЁ_]/.test(char)) {
      let id = char
      pos++
      while (pos < code.length && /[a-zA-Zа-яА-ЯёЁ0-9_]/.test(code[pos])) {
        id += code[pos]
        pos++
      }
      tokens.push({ type: 'identifier', value: id })
      continue
    }

    tokens.push({ type: 'text', value: char })
    pos++
  }

  return tokens
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function tokensToHtml(tokens: Token[]): string {
  return tokens
    .map(token => {
      const escaped = escapeHtml(token.value)
      if (token.type === 'text') return escaped
      return `<span class="${token.type}">${escaped}</span>`
    })
    .join('')
}

function applyHighlightMarker(
  html: string,
  lineIndex: number,
  loc: SourceLocation | null | undefined
): string {
  if (!loc) return html

  const startLine = loc.start.line - 1
  const endLine = loc.end.line - 1
  if (lineIndex < startLine || lineIndex > endLine) return html
  return `<span class="ast-highlight">${html}</span>`
}

function applyErrorHighlight(
  html: string,
  line: string,
  lineIndex: number,
  errorLoc: SourceLocation | null | undefined
): string {
  if (!errorLoc) return html

  const errorLine = errorLoc.start.line - 1
  const errorCol = errorLoc.start.column - 1
  if (lineIndex !== errorLine) return html

  let charCount = 0
  let insertPos = 0
  let inTag = false
  let foundPosition = false

  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<') {
      inTag = true
    } else if (html[i] === '>') {
      inTag = false
      continue
    }

    if (!inTag) {
      if (charCount === errorCol) {
        insertPos = i
        foundPosition = true
        break
      }
      charCount++
    }
  }

  if (foundPosition && insertPos < html.length) {
    let endPos = insertPos + 1
    if (html[insertPos] === '&') {
      while (endPos < html.length && html[endPos] !== ';') endPos++
      if (html[endPos] === ';') endPos++
    }

    const before = html.substring(0, insertPos)
    const char = html.substring(insertPos, endPos)
    const after = html.substring(endPos)
    return `${before}<span class="error-highlight">${char}</span>${after}`
  }

  return html
}

const highlightedContent = computed(() => {
  const lines = props.modelValue.split('\n')
  const processedLines = lines.map((line, lineIndex) => {
    let result: string
    const commentIndex = line.indexOf('//')
    if (commentIndex !== -1) {
      const beforeComment = line.substring(0, commentIndex)
      const comment = line.substring(commentIndex)
      result = tokensToHtml(tokenizeLine(beforeComment))
      result += `<span class="comment">${escapeHtml(comment)}</span>`
    } else {
      result = tokensToHtml(tokenizeLine(line))
    }

    result = applyErrorHighlight(result, line, lineIndex, props.errorLoc)
    result = applyHighlightMarker(result, lineIndex, props.highlightedLoc)
    return result
  })

  return processedLines.join('\n')
})

const handleScroll = () => {
  const textarea = textareaRef.value
  const highlight = document.querySelector('.highlight-layer') as HTMLElement
  if (textarea && highlight) {
    highlight.scrollTop = textarea.scrollTop
    highlight.scrollLeft = textarea.scrollLeft
  }
}

watch(
  () => props.modelValue,
  () => {
    // Trigger re-render of highlighted content.
  }
)

const isDragging = ref(false)

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0) emit('file-drop', files[0])
}

const displayFileName = computed(() => props.fileName || 'input.mtl')

const fileExtBadge = computed(() => {
  const ext = displayFileName.value.split('.').pop()?.toUpperCase()
  return ext || 'MTL'
})

const handleMouseMove = (e: MouseEvent) => {
  const textarea = textareaRef.value
  if (!textarea) return

  const rect = textarea.getBoundingClientRect()
  const x = e.clientX - rect.left + textarea.scrollLeft
  const y = e.clientY - rect.top + textarea.scrollTop
  const lines = props.modelValue.split('\n')
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight)
  const charWidth = parseFloat(getComputedStyle(textarea).fontSize) * 0.6
  const lineIndex = Math.floor(y / lineHeight)
  const colIndex = Math.floor(x / charWidth) - 1

  if (lineIndex >= 0 && lineIndex < lines.length) {
    const line = lines[lineIndex]
    const column = Math.max(0, Math.min(colIndex, line.length))
    let offset = 0
    for (let i = 0; i < lineIndex; i++) offset += lines[i].length + 1
    offset += column

    emit('cursor-position', {
      start: { line: lineIndex + 1, column, offset },
      end: { line: lineIndex + 1, column, offset },
    })
  }
}

const handleMouseLeave = () => emit('cursor-position', null)
</script>

<template>
  <div
    class="editor-container"
    :class="{ 'drag-over': isDragging || isDragOver }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <div class="editor-header">
      <span class="file-icon">{{ fileExtBadge }}</span>
      <span class="file-name">{{ displayFileName }}</span>
      <div class="symbol-buttons">
        <button class="symbol-btn" title="Вставить ∞ (акорень)" @click="insertSymbol('∞')">∞</button>
        <button class="symbol-btn" title="Вставить ♂ (конец формы, postfix)" @click="insertSymbol('♂')">♂</button>
        <button class="symbol-btn" title="Вставить ♀ (начало формы, prefix)" @click="insertSymbol('♀')">♀</button>
        <button class="symbol-btn" title="Вставить ⟼ (связь)" @click="insertSymbol('⟼')">⟼</button>
        <button class="symbol-btn" title="Вставить ¬ (инверсия)" @click="insertSymbol('¬')">¬</button>
        <button class="symbol-btn" title="Вставить != (неравенство)" @click="insertSymbol('!=')">!=</button>
      </div>
    </div>
    <div class="editor-content" @mousemove="handleMouseMove" @mouseleave="handleMouseLeave">
      <div class="highlight-layer" v-html="highlightedContent"></div>
      <textarea
        ref="textareaRef"
        v-model="localValue"
        class="code-input"
        spellcheck="false"
        placeholder="// Введите формулы МТС...&#10;// Например:&#10;∞ : {◁ = ∞, ▷ = ∞}&#10;&#10;// Или перетащите файл .mtl сюда"
        @scroll="handleScroll"
      ></textarea>
      <div v-if="isDragging || isDragOver" class="drop-overlay">
        <div class="drop-message">
          <span class="drop-icon">📁</span>
          <span>Отпустите файл для загрузки</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
  justify-content: space-between;
}

.file-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: bold;
}

.file-name {
  color: #94a3b8;
}

.editor-content {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 1rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--text-color);
  pointer-events: none;
  overflow: auto;
  text-align: left;
}

.code-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 1rem;
  background: transparent;
  border: none;
  color: transparent;
  caret-color: var(--text-color);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  resize: none;
  outline: none;
  text-align: left;
}

.code-input::placeholder {
  color: #4a5568;
}

:deep(.comment) {
  color: #6b7280;
  font-style: italic;
}

:deep(.operator) {
  color: #f472b6;
  font-weight: 500;
}

:deep(.symbol) {
  font-weight: bold;
}

:deep(.symbol.infinity) {
  color: #fbbf24;
}

:deep(.symbol.male) {
  color: #60a5fa;
}

:deep(.symbol.female) {
  color: #f472b6;
}

:deep(.symbol.context) {
  color: #67e8f9;
}

:deep(.negation) {
  color: #ef4444;
  font-weight: bold;
}

:deep(.define) {
  color: #60a5fa;
  font-weight: bold;
}

:deep(.equality) {
  color: #34d399;
  font-weight: 500;
}

:deep(.bracket) {
  color: #94a3b8;
}

:deep(.bracket.paren) {
  color: #fbbf24;
}

:deep(.bracket.brace) {
  color: #f472b6;
}

:deep(.bracket.square) {
  color: #60a5fa;
}

:deep(.number) {
  color: #a78bfa;
  font-weight: bold;
}

:deep(.identifier) {
  color: #e2e8f0;
}

:deep(.dot) {
  color: #94a3b8;
}

:deep(.ast-highlight) {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(102, 126, 234, 0.5);
}

:deep(.error-highlight) {
  background: rgba(248, 113, 113, 0.4);
  border-radius: 2px;
  box-shadow: 0 0 0 2px var(--error-color);
  padding: 0 2px;
  animation: pulse-error 1.5s ease-in-out infinite;
}

@keyframes pulse-error {
  0%,
  100% {
    box-shadow: 0 0 0 2px var(--error-color);
  }
  50% {
    box-shadow:
      0 0 0 2px var(--error-color),
      0 0 8px 2px var(--error-color);
  }
}

.editor-container.drag-over {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

.drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(102, 126, 234, 0.15);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 4px;
}

.drop-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-color);
  font-size: 1rem;
}

.drop-icon {
  font-size: 2rem;
}

.symbol-buttons {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}

.symbol-btn {
  background: rgba(102, 126, 234, 0.2);
  color: var(--text-color);
  border: 1px solid rgba(102, 126, 234, 0.4);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: inherit;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.symbol-btn:hover {
  background: rgba(102, 126, 234, 0.35);
  border-color: rgba(102, 126, 234, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.symbol-btn:active {
  transform: translateY(0);
}

.symbol-btn:nth-child(1) {
  color: #fbbf24;
  font-weight: bold;
}

.symbol-btn:nth-child(2) {
  color: #60a5fa;
  font-weight: bold;
}

.symbol-btn:nth-child(3) {
  color: #f472b6;
  font-weight: bold;
}
</style>
