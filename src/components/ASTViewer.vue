<script setup lang="ts">
import { defineProps, defineEmits, ref, computed, watch } from 'vue'
import type { ASTNode, File, SourceLocation } from '../core/ast'

const props = defineProps<{
  ast: File | null
  error: string | null
}>()

const emit = defineEmits<{
  'node-hover': [loc: SourceLocation | null]
}>()

interface TreeNode {
  id: string
  label: string
  type: string
  children: TreeNode[]
  expanded: boolean
  loc?: SourceLocation
}

const expandedNodes = ref<Set<string>>(new Set())

// Track if we've initialized expansion for current AST
const lastAstRef = ref<File | null>(null)

function toggleNode(id: string) {
  if (expandedNodes.value.has(id)) {
    expandedNodes.value.delete(id)
  } else {
    expandedNodes.value.add(id)
  }
  expandedNodes.value = new Set(expandedNodes.value)
}

function isExpanded(id: string): boolean {
  return expandedNodes.value.has(id)
}

// Expand all nodes
function expandAll() {
  if (!treeData.value) return
  const collectIds = (node: TreeNode): string[] => {
    const ids = [node.id]
    for (const child of node.children) {
      ids.push(...collectIds(child))
    }
    return ids
  }
  expandedNodes.value = new Set(collectIds(treeData.value))
}

// Collapse all nodes (except root)
function collapseAll() {
  expandedNodes.value = new Set(['0'])
}

// Collect all node IDs up to a certain depth
function collectInitialExpansion(node: ASTNode, path: string = '0', depth: number = 0): string[] {
  const result: string[] = []
  if (depth <= 3) {
    result.push(path)
  }

  switch (node.type) {
    case 'File':
      ;(node as { statements: ASTNode[] }).statements.forEach((stmt, i) => {
        result.push(...collectInitialExpansion(stmt, `${path}-${i}`, depth + 1))
      })
      break
    case 'Statement':
      result.push(
        ...collectInitialExpansion((node as { expr: ASTNode }).expr, `${path}-0`, depth + 1)
      )
      break
    case 'Link':
    case 'NotLink':
      result.push(
        ...collectInitialExpansion((node as { left: ASTNode }).left, `${path}-0`, depth + 1)
      )
      result.push(
        ...collectInitialExpansion((node as { right: ASTNode }).right, `${path}-1`, depth + 1)
      )
      break
    case 'Definition':
      result.push(
        ...collectInitialExpansion((node as { name: ASTNode }).name, `${path}-0`, depth + 1)
      )
      result.push(
        ...collectInitialExpansion((node as { form: ASTNode }).form, `${path}-1`, depth + 1)
      )
      break
    case 'Equality':
    case 'Inequality':
      result.push(
        ...collectInitialExpansion((node as { left: ASTNode }).left, `${path}-0`, depth + 1)
      )
      result.push(
        ...collectInitialExpansion((node as { right: ASTNode }).right, `${path}-1`, depth + 1)
      )
      break
    case 'Male':
    case 'Female':
    case 'Not':
      result.push(
        ...collectInitialExpansion((node as { operand: ASTNode }).operand, `${path}-0`, depth + 1)
      )
      break
    case 'Power':
      result.push(
        ...collectInitialExpansion((node as { base: ASTNode }).base, `${path}-0`, depth + 1)
      )
      break
    case 'Set':
      ;(node as { elements: ASTNode[] }).elements.forEach((el, i) => {
        result.push(...collectInitialExpansion(el, `${path}-${i}`, depth + 1))
      })
      break
  }

  return result
}

