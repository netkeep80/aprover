import { Memory, ensureRootBasis } from '@mts/core'
import { validateVisualLinkNetwork } from '@mts/visual'
import { describe, expect, it } from 'vitest'
import { projectSemanticMemoryToVisualLinkNetwork } from '../../src/core/visualLinkNetwork'

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
