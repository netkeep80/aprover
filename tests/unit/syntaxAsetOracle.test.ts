import { describe, expect, it } from 'vitest'
import type { LinkHandle, ReadMemory } from '@mts/core'
import { ParseError } from '../../src/core/parser'
import { buildSyntaxAsetOracle } from '../../src/core/syntaxAsetOracle'

function topology(memory: ReadMemory, root: LinkHandle): string {
  const ids = new Map<LinkHandle, number>([[root, 0]])
  const queue: LinkHandle[] = [root]
  const records: Array<readonly [number, number]> = []
  const id = (link: LinkHandle): number => {
    const existing = ids.get(link)
    if (existing !== undefined) return existing
    const created = ids.size
    ids.set(link, created)
    queue.push(link)
    return created
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const poles = memory.poles(queue[cursor])
    records.push([id(poles.start), id(poles.end)])
  }
  return JSON.stringify(records)
}

describe('transitional AST -> SyntaxAset oracle', () => {
  it('is deterministic for the same source in equivalent memories', () => {
    const source = 'a ⟼ b.\nx : ¬a.'
    const first = buildSyntaxAsetOracle(source)
    const second = buildSyntaxAsetOracle(source)

    expect(topology(first.memory, first.aset)).toBe(topology(second.memory, second.aset))
  })

  it('preserves repeated equal-looking source occurrences as distinct syntax occurrences', () => {
    const result = buildSyntaxAsetOracle('a a.')
    const literals = result.read.occurrences.filter(
      (occurrence) => occurrence.kind === result.vocabulary.kinds.Literal
    )

    expect(literals).toHaveLength(2)
    expect(literals[0].occurrence).not.toBe(literals[1].occurrence)
  })

  it('keeps source provenance external to SyntaxAset identity', () => {
    const source = 'a ⟼ a.'
    const result = buildSyntaxAsetOracle(source)
    const literals = result.read.occurrences.filter(
      (occurrence) => occurrence.kind === result.vocabulary.kinds.Literal
    )

    expect(literals).toHaveLength(2)
    expect(result.provenance.get(literals[0].occurrence)?.start.offset).toBe(0)
    expect(result.provenance.get(literals[1].occurrence)?.start.offset).toBe(4)
    expect(result.provenance.has(result.aset)).toBe(false)
  })

  it('round-trips explicit link, definition, unary, set and sequence roles', () => {
    const result = buildSyntaxAsetOracle('x : ¬(a ⟼ b).\n{a,b} a.')
    const byKind = (kind: LinkHandle) =>
      result.read.occurrences.filter((occurrence) => occurrence.kind === kind)

    expect(byKind(result.vocabulary.kinds.Link)).toHaveLength(1)
    expect(byKind(result.vocabulary.kinds.Definition)).toHaveLength(1)
    expect(byKind(result.vocabulary.kinds.Not)).toHaveLength(1)
    expect(byKind(result.vocabulary.kinds.Set)).toHaveLength(1)
    expect(byKind(result.vocabulary.kinds.Sequence)).toHaveLength(1)
  })

  it('fails closed on malformed source instead of canonicalizing partial recovery state', () => {
    expect(() => buildSyntaxAsetOracle('a ⟼')).toThrow(ParseError)
  })
})
