/**
 * Tests for occurrence-preserving Link Graph projection.
 */

import { describe, it, expect } from 'vitest'
import {
  projectToGraph,
  projectStatementsToGraph,
  toCytoscapeElements,
  linkGraphToDOT,
} from '../../src/core/linkGraph'
import { parseExpr } from '../../src/core/parser'
import { normalize } from '../../src/core/normalizer'

describe('LinkGraph', () => {
  describe('projectToGraph', () => {
    it('projects a simple link a -> b', () => {
      const graph = projectToGraph(normalize(parseExpr('a -> b')))

      expect(graph.nodes.length).toBe(3)
      expect(graph.edges.length).toBe(2)

      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
      const centers = graph.nodes.filter(n => n.nodeType === 'link-center')
      expect(atoms.map(a => a.label).sort()).toEqual(['a', 'b'])
      expect(centers.length).toBe(1)

      const start = graph.edges.find(e => e.edgeType === 'link-start')!
      const end = graph.edges.find(e => e.edgeType === 'link-end')!
      expect(start.source).toBe(atoms.find(a => a.label === 'a')!.id)
      expect(start.target).toBe(centers[0].id)
      expect(end.source).toBe(centers[0].id)
      expect(end.target).toBe(atoms.find(a => a.label === 'b')!.id)
    })

    it('projects infinity as one atom occurrence', () => {
      const graph = projectToGraph(normalize(parseExpr('∞')))
      expect(graph.nodes).toHaveLength(1)
      expect(graph.nodes[0].label).toBe('∞')
      expect(graph.nodes[0].nodeType).toBe('atom')
    })

    it('keeps chained links left-associated', () => {
      const graph = projectToGraph(normalize(parseExpr('a -> b -> c')))
      expect(graph.nodes.filter(n => n.nodeType === 'link-center')).toHaveLength(2)
      expect(graph.nodes.filter(n => n.nodeType === 'atom')).toHaveLength(3)
    })

    it('projects male and female self-closing forms', () => {
      const male = projectToGraph(normalize(parseExpr('♂x')))
      const female = projectToGraph(normalize(parseExpr('x♀')))

      expect(male.nodes.filter(n => n.nodeType === 'unary')).toHaveLength(1)
      expect(male.edges.filter(e => e.edgeType === 'self-start')).toHaveLength(1)
      expect(male.edges.filter(e => e.edgeType === 'link-end')).toHaveLength(1)

      expect(female.nodes.filter(n => n.nodeType === 'unary')).toHaveLength(1)
      expect(female.edges.filter(e => e.edgeType === 'link-start')).toHaveLength(1)
      expect(female.edges.filter(e => e.edgeType === 'self-end')).toHaveLength(1)
    })

    it('projects equality and definition as structural operators', () => {
      const equality = projectToGraph(normalize(parseExpr('a = b')))
      const definition = projectToGraph(normalize(parseExpr('s : s -> s')))

      expect(
        equality.nodes.filter(n => n.nodeType === 'operator').map(n => n.label)
      ).toEqual(['='])
      expect(equality.edges.filter(e => e.edgeType === 'relation')).toHaveLength(2)

      expect(
        definition.nodes.filter(n => n.nodeType === 'operator').map(n => n.label)
      ).toEqual([':'])
    })

    it('projects negation, set and power nodes', () => {
      const negation = projectToGraph(normalize(parseExpr('!x')))
      const set = projectToGraph(normalize(parseExpr('{a, b, c}')))
      const power = projectToGraph(parseExpr('a^2'))

      expect(negation.nodes.filter(n => n.nodeType === 'unary')).toHaveLength(1)
      expect(set.nodes.filter(n => n.nodeType === 'set')).toHaveLength(1)
      expect(set.edges.filter(e => e.edgeType === 'member')).toHaveLength(3)
      expect(power.nodes.filter(n => n.nodeType === 'power')).toHaveLength(1)
    })

    it('keeps both occurrences when normalization produces a -> a', () => {
      const graph = projectToGraph(normalize(parseExpr('a^2')))
      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')

      expect(graph.nodes.filter(n => n.nodeType === 'link-center')).toHaveLength(1)
      expect(atoms).toHaveLength(2)
      expect(atoms.map(a => a.label)).toEqual(['a', 'a'])
      expect(new Set(atoms.map(a => a.id)).size).toBe(2)
    })

    it('does not use display label as identity inside equality', () => {
      const graph = projectToGraph(normalize(parseExpr('a = a')))
      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')

      expect(atoms).toHaveLength(2)
      expect(atoms[0].label).toBe('a')
      expect(atoms[1].label).toBe('a')
      expect(atoms[0].id).not.toBe(atoms[1].id)
      expect(atoms[0].astNode).not.toBe(atoms[1].astNode)
    })

    it('gives every graph node and edge a unique runtime ID', () => {
      const graph = projectToGraph(normalize(parseExpr('(a -> a) = (a -> a)')))

      expect(new Set(graph.nodes.map(n => n.id)).size).toBe(graph.nodes.length)
      expect(new Set(graph.edges.map(e => e.id)).size).toBe(graph.edges.length)
    })

    it('projects numeric constants', () => {
      const graph = projectToGraph(normalize(parseExpr('0')))
      expect(graph.nodes).toHaveLength(1)
      expect(graph.nodes[0].label).toBe('0')
      expect(graph.nodes[0].nodeType).toBe('atom')
    })
  })

  describe('projectStatementsToGraph', () => {
    it('projects multiple statements into one graph', () => {
      const graph = projectStatementsToGraph([
        normalize(parseExpr('a -> b')),
        normalize(parseExpr('c -> d')),
      ])

      expect(graph.nodes.filter(n => n.nodeType === 'atom')).toHaveLength(4)
      expect(graph.nodes.filter(n => n.nodeType === 'link-center')).toHaveLength(2)
    })

    it('keeps repeated labels as separate occurrences across statements', () => {
      const graph = projectStatementsToGraph([
        normalize(parseExpr('a -> b')),
        normalize(parseExpr('b -> c')),
      ])
      const atoms = graph.nodes.filter(n => n.nodeType === 'atom')
      const bOccurrences = atoms.filter(n => n.label === 'b')

      expect(atoms).toHaveLength(4)
      expect(bOccurrences).toHaveLength(2)
      expect(bOccurrences[0].id).not.toBe(bOccurrences[1].id)
    })

    it('handles an empty statement list', () => {
      const graph = projectStatementsToGraph([])
      expect(graph.nodes).toHaveLength(0)
      expect(graph.edges).toHaveLength(0)
    })
  })

  describe('toCytoscapeElements', () => {
    it('preserves all occurrence IDs in Cytoscape data', () => {
      const graph = projectToGraph(normalize(parseExpr('a = a')))
      const elements = toCytoscapeElements(graph)

      const nodeElements = elements.filter(e => e.group === 'nodes')
      const edgeElements = elements.filter(e => e.group === 'edges')
      expect(nodeElements).toHaveLength(graph.nodes.length)
      expect(edgeElements).toHaveLength(graph.edges.length)
      expect(new Set(nodeElements.map(e => e.data.id)).size).toBe(graph.nodes.length)
    })

    it('handles an empty graph', () => {
      expect(toCytoscapeElements(projectStatementsToGraph([]))).toHaveLength(0)
    })
  })

  describe('linkGraphToDOT', () => {
    it('generates DOT with links', () => {
      const dot = linkGraphToDOT(projectToGraph(normalize(parseExpr('a -> b'))))
      expect(dot).toContain('digraph LinkGraph')
      expect(dot).toContain('rankdir=LR')
      expect(dot).toContain('arrowtail=odot')
      expect(dot).toContain('arrowhead=vee')
      expect(dot).toContain('}')
    })

    it('includes an escaped title', () => {
      const graph = projectToGraph(normalize(parseExpr('a -> b')))
      expect(linkGraphToDOT(graph, 'Test Graph')).toContain('label="Test Graph"')
    })

    it('escapes special characters in labels', () => {
      const dot = linkGraphToDOT(projectToGraph(normalize(parseExpr('{a, b}'))))
      expect(dot).not.toContain('label="{…}"')
      expect(dot).toContain('\\{')
    })

    it('handles an empty graph', () => {
      const dot = linkGraphToDOT(projectStatementsToGraph([]))
      expect(dot).toContain('digraph LinkGraph')
      expect(dot).toContain('}')
    })
  })
})
