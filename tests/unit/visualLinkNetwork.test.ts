import { Memory, ensureRootBasis } from '@mts/core'
import { validateVisualLinkNetwork } from '@mts/visual'
import { describe, expect, it } from 'vitest'
import {
  projectRootedLinkClosureToVisualLinkNetwork,
  projectSemanticMemoryToVisualLinkNetwork,
} from '../../src/core/visualLinkNetwork'

function linksByKey(network: ReturnType<typeof projectSemanticMemoryToVisualLinkNetwork>) {
  return new Map(network.links.map(link => [link.key, link]))
}

describe('semantic Memory -> VisualLinkNetwork', () => {
  it('projects minimal root R as one ordinary recursive visual Link', () => {
    const memory = new Memory()

    const network = projectSemanticMemoryToVisualLinkNetwork(memory)

    expect(network.links).toEqual([
      {
        key: 'memory-link:0',
        startKey: 'memory-link:0',
        endKey: 'memory-link:0',
      },
    ])
    expect(Object.isFrozen(network)).toBe(true)
    expect(() => validateVisualLinkNetwork(network)).not.toThrow()
  })

  it('preserves exact R/O/C/L/U semantic poles', () => {
    const memory = new Memory()
    ensureRootBasis(memory)

    const network = projectSemanticMemoryToVisualLinkNetwork(memory)

    expect(network.links).toEqual([
      { key: 'memory-link:0', startKey: 'memory-link:0', endKey: 'memory-link:0' },
      { key: 'memory-link:1', startKey: 'memory-link:1', endKey: 'memory-link:0' },
      { key: 'memory-link:2', startKey: 'memory-link:0', endKey: 'memory-link:2' },
      { key: 'memory-link:3', startKey: 'memory-link:1', endKey: 'memory-link:2' },
      { key: 'memory-link:4', startKey: 'memory-link:2', endKey: 'memory-link:1' },
    ])
    expect(() => validateVisualLinkNetwork(network)).not.toThrow()
  })

  it('preserves links-of-links and self-closed recursive poles', () => {
    const memory = new Memory()
    const basis = ensureRootBasis(memory)
    const bridge = memory.ensure(basis.L, basis.U)
    const startSelfClosed = memory.ensureStartSelfClosed(bridge)
    const endSelfClosed = memory.ensureEndSelfClosed(bridge)
    memory.ensure(startSelfClosed, endSelfClosed)

    const byKey = linksByKey(projectSemanticMemoryToVisualLinkNetwork(memory))

    expect(byKey.get('memory-link:5')).toEqual({
      key: 'memory-link:5',
      startKey: 'memory-link:3',
      endKey: 'memory-link:4',
    })
    expect(byKey.get('memory-link:6')).toEqual({
      key: 'memory-link:6',
      startKey: 'memory-link:6',
      endKey: 'memory-link:5',
    })
    expect(byKey.get('memory-link:7')).toEqual({
      key: 'memory-link:7',
      startKey: 'memory-link:5',
      endKey: 'memory-link:7',
    })
    expect(byKey.get('memory-link:8')).toEqual({
      key: 'memory-link:8',
      startKey: 'memory-link:6',
      endKey: 'memory-link:7',
    })
  })

  it('is deterministic and keeps existing presentation keys stable after append', () => {
    const memory = new Memory()
    const basis = ensureRootBasis(memory)
    const first = projectSemanticMemoryToVisualLinkNetwork(memory)

    expect(projectSemanticMemoryToVisualLinkNetwork(memory)).toEqual(first)

    memory.ensure(basis.L, basis.R)
    const extended = linksByKey(projectSemanticMemoryToVisualLinkNetwork(memory))
    for (const link of first.links) {
      expect(extended.get(link.key)).toEqual(link)
    }
  })

  it('does not mutate Memory handles, link count, or poles', () => {
    const memory = new Memory()
    const basis = ensureRootBasis(memory)
    memory.ensure(basis.L, basis.U)
    const handlesBefore = memory.allLinks()
    const polesBefore = handlesBefore.map(link => memory.poles(link))
    const countBefore = memory.linkCount

    projectSemanticMemoryToVisualLinkNetwork(memory)

    const handlesAfter = memory.allLinks()
    expect(memory.linkCount).toBe(countBefore)
    expect(handlesAfter).toHaveLength(handlesBefore.length)
    for (let index = 0; index < handlesBefore.length; index += 1) {
      expect(handlesAfter[index]).toBe(handlesBefore[index])
      const polesAfter = memory.poles(handlesAfter[index])
      expect(polesAfter.start).toBe(polesBefore[index].start)
      expect(polesAfter.end).toBe(polesBefore[index].end)
    }
  })
})

