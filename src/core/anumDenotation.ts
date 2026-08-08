/**
 * Storage-neutral Anum L3 denotation consumer.
 *
 * Normative behavior is defined by the vendored anum_docs v0.2 contracts and
 * conformance corpora. This module intentionally has no MemoryView dependency
 * and performs no realization/materialization.
 */

import { cleanQuatAnum, validateQuatAnum } from './quatAnum'

export type AnumDenotationContext = 'root' | 'quote' | 'relative'
export type ProtocolAnchor = 'protocol:0' | 'protocol:1'

export type DenotationRef = { anchor: ProtocolAnchor } | { node: number }

export interface DenotationNode {
  id: number
  start: DenotationRef
  end: DenotationRef
}

export interface StructuralAnumDenotation {
  kind: 'structural'
  anchors: ProtocolAnchor[]
  nodes: DenotationNode[]
  root: DenotationRef
}

export interface RawAnumDenotation {
  kind: 'raw'
  raw: string
}

export interface QuotedRawAnumDenotation {
  kind: 'quoted-raw'
  raw: string
}

export type AnumDenotation =
  | StructuralAnumDenotation
  | RawAnumDenotation
  | QuotedRawAnumDenotation

interface AtomTree {
  kind: 'atom'
  atom: '0' | '1'
}

interface LinkTree {
  kind: 'link'
  start: RecursiveAnumTree
  end: RecursiveAnumTree
}

type RecursiveAnumTree = AtomTree | LinkTree

class RecursiveDecodeError extends Error {}

function normalizeRaw(raw: string): string {
  const validation = validateQuatAnum(raw)
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid Anum raw carrier')
  }
  return cleanQuatAnum(raw)
}

function anchorForAtom(atom: '0' | '1'): ProtocolAnchor {
  return atom === '0' ? 'protocol:0' : 'protocol:1'
}

function atomForAnchor(anchor: ProtocolAnchor): '0' | '1' {
  return anchor === 'protocol:0' ? '0' : '1'
}

function anchorDenotation(anchor: ProtocolAnchor): StructuralAnumDenotation {
  return {
    kind: 'structural',
    anchors: [anchor],
    nodes: [],
    root: { anchor },
  }
}

function pairDenotation(start: ProtocolAnchor, end: ProtocolAnchor): StructuralAnumDenotation {
  return {
    kind: 'structural',
    anchors: [...new Set<ProtocolAnchor>([start, end])].sort(),
    nodes: [{ id: 0, start: { anchor: start }, end: { anchor: end } }],
    root: { node: 0 },
  }
}

function denotatePairSubset(raw: string, context: AnumDenotationContext): AnumDenotation {
  if (context === 'quote') {
    const quoted = raw.length >= 2 && raw.startsWith('[') && raw.endsWith(']')
      ? raw.slice(1, -1)
      : raw
    return { kind: 'quoted-raw', raw: quoted }
  }

  if (context === 'relative') return { kind: 'raw', raw }

  if (raw === '0' || raw === '][') return anchorDenotation('protocol:0')
  if (raw === '1' || raw === '[]') return anchorDenotation('protocol:1')

  if (raw.length === 2 && /^[01]{2}$/.test(raw)) {
    const start = anchorForAtom(raw[0] as '0' | '1')
    const end = anchorForAtom(raw[1] as '0' | '1')
    return pairDenotation(start, end)
  }

  return { kind: 'raw', raw }
}

/** Execute the accepted pair + recursive v0.2 denotation observable behavior. */
export function denotateAnum(
  source: string,
  context: AnumDenotationContext = 'root'
): AnumDenotation {
  const raw = normalizeRaw(source)
  const base = denotatePairSubset(raw, context)

  if (context !== 'root' || base.kind === 'structural') return base
  if (raw === '[[' || raw === ']]') return base

  try {
    return treeToDenotation(decodeRecursiveTree(raw))
  } catch (error) {
    if (error instanceof RecursiveDecodeError) return base
    throw error
  }
}

/** Canonical inverse for structural occurrence trees in the accepted v0.2 subset. */
export function canonicalAnum(value: AnumDenotation): string {
  if (value.kind !== 'structural') {
    throw new Error('Only structural Anum denotations have a canonical inverse')
  }
  return canonicalTreeRaw(treeFromStructural(value))
}

function atomTree(atom: '0' | '1'): AtomTree {
  return { kind: 'atom', atom }
}

function linkTree(start: RecursiveAnumTree, end: RecursiveAnumTree): LinkTree {
  return { kind: 'link', start, end }
}

