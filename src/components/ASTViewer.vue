<script setup lang="ts">
import { defineProps, ref, computed } from 'vue'
import type { ASTNode, File } from '../core/ast'

const props = defineProps<{
  ast: File | null
  error: string | null
}>()

interface TreeNode {
  id: string
  label: string
  type: string
  children: TreeNode[]
  expanded: boolean
}

const expandedNodes = ref<Set<string>>(new Set())

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

function astNodeToTreeNode(node: ASTNode, path: string = '0'): TreeNode {
  const result: TreeNode = {
    id: path,
    label: getNodeLabel(node),
    type: node.type,
    children: [],
    expanded: true,
  }

  // Auto-expand first few levels
  if (path.split('-').length <= 3) {
    expandedNodes.value.add(path)
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

const treeData = computed<TreeNode | null>(() => {
  if (!props.ast) return null
  return astNodeToTreeNode(props.ast)
})
</script>

<template>
  <div class="ast-viewer">
    <div class="ast-header">
      <span class="ast-icon">AST</span>
      <span class="ast-title">Abstract Syntax Tree</span>
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
  },
  render() {
    const node = this.node as TreeNode
    const hasChildren = node.children.length > 0
    const expanded = this.isExpanded(node.id)

    return h('div', { class: 'tree-node' }, [
      h(
        'div',
        {
          class: ['tree-node-content', this.getNodeTypeClass(node.type)],
          onClick: () => hasChildren && this.toggleNode(node.id),
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
  background: rgba(255, 255, 255, 0.05);
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