describe('rooted Link closure -> VisualLinkNetwork', () => {
  it('projects recursive root exactly once with resolvable endpoints', () => {
    const memory = new Memory()
    const root = memory.allLinks()[0]

    const network = projectRootedLinkClosureToVisualLinkNetwork(memory, root)

    expect(network.links).toEqual([
      {
        key: 'memory-link:0',
        startKey: 'memory-link:0',
        endKey: 'memory-link:0',
      },
    ])
    expect(() => validateVisualLinkNetwork(network)).not.toThrow()
  })

  it('projects only the transitive pole closure and excludes unreachable links', () => {
    const memory = new Memory()
    const basis = ensureRootBasis(memory)
    const nested = memory.ensure(basis.L, basis.U)
    const root = memory.ensure(nested, basis.C)
    memory.ensure(basis.O, basis.L)

    const network = projectRootedLinkClosureToVisualLinkNetwork(memory, root)

    expect(network.links).toEqual([
      { key: 'memory-link:0', startKey: 'memory-link:1', endKey: 'memory-link:5' },
      { key: 'memory-link:1', startKey: 'memory-link:2', endKey: 'memory-link:6' },
      { key: 'memory-link:2', startKey: 'memory-link:3', endKey: 'memory-link:5' },
      { key: 'memory-link:3', startKey: 'memory-link:3', endKey: 'memory-link:4' },
      { key: 'memory-link:4', startKey: 'memory-link:4', endKey: 'memory-link:4' },
      { key: 'memory-link:5', startKey: 'memory-link:4', endKey: 'memory-link:5' },
      { key: 'memory-link:6', startKey: 'memory-link:5', endKey: 'memory-link:3' },
    ])
    expect(new Set(network.links.map(link => link.key)).size).toBe(network.links.length)
    expect(() => validateVisualLinkNetwork(network)).not.toThrow()
  })

  it('terminates on self-start and self-end topology and preserves links-of-links', () => {
    const memory = new Memory()
    const basis = ensureRootBasis(memory)
    const bridge = memory.ensure(basis.L, basis.U)
    const startSelfClosed = memory.ensureStartSelfClosed(bridge)
    const endSelfClosed = memory.ensureEndSelfClosed(bridge)
    const root = memory.ensure(startSelfClosed, endSelfClosed)

    const network = projectRootedLinkClosureToVisualLinkNetwork(memory, root)

    expect(new Set(network.links.map(link => link.key)).size).toBe(network.links.length)
    expect(network.links).toHaveLength(9)
    expect(() => validateVisualLinkNetwork(network)).not.toThrow()
  })

  it('is deterministic and leaves Memory unchanged', () => {
    const memory = new Memory()
    const basis = ensureRootBasis(memory)
    const root = memory.ensure(basis.L, basis.U)
    const handlesBefore = memory.allLinks()
    const polesBefore = handlesBefore.map(link => memory.poles(link))
    const countBefore = memory.linkCount

    const first = projectRootedLinkClosureToVisualLinkNetwork(memory, root)
    const second = projectRootedLinkClosureToVisualLinkNetwork(memory, root)

    expect(second).toEqual(first)
    expect(memory.linkCount).toBe(countBefore)
    expect(memory.allLinks()).toEqual(handlesBefore)
    handlesBefore.forEach((link, index) => {
      expect(memory.poles(link)).toEqual(polesBefore[index])
    })
  })
})
