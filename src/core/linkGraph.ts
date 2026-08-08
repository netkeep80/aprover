/**
 * Проекция AST МТС в граф с сохранением отдельных вхождений.
 *
 * Видимые подписи служат только отображению. Одинаковые подписи остаются
 * разными вхождениями, пока каноническое исполнение явно не задаст общую
 * семантическую сущность.
 */

import type { ASTNode } from './ast'
import {
  isLinkExpr,
  isDefExpr,
  isEqExpr,
  isNeqExpr,
  isMaleExpr,
  isFemaleExpr,
  isNotExpr,
  isSetExpr,
  isSequenceExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isAbitLitExpr,
  isStringLitExpr,
} from './ast'
import { astToString } from './ast'
import { escapeLabel } from './utils'

export type LinkGraphNodeType =
  | 'link-center'
  | 'atom'
  | 'operator'
  | 'unary'
  | 'set'
  | 'sequence'

export interface LinkGraphNode {
  id: string
  label: string
  nodeType: LinkGraphNodeType
  astNode?: ASTNode
}

export type LinkGraphEdgeType =
  | 'link-start'
  | 'link-end'
  | 'self-start'
  | 'self-end'
  | 'relation'
  | 'member'

export interface LinkGraphEdge {
  id: string
  source: string
  target: string
  edgeType: LinkGraphEdgeType
  label?: string
}

export interface LinkGraph {
  nodes: LinkGraphNode[]
  edges: LinkGraphEdge[]
}

interface GraphBuilderState {
  nodes: Map<string, LinkGraphNode>
  edges: LinkGraphEdge[]
  nodeCounter: number
  edgeCounter: number
}

function nextNodeId(state: GraphBuilderState, prefix: string): string {
  state.nodeCounter += 1
  return `${prefix}_${state.nodeCounter}`
}

function nextEdgeId(state: GraphBuilderState): string {
  state.edgeCounter += 1
  return `edge_${state.edgeCounter}`
}

function createNode(
  state: GraphBuilderState,
  prefix: string,
  label: string,
  nodeType: LinkGraphNodeType,
  astNode: ASTNode
): string {
  const id = nextNodeId(state, prefix)
  state.nodes.set(id, { id, label, nodeType, astNode })
  return id
}

function addEdge(
  state: GraphBuilderState,
  source: string,
  target: string,
  edgeType: LinkGraphEdgeType,
  label?: string
): void {
  state.edges.push({
    id: nextEdgeId(state),
    source,
    target,
    edgeType,
    ...(label === undefined ? {} : { label }),
  })
}

function getNodeLabel(node: ASTNode): string {
  if (isIdentExpr(node)) return node.name
  if (isInfinityExpr(node)) return '∞'
  if (isNumExpr(node)) return String(node.value)
  if (isAbitLitExpr(node)) return `'${node.value}'`
  if (isStringLitExpr(node)) return `"${node.value}"`
  return astToString(node)
}

function projectNode(node: ASTNode, state: GraphBuilderState): string {
  if (isLinkExpr(node)) {
    const centerId = createNode(state, 'link', '', 'link-center', node)
    const leftId = projectNode(node.left, state)
    const rightId = projectNode(node.right, state)
    addEdge(state, leftId, centerId, 'link-start', '+')
    addEdge(state, centerId, rightId, 'link-end')
    return centerId
  }

  if (isMaleExpr(node)) {
    const centerId = createNode(state, 'male', astToString(node), 'unary', node)
    const operandId = projectNode(node.operand, state)
    addEdge(state, centerId, centerId, 'self-start', '+')
    addEdge(state, centerId, operandId, 'link-end')
    return centerId
  }

  if (isFemaleExpr(node)) {
    const centerId = createNode(state, 'female', astToString(node), 'unary', node)
    const operandId = projectNode(node.operand, state)
    addEdge(state, operandId, centerId, 'link-start', '+')
    addEdge(state, centerId, centerId, 'self-end')
    return centerId
  }

  if (isNotExpr(node)) {
    const centerId = createNode(state, 'not', `¬${getNodeLabel(node.operand)}`, 'unary', node)
    const operandId = projectNode(node.operand, state)
    addEdge(state, operandId, centerId, 'relation', '¬')
    return centerId
  }

  if (isDefExpr(node)) {
    const centerId = createNode(state, 'def', ':', 'operator', node)
    const nameId = projectNode(node.name, state)
    const formId = projectNode(node.form, state)
    addEdge(state, nameId, centerId, 'relation', 'имя')
    addEdge(state, centerId, formId, 'relation', 'форма')
    return centerId
  }

  if (isEqExpr(node)) {
    const centerId = createNode(state, 'eq', '=', 'operator', node)
    const leftId = projectNode(node.left, state)
    const rightId = projectNode(node.right, state)
    addEdge(state, leftId, centerId, 'relation')
    addEdge(state, centerId, rightId, 'relation')
    return centerId
  }

  if (isNeqExpr(node)) {
    const centerId = createNode(state, 'neq', '!=', 'operator', node)
    const leftId = projectNode(node.left, state)
    const rightId = projectNode(node.right, state)
    addEdge(state, leftId, centerId, 'relation')
    addEdge(state, centerId, rightId, 'relation')
    return centerId
  }

  if (isSetExpr(node)) {
    const centerId = createNode(state, 'set', '{…}', 'set', node)
    node.elements.forEach((element, index) => {
      const elementId = projectNode(element, state)
      addEdge(state, centerId, elementId, 'member', String(index))
    })
    return centerId
  }

  if (isSequenceExpr(node)) {
    const centerId = createNode(state, 'sequence', 'соположение', 'sequence', node)
    node.items.forEach((item, index) => {
      const itemId = projectNode(item, state)
      addEdge(state, centerId, itemId, 'member', String(index))
    })
    return centerId
  }

  return createNode(state, 'atom', getNodeLabel(node), 'atom', node)
}