function astNodeToTreeNode(node: ASTNode, path: string = '0'): TreeNode {
  const result: TreeNode = {
    id: path,
    label: getNodeLabel(node),
    type: node.type,
    children: [],
    expanded: true,
    loc: node.loc,
  }

  switch (node.type) {
    case 'File':
      result.children = (node as { statements: ASTNode[] }).statements.map((stmt, i) =>
        astNodeToTreeNode(stmt, `${path}-${i}`)
      )
      break
    case 'Statement':
      result.children = [astNodeToTreeNode((node as { expr: ASTNode }).expr, `${path}-0`)]
      break
    case 'Link':
    case 'NotLink':
      result.children = [
        astNodeToTreeNode((node as { left: ASTNode }).left, `${path}-0`),
        astNodeToTreeNode((node as { right: ASTNode }).right, `${path}-1`),
      ]
      break
    case 'Definition':
      result.children = [
        astNodeToTreeNode((node as { name: ASTNode }).name, `${path}-0`),
        astNodeToTreeNode((node as { form: ASTNode }).form, `${path}-1`),
      ]
      break
    case 'Equality':
    case 'Inequality':
      result.children = [
        astNodeToTreeNode((node as { left: ASTNode }).left, `${path}-0`),
        astNodeToTreeNode((node as { right: ASTNode }).right, `${path}-1`),
      ]
      break
    case 'Male':
    case 'Female':
    case 'Not':
      result.children = [astNodeToTreeNode((node as { operand: ASTNode }).operand, `${path}-0`)]
      break
    case 'Power':
      result.children = [astNodeToTreeNode((node as { base: ASTNode }).base, `${path}-0`)]
      break
    case 'Set':
      result.children = (node as { elements: ASTNode[] }).elements.map((el, i) =>
        astNodeToTreeNode(el, `${path}-${i}`)
      )
      break
  }

  return result
}

function getNodeLabel(node: ASTNode): string {
  switch (node.type) {
    case 'File':
      return 'File'
    case 'Statement':
      return 'Statement'
    case 'Link':
      return '->'
    case 'NotLink':
      return '!->'
    case 'Definition':
      return ':'
    case 'Equality':
      return '='
    case 'Inequality':
      return '!='
    case 'Male':
      return '♂'
    case 'Female':
      return '♀'
    case 'Not':
      return '!'
    case 'Power':
      return `^${(node as { exponent: number }).exponent}`
    case 'Set':
      return '{...}'
    case 'Infinity':
      return '∞'
    case 'Num':
      return String((node as { value: number }).value)
    case 'Identifier':
      return (node as { name: string }).name
    case 'CharLit':
      return `'${(node as { char: string }).char}'`
    case 'Bracket':
      return (node as { side: string }).side === 'left' ? '[' : ']'
    default:
      return node.type
  }
}

function getNodeTypeClass(type: string): string {
  switch (type) {
    case 'File':
    case 'Statement':
      return 'node-structural'
    case 'Link':
    case 'NotLink':
      return 'node-link'
    case 'Definition':
      return 'node-define'
    case 'Equality':
    case 'Inequality':
      return 'node-equality'
    case 'Male':
    case 'Female':
    case 'Infinity':
      return 'node-symbol'
    case 'Not':
      return 'node-not'
    case 'Num':
      return 'node-number'
    case 'Identifier':
      return 'node-identifier'
    default:
      return ''
  }
}

// Format location for tooltip
function formatLocation(loc?: SourceLocation): string {
  if (!loc) return ''
  if (loc.start.line === loc.end.line) {
    return `Line ${loc.start.line}, col ${loc.start.column}-${loc.end.column}`
  }
  return `Lines ${loc.start.line}-${loc.end.line}`
}

// Handle mouse enter on node
function handleNodeEnter(loc?: SourceLocation) {
  emit('node-hover', loc || null)
}

// Handle mouse leave from node
function handleNodeLeave() {
  emit('node-hover', null)
}

const treeData = computed<TreeNode | null>(() => {
  if (!props.ast) return null
  return astNodeToTreeNode(props.ast)
})

