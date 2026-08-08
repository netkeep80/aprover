import { describe, expect, it } from 'vitest'

import { ExplicitMemoryView } from '../../src/core/memoryView'

describe('ExplicitMemoryView', () => {
  it('indexes distinguished links and canonical projections without mutation APIs', () => {
    const memory = new ExplicitMemoryView([
      { id: 10, start: 1, end: 2 },
      { id: 20, start: 20, end: 10 },
      { id: 30, start: 10, end: 30 },
    ])

    expect(memory.poles(10)).toEqual([1, 2])
    expect(memory.findLink(1, 2)).toBe(10)
    expect(memory.findStartProjection(10)).toBe(20)
    expect(memory.findEndProjection(10)).toBe(30)
    expect(memory.findLink(2, 1)).toBeUndefined()
    expect(memory.entries()).toEqual([
      [10, [1, 2]],
      [20, [20, 10]],
      [30, [10, 30]],
    ])
  })

  it('rejects duplicate link ids', () => {
    expect(
      () =>
        new ExplicitMemoryView([
          { id: 10, start: 1, end: 2 },
          { id: 10, start: 3, end: 4 },
        ])
    ).toThrow('Duplicate memory link id 10')
  })

  it('rejects two identities for the same canonical link', () => {
    expect(
      () =>
        new ExplicitMemoryView([
          { id: 10, start: 1, end: 2 },
          { id: 11, start: 1, end: 2 },
        ])
    ).toThrow('Ambiguous canonical Link identity')
  })

  it('allows a general link network and reports projection ambiguity only on projection read', () => {
    const memory = new ExplicitMemoryView([
      { id: 0, start: 0, end: 0 },
      { id: 1, start: 0, end: 1 },
      { id: 2, start: 1, end: 0 },
      { id: 3, start: 1, end: 1 },
    ])

    expect(memory.findLink(0, 1)).toBe(1)
    expect(memory.outgoing(0)).toEqual([0, 1])
    expect(memory.incoming(1)).toEqual([1, 3])
    expect(memory.allLinks()).toEqual([0, 1, 2, 3])
    expect(() => memory.findEndProjection(0)).toThrow('Ambiguous end projection for form 0')
  })

  it('throws when poles are requested for an unknown link', () => {
    const memory = new ExplicitMemoryView([])
    expect(() => memory.poles(999)).toThrow('Unknown memory link 999')
  })
})
