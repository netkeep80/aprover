import { describe, expect, it } from 'vitest'
import { ParseError, parseSyntaxAset } from '../../src/core/parser'

describe('direct parser -> SyntaxAset', () => {
  it('parses the accepted syntax corpus directly with source provenance', () => {
    const sources = [
      'a ⟼ b.',
      'x : ¬(a ⟼ b).',
      '♀a a♂.',
      'a = b.\na != b.',
      '{a,b} a.',
      '[a] (⟼).',
      'a a.',
      '↑◁ ⟼ ↑▷.',
      '"hello" [10].',
    ]

    for (const source of sources) {
      const result = parseSyntaxAset(source)
      expect(result.read.occurrences.length, source).toBeGreaterThan(0)
      expect(
        result.read.occurrences.every(({ occurrence }) => result.provenance.has(occurrence)),
        source
      ).toBe(true)
    }
  })

  it('preserves equal-looking occurrences as distinct direct syntax occurrences', () => {
    const result = parseSyntaxAset('a a.')
    const literals = result.read.occurrences.filter(
      occurrence => occurrence.kind === result.vocabulary.kinds.Literal
    )

    expect(literals).toHaveLength(2)
    expect(literals[0].occurrence).not.toBe(literals[1].occurrence)
    expect(result.provenance.get(literals[0].occurrence)?.start.offset).toBe(0)
    expect(result.provenance.get(literals[1].occurrence)?.start.offset).toBe(2)
  })

  it('fails closed on malformed source', () => {
    expect(() => parseSyntaxAset('a ⟼')).toThrow(ParseError)
  })
})