// Initialize expansion when AST changes
watch(
  () => props.ast,
  newAst => {
    if (newAst && newAst !== lastAstRef.value) {
      lastAstRef.value = newAst
      const initialIds = collectInitialExpansion(newAst)
      expandedNodes.value = new Set(initialIds)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="ast-viewer">
    <div class="ast-header">
      <span class="ast-icon">AST</span>
      <span class="ast-title">Abstract Syntax Tree</span>
      <div class="ast-controls">
        <button class="ast-btn" title="Expand all nodes" @click="expandAll">
          <span class="btn-icon">⊞</span>
          <span class="btn-text">Expand All</span>
        </button>
        <button class="ast-btn" title="Collapse all nodes" @click="collapseAll">
          <span class="btn-icon">⊟</span>
          <span class="btn-text">Collapse All</span>
        </button>
      </div>
    </div>

    <div v-if="error" class="ast-error">
      <span class="error-icon">!</span>
      <span>Parse error</span>
    </div>

    <div v-else-if="treeData" class="ast-content">
      <div class="tree-root">
        <TreeNodeComponent
          :node="treeData"
          :is-expanded="isExpanded"
          :toggle-node="toggleNode"
          :get-node-type-class="getNodeTypeClass"
          :format-location="formatLocation"
          :on-node-enter="handleNodeEnter"
          :on-node-leave="handleNodeLeave"
        />
      </div>
    </div>

    <div v-else class="ast-empty">
      <span>No AST to display</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'

const TreeNodeComponent = defineComponent({
  name: 'TreeNodeComponent',
  props: {
    node: { type: Object, required: true },
    isExpanded: { type: Function, required: true },
    toggleNode: { type: Function, required: true },
    getNodeTypeClass: { type: Function, required: true },
    formatLocation: { type: Function, required: true },
    onNodeEnter: { type: Function, required: true },
    onNodeLeave: { type: Function, required: true },
  },
  render() {
    const node = this.node as TreeNode
    const hasChildren = node.children.length > 0
    const expanded = this.isExpanded(node.id)
    const locTooltip = this.formatLocation(node.loc)

    return h('div', { class: 'tree-node' }, [
      h(
        'div',
        {
          class: ['tree-node-content', this.getNodeTypeClass(node.type)],
          onClick: () => hasChildren && this.toggleNode(node.id),
          onMouseenter: () => this.onNodeEnter(node.loc),
          onMouseleave: () => this.onNodeLeave(),
          title: locTooltip,
        },
        [
          hasChildren
            ? h(
                'span',
                { class: ['tree-toggle', expanded ? 'expanded' : ''] },
                expanded ? '▼' : '▶'
              )
            : h('span', { class: 'tree-toggle tree-leaf' }, '•'),
          h('span', { class: 'tree-label' }, node.label),
          h('span', { class: 'tree-type' }, node.type),
          locTooltip
            ? h(
                'span',
                { class: 'tree-loc' },
                `[${node.loc?.start.line}:${node.loc?.start.column}]`
              )
            : null,
        ]
      ),
      hasChildren && expanded
        ? h(
            'div',
            { class: 'tree-children' },
            node.children.map((child: TreeNode) =>
              h(TreeNodeComponent, {
                node: child,
                isExpanded: this.isExpanded,
                toggleNode: this.toggleNode,
                getNodeTypeClass: this.getNodeTypeClass,
                formatLocation: this.formatLocation,
                onNodeEnter: this.onNodeEnter,
                onNodeLeave: this.onNodeLeave,
              })
            )
          )
        : null,
    ])
  },
})

export default {
  components: { TreeNodeComponent },
}
</script>

<style scoped>
.ast-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.ast-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
}

.ast-icon {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: bold;
}

.ast-title {
  color: #94a3b8;
}

.ast-controls {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.ast-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  color: #94a3b8;
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.ast-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-color);
  border-color: #4a5568;
}

.btn-icon {
  font-size: 0.85rem;
}

.btn-text {
  display: none;
}

@media (min-width: 1400px) {
  .btn-text {
    display: inline;
  }
}

.ast-content {
  flex: 1;
  overflow: auto;
  padding: 1rem;
}

.ast-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--error-color);
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

.ast-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #64748b;
}

.tree-root {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
}

.tree-node {
  margin-left: 0.5rem;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.tree-node-content:hover {
  background: rgba(102, 126, 234, 0.2);
}

.tree-toggle {
  width: 1rem;
  color: #64748b;
  font-size: 0.7rem;
}

.tree-toggle.expanded {
  color: #94a3b8;
}

.tree-leaf {
  color: #4a5568;
}

.tree-label {
  color: var(--text-color);
}

.tree-type {
  color: #64748b;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.tree-loc {
  color: #4a5568;
  font-size: 0.65rem;
  margin-left: auto;
  font-style: italic;
}

.tree-children {
  border-left: 1px solid var(--border-color);
  margin-left: 0.5rem;
  padding-left: 0.5rem;
}

/* Node type colors */
.node-structural .tree-label {
  color: #94a3b8;
}

.node-link .tree-label {
  color: #f472b6;
}

.node-define .tree-label {
  color: #60a5fa;
}

.node-equality .tree-label {
  color: #34d399;
}

.node-symbol .tree-label {
  color: #fbbf24;
}

.node-not .tree-label {
  color: #f87171;
}

.node-number .tree-label {
  color: #a78bfa;
}

.node-identifier .tree-label {
  color: #67e8f9;
}
</style>
