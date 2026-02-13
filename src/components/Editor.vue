<script setup lang="ts">
import { defineEmits, defineProps, ref, watch, computed } from 'vue'
import type { SourceLocation } from '../core/ast'

const props = defineProps<{
  modelValue: string
  highlightedLoc?: SourceLocation | null
  fileName?: string
  isDragOver?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'file-drop': [file: File]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const localValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

// Simple syntax highlighting via CSS classes on overlay
// For now, we just use the textarea with proper styling
// Future: implement CodeMirror or Monaco integration

// Token-based syntax highlighting to avoid HTML attribute conflicts
interface Token {
  type: string
  value: string
}

// Tokenize a line of code (not including comments)
function tokenizeLine(code: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < code.length) {
    // Multi-character operators (check first)
    if (code.slice(pos, pos + 3) === '!->') {
      tokens.push({ type: 'operator', value: '!->' })
      pos += 3
      continue
    }
    if (code.slice(pos, pos + 2) === '->') {
      tokens.push({ type: 'operator', value: '->' })
      pos += 2
      continue
    }
    if (code.slice(pos, pos + 2) === '!=') {
      tokens.push({ type: 'equality', value: '!=' })
      pos += 2
      continue
    }
    if (code.slice(pos, pos + 2) === '¬=') {
      tokens.push({ type: 'equality', value: '¬=' })
      pos += 2
      continue
    }

    const char = code[pos]

    // Special symbols
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
    if (char === '≠') {
      tokens.push({ type: 'equality', value: char })
      pos++
      continue
    }

    // Standalone negation
    if ((char === '!' || char === '¬') && code[pos + 1] !== '-' && code[pos + 1] !== '=') {
      tokens.push({ type: 'negation', value: char })
      pos++
      continue
    }

    // Power operator
    if (char === '^') {
      tokens.push({ type: 'power', value: char })
      pos++
      continue
    }

    // Definition colon (surrounded by whitespace)
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

    // Equality sign (standalone)
    if (char === '=') {
      tokens.push({ type: 'equality', value: char })
      pos++
      continue
    }

    // Brackets
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

    // Dot (statement terminator)
    if (char === '.' && (pos === code.length - 1 || /\s/.test(code[pos + 1]))) {
      tokens.push({ type: 'dot', value: char })
      pos++
      continue
    }

    // Numbers (0 and 1 as special constants)
    if (
      (char === '0' || char === '1') &&
      (pos === 0 || !/[a-zA-Zа-яА-ЯёЁ0-9_]/.test(code[pos - 1])) &&
      (pos === code.length - 1 || !/[a-zA-Zа-яА-ЯёЁ0-9_]/.test(code[pos + 1]))
    ) {
      tokens.push({ type: 'number', value: char })
      pos++
      continue
    }

    // Identifiers
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

    // Plain text (whitespace, etc.)
    tokens.push({ type: 'text', value: char })
    pos++
  }

  return tokens
}

// Escape HTML special characters
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Convert tokens to highlighted HTML
function tokensToHtml(tokens: Token[]): string {
  return tokens
    .map(token => {
      const escaped = escapeHtml(token.value)
      if (token.type === 'text') {
        return escaped
      }
      return `<span class="${token.type}">${escaped}</span>`
    })
    .join('')
}

// Create a highlight marker for AST node selection
function applyHighlightMarker(
  html: string,
  lineIndex: number,
  loc: SourceLocation | null | undefined
): string {
  if (!loc) return html

  const startLine = loc.start.line - 1 // 0-indexed
  const endLine = loc.end.line - 1

  if (lineIndex < startLine || lineIndex > endLine) {
    return html
  }

  // For simplicity, highlight the entire line content if it's within the range
  // A more precise implementation would track character positions
  if (lineIndex === startLine && lineIndex === endLine) {
    // Single line highlight - highlight from start column to end column
    return `<span class="ast-highlight">${html}</span>`
  } else if (lineIndex === startLine) {
    // First line of multi-line - highlight from start column to end
    return `<span class="ast-highlight">${html}</span>`
  } else if (lineIndex === endLine) {
    // Last line of multi-line - highlight from start to end column
    return `<span class="ast-highlight">${html}</span>`
  } else {
    // Middle lines - highlight entire line
    return `<span class="ast-highlight">${html}</span>`
  }
}

const highlightedContent = computed(() => {
  const text = props.modelValue
  const loc = props.highlightedLoc

  // Process line by line to handle comments correctly
  const lines = text.split('\n')
  const processedLines = lines.map((line, lineIndex) => {
    let result: string
    // Check for comment
    const commentIndex = line.indexOf('//')
    if (commentIndex !== -1) {
      const beforeComment = line.substring(0, commentIndex)
      const comment = line.substring(commentIndex)
      const tokens = tokenizeLine(beforeComment)
      result = tokensToHtml(tokens) + `<span class="comment">${escapeHtml(comment)}</span>`
    } else {
      const tokens = tokenizeLine(line)
      result = tokensToHtml(tokens)
    }

    // Apply AST node highlight if applicable
    return applyHighlightMarker(result, lineIndex, loc)
  })

  return processedLines.join('\n')
})

// Sync scroll between textarea and highlight layer
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
    // Trigger re-render of highlighted content
  }
)

// Drag and drop handling
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
  if (files && files.length > 0) {
    const file = files[0]
    emit('file-drop', file)
  }
}

// Computed display file name
const displayFileName = computed(() => {
  return props.fileName || 'input.mtl'
})

// File extension badge
const fileExtBadge = computed(() => {
  const name = displayFileName.value
  const ext = name.split('.').pop()?.toUpperCase()
  return ext || 'MTL'
})
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
    </div>
    <div class="editor-content">
      <div class="highlight-layer" v-html="highlightedContent"></div>
      <textarea
        ref="textareaRef"
        v-model="localValue"
        class="code-input"
        spellcheck="false"
        placeholder="// Введите формулы МТС...&#10;// Например:&#10;∞ = ∞ -> ∞.&#10;&#10;// Или перетащите файл .mtl сюда"
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
}

.code-input::placeholder {
  color: #4a5568;
}

/* Syntax highlighting classes */
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

:deep(.negation) {
  color: #ef4444;
  font-weight: bold;
}

:deep(.power) {
  color: #8b5cf6;
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

/* Drag and drop overlay */
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
</style>