function decodeRecursiveTree(raw: string): RecursiveAnumTree {
  if (raw === '[]' || raw === '][' || raw === '[[' || raw === ']]') {
    throw new RecursiveDecodeError('special boundary form is outside recursive grammar')
  }
  if (raw === '0' || raw === '1') return atomTree(raw)
  if (!raw) throw new RecursiveDecodeError('empty raw carrier has no recursive denotation')

  const expanded = restoreCollapsedRootOpens(raw)
  const parsed = parseRoot(expanded)
  if (parsed.position !== expanded.length) {
    throw new RecursiveDecodeError('recursive Anum carrier has trailing values or brackets')
  }
  if (canonicalTreeRaw(parsed.tree) !== raw) {
    throw new RecursiveDecodeError('recursive Anum carrier is not canonical')
  }
  return parsed.tree
}

function restoreCollapsedRootOpens(raw: string): string {
  if (!raw.startsWith('[')) return raw

  let balance = 0
  for (const char of raw) {
    if (char === '[') balance++
    else if (char === ']') balance--
  }
  return balance < 0 ? '['.repeat(-balance) + raw : raw
}

function collapseRootOpens(expanded: string): string {
  let count = 0
  while (count < expanded.length && expanded[count] === '[') count++
  return count <= 1 ? expanded : '[' + expanded.slice(count)
}

function parseRoot(raw: string): { tree: RecursiveAnumTree; position: number } {
  if (raw === '0' || raw === '1') return { tree: atomTree(raw), position: 1 }

  const start = parseValue(raw, 0)
  const end = parseValue(raw, start.position)
  return { tree: linkTree(start.tree, end.tree), position: end.position }
}

function parseValue(raw: string, position: number): { tree: RecursiveAnumTree; position: number } {
  if (position >= raw.length) throw new RecursiveDecodeError('recursive Anum value is missing')

  const current = raw[position]
  if (current === '0' || current === '1') {
    return { tree: atomTree(current), position: position + 1 }
  }
  if (current !== '[') {
    throw new RecursiveDecodeError("recursive Anum value must start with atom or '['")
  }

  const start = parseValue(raw, position + 1)
  const end = parseValue(raw, start.position)
  if (end.position >= raw.length || raw[end.position] !== ']') {
    throw new RecursiveDecodeError('recursive bracket value must close after exactly one pair')
  }
  return { tree: linkTree(start.tree, end.tree), position: end.position + 1 }
}

function encodePairExpanded(tree: LinkTree): string {
  return encodeValueExpanded(tree.start) + encodeValueExpanded(tree.end)
}

function encodeValueExpanded(tree: RecursiveAnumTree): string {
  if (tree.kind === 'atom') return tree.atom
  return '[' + encodePairExpanded(tree) + ']'
}

function canonicalTreeRaw(tree: RecursiveAnumTree): string {
  if (tree.kind === 'atom') return tree.atom
  return collapseRootOpens(encodePairExpanded(tree))
}

function treeToDenotation(tree: RecursiveAnumTree): StructuralAnumDenotation {
  const nodes: DenotationNode[] = []
  const anchors = new Set<ProtocolAnchor>()

  const emit = (item: RecursiveAnumTree): DenotationRef => {
    if (item.kind === 'atom') {
      const anchor = anchorForAtom(item.atom)
      anchors.add(anchor)
      return { anchor }
    }

    const start = emit(item.start)
    const end = emit(item.end)
    const id = nodes.length
    nodes.push({ id, start, end })
    return { node: id }
  }

  return {
    kind: 'structural',
    anchors: [...anchors].sort(),
    nodes,
    root: emit(tree),
  }
}

function treeFromStructural(value: StructuralAnumDenotation): RecursiveAnumTree {
  const visited = new Set<number>()
  const usedAnchors = new Set<ProtocolAnchor>()

  value.nodes.forEach((node, index) => {
    if (node.id !== index) throw new Error('Structural denotation node ids must be dense postorder indices')
  })

  const visit = (ref: DenotationRef): RecursiveAnumTree => {
    if ('anchor' in ref) {
      if (ref.anchor !== 'protocol:0' && ref.anchor !== 'protocol:1') {
        throw new Error('Recursive denotation endpoint must be protocol:0 or protocol:1')
      }
      usedAnchors.add(ref.anchor)
      return atomTree(atomForAnchor(ref.anchor))
    }

    if (!Number.isInteger(ref.node) || ref.node < 0 || ref.node >= value.nodes.length) {
      throw new Error('Recursive denotation node reference is out of range')
    }
    if (visited.has(ref.node)) {
      throw new Error('Explicit shared node references are outside occurrence-tree subset')
    }

    visited.add(ref.node)
    const node = value.nodes[ref.node]
    return linkTree(visit(node.start), visit(node.end))
  }

  const tree = visit(value.root)
  if (visited.size !== value.nodes.length) {
    throw new Error('Recursive denotation contains unused structural nodes')
  }

  const declared = new Set<ProtocolAnchor>(value.anchors)
  if (
    declared.size !== usedAnchors.size ||
    [...declared].some(anchor => !usedAnchors.has(anchor))
  ) {
    throw new Error('Recursive denotation contains unused or missing anchors')
  }

  return tree
}
