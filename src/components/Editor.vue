<script setup lang="ts">
import { defineEmits, defineProps, ref, watch, computed } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const localValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

// Simple syntax highlighting via CSS classes on overlay
// For now, we just use the textarea with proper styling
// Future: implement CodeMirror or Monaco integration

const highlightedContent = computed(() => {
  const text = props.modelValue
  return (
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Highlight comments
      .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>')
      // Highlight operators
      .replace(/(->|!->)/g, '<span class="operator">$1</span>')
      // Highlight special symbols
      .replace(/([∞♂♀])/g, '<span class="symbol">$1</span>')
      // Highlight definition and equality
      .replace(/(\s)(:)(\s)/g, '$1<span class="define">$2</span>$3')
      .replace(/(!=|=)/g, '<span class="equality">$1</span>')
      // Highlight numbers
      .replace(/\b([01])\b/g, '<span class="number">$1</span>')
  )
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
</script>

<template>
  <div class="editor-container">
    <div class="editor-header">
      <span class="file-icon">MTL</span>
      <span class="file-name">input.mtl</span>
    </div>
    <div class="editor-content">
      <div class="highlight-layer" v-html="highlightedContent"></div>
      <textarea
        ref="textareaRef"
        v-model="localValue"
        class="code-input"
        spellcheck="false"
        placeholder="// Введите формулы МТС...&#10;// Например:&#10;∞ = ∞ -> ∞."
        @scroll="handleScroll"
      ></textarea>
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
}

:deep(.symbol) {
  color: #fbbf24;
}

:deep(.define) {
  color: #60a5fa;
}

:deep(.equality) {
  color: #34d399;
}

:deep(.number) {
  color: #a78bfa;
}
</style>
