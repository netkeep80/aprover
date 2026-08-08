/** Tests for occurrence-preserving Link Graph projection. */

import { describe, expect, it } from 'vitest'
import {
  linkGraphToDOT,
  projectStatementsToGraph,
  projectToGraph,
  toCytoscapeElements,
} from '../../src/core/linkGraph'
import { normalize } from '../../src/core/normalizer'
import { parseExpr } from '../../src/core/parser'

describe('LinkGraph', () => {
  it('projects a canonical link a ⟼ b', () => {
    const graph = projectToGraph(normalize(parseExpr('a ⟼ b')))
    expect(graph.nodes.filter(n => n.nodeType === 'link-center')).toHaveLength(1)
    expect(graph.nodes.filter(n => n.nodeType === 'atom').map(n => n.label).sort()).toEqual([
      'a',
      'b',
    ])
    expect(graph.edges.filter(e => e.edgeType === 'link-start')).toHaveLength(1)
    expect(graph.edges.filter(e => e.edgeType === 'link-end')).toHaveLength(1)
  })

  it('keeps chained links left-associated', () => {
    const graph = projectToGraph(normalize(parseExpr('a ⟼ b ⟼ c')))
    expect(graph.nodes.filter(n => n.nodeType === 'link-center')).toHaveLength(2)
    expect(graph.nodes.filter(n => n.nodeType === 'atom')).toHaveLength(3)
  })

  it('projects canonical start/end projections', () => {
    const male = projectToGraph(normalize(parseExpr('x♂')))
    const female = projectToGraph(normalize(parseExpr('♀x')))
    expect(male.nodes.find(n => n.nodeType === 'unary')?.label).toBe('x♂')
    expect(female.nodes.find(n => n.nodeType === 'unary')?.label).toBe('♀x')
    expect(male.edges.filter(e => e.edgeType === 'self-start')).toHaveLength(1)
    expect(female.edges.filter(e => e.edgeType === 'self-end')).toHaveLength(1)
  })

  it('projects canonical inversion glyph without prover-era rewrite', () => {
    const graph = projectToGraph(normalize(parseExpr('¬x')))
    const unary = graph.nodes.find(n => n.nodeType === 'unary')
    expect(unary?.label).toBe('¬x')
    expect(graph.edges.find(e => e.edgeType === 'relation')?.label).toBe('¬')
  })

  it('projects equality and definition as structural operators', () => {
    const equality = projectToGraph(normalize(parseExpr('a = b')))
    const definition = projectToGraph(normalize(parseExpr('s : s ⟼ s')))
    expect(equality.nodes.filter(n => n.nodeType === 'operator').map(n => n.label)).toEqual(['='])
    expect(definition.nodes.filter(n => n.nodeType === 'operator').map(n => n.label)).toEqual([':'])
  })

  it('projects bundles without imposing value/set algebra', () => {
    const graph = projectToGraph(normalize(parseExpr('{a, b, a}')))
    expect(graph.nodes.filter(n => n.nodeType === 'set')).toHaveLength(1)
    expect(graph.edges.filter(e => e.edgeType === 'member')).toHaveLength(3)
    expect(graph.nodes.filter(n => n.nodeType === 'atom').map(n => n.label)).toEqual(['a', 'b', 'a'])
  })

  it('does not use display labels as identity', () => {
    const graph = projectToGraph(normalize(parseExpr('a = a')))
    const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
    expect(atoms).toHaveLength(2)
    expect(atoms[0].id).not.toBe(atoms[1].id)
    expect(atoms[0].astNode).not.toBe(atoms[1].astNode)
  })

  it('gives all graph nodes and edges unique runtime IDs', () => {
    const graph = projectToGraph(normalize(parseExpr('(a ⟼ a) = (a ⟼ a)')))
    expect(new Set(graph.nodes.map(n => n.id)).size).toBe(graph.nodes.length)
    expect(new Set(graph.edges.map(e => e.id)).size).toBe(graph.edges.length)
  })

  it('projects multiple statements without interning repeated labels', () => {
    const graph = projectStatementsToGraph([
      normalize(parseExpr('a ⟼ b')),
      normalize(parseExpr('b ⟼ c')),
    ])
    const bOccurrences = graph.nodes.filter(n => n.nodeType === 'atom' && n.label === 'b')
    expect(bOccurrences).toHaveLength(2)
    expect(bOccurrences[0].id).not.toBe(bOccurrences[1].id)
  })

  it('handles empty statement lists and Cytoscape conversion', () => {
    const empty = projectStatementsToGraph([])
    expect(empty.nodes).toHaveLength(0)
    expect(empty.edges).toHaveLength(0)
    expect(toCytoscapeElements(empty)).toHaveLength(0)
  })

  it('preserves occurrence IDs in Cytoscape data', () => {
    const graph = projectToGraph(normalize(parseExpr('a = a')))
    const elements = toCytoscapeElements(graph)
    const nodeElements = elements.filter(e => e.group === 'nodes')
    expect(new Set(nodeElements.map(e => e.data.id)).size).toBe(graph.nodes.length)
  })

  it('generates DOT for canonical links', () => {
    const dot = linkGraphToDOT(projectToGraph(normalize(parseExpr('a ⟼ b'))), 'Test Graph')
    expect(dot).toContain('digraph LinkGraph')
    expect(dot).toContain('rankdir=LR')
    expect(dot).toContain('arrowtail=odot')
    expect(dot).toContain('arrowhead=vee')
    expect(dot).toContain('label="Test Graph"')
  })
})