function newState(): GraphBuilderState {
  return { nodes: new Map(), edges: [], nodeCounter: 0, edgeCounter: 0 }
}

export function projectToGraph(node: ASTNode): LinkGraph {
  const state = newState()
  projectNode(node, state)
  return { nodes: Array.from(state.nodes.values()), edges: state.edges }
}

export function projectStatementsToGraph(nodes: ASTNode[]): LinkGraph {
  const state = newState()
  for (const node of nodes) projectNode(node, state)
  return { nodes: Array.from(state.nodes.values()), edges: state.edges }
}

export function toCytoscapeElements(
  graph: LinkGraph
): Array<{ group: 'nodes' | 'edges'; data: Record<string, string | undefined> }> {
  const elements: Array<{
    group: 'nodes' | 'edges'
    data: Record<string, string | undefined>
  }> = []

  for (const node of graph.nodes) {
    elements.push({
      group: 'nodes',
      data: { id: node.id, label: node.label, nodeType: node.nodeType },
    })
  }
  for (const edge of graph.edges) {
    elements.push({
      group: 'edges',
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeType: edge.edgeType,
        label: edge.label,
      },
    })
  }
  return elements
}

export function linkGraphToDOT(graph: LinkGraph, title?: string): string {
  const lines: string[] = []
  const graphLabel = title ? `  label="${escapeLabel(title)}";` : ''

  lines.push('digraph LinkGraph {')
  lines.push('  rankdir=LR;')
  lines.push('  node [fontname="Arial"];')
  lines.push('  edge [fontname="Arial"];')
  if (graphLabel) lines.push(graphLabel)
  lines.push('')

  const nodeStyles: Record<LinkGraphNodeType, string> = {
    'link-center':
      'shape=circle, style=filled, fillcolor="#e3f2fd", width=0.3, fixedsize=true',
    atom: 'shape=box, style="filled,rounded", fillcolor="#c8e6c9"',
    operator: 'shape=diamond, style=filled, fillcolor="#fff3e0"',
    unary: 'shape=ellipse, style=filled, fillcolor="#f3e5f5"',
    set: 'shape=box, style=filled, fillcolor="#e8eaf6"',
    sequence: 'shape=box, style="filled,rounded", fillcolor="#f5f5f5"',
  }

  for (const node of graph.nodes) {
    const style = nodeStyles[node.nodeType]
    const label = node.label ? `label="${escapeLabel(node.label)}"` : 'label=""'
    lines.push(`  ${node.id} [${label}, ${style}];`)
  }

  lines.push('')
  for (const edge of graph.edges) {
    const attrs: string[] = []
    switch (edge.edgeType) {
      case 'link-start':
        attrs.push('arrowhead=none', 'arrowtail=odot', 'dir=both', 'color="#1565c0"')
        break
      case 'link-end':
        attrs.push('arrowhead=vee', 'color="#1565c0"')
        break
      case 'self-start':
        attrs.push('arrowhead=none', 'arrowtail=odot', 'dir=both', 'color="#7b1fa2"')
        break
      case 'self-end':
        attrs.push('arrowhead=vee', 'color="#7b1fa2"')
        break
      case 'relation':
        attrs.push('arrowhead=vee', 'color="#666666"', 'style=dashed')
        break
      case 'member':
        attrs.push('arrowhead=dot', 'color="#4caf50"', 'style=dotted')
        break
    }
    if (edge.label) attrs.push(`label="${escapeLabel(edge.label)}"`)
    lines.push(`  ${edge.source} -> ${edge.target} [${attrs.join(', ')}];`)
  }

  lines.push('}')
  return lines.join('\n')
}
