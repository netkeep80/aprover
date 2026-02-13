<script setup lang="ts">
import { defineProps } from 'vue'

defineProps<{
  error: string | null
}>()
</script>

<template>
  <div v-if="error" class="error-panel">
    <div class="error-header">
      <span class="error-icon">!</span>
      <span class="error-title">Error</span>
    </div>
    <div class="error-content">
      <pre class="error-message">{{ error }}</pre>
    </div>
  </div>
</template>

<style scoped>
.error-panel {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid var(--error-color);
  border-radius: 4px;
  overflow: hidden;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(248, 113, 113, 0.15);
  border-bottom: 1px solid rgba(248, 113, 113, 0.3);
}

.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  background: var(--error-color);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: bold;
}

.error-title {
  color: var(--error-color);
  font-weight: 600;
}

.error-content {
  padding: 0.75rem 1rem;
}

.error-message {
  margin: 0;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  color: var(--error-color);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
