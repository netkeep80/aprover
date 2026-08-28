import { describe, expect, it } from 'vitest'
import type { SourceLocation } from '../../src/core/sourceProvenance'
import { ParseError, parseSyntaxAset } from '../../src/core/parser'

function span(loc: SourceLocation | undefined): string | null {
  if (loc === undefined) return null
  return `${loc.start.offset}:${loc.end.offset}`
}

describe('syntax source provenance boundary', () => {
  it('is independent of AST identity and preserves repeated occurrence spans', () => {
    const result = parseSyntaxAset('a a.')
    const literals = result.read.occurrences.filter(
      occurrence => occurrence.kind === result.vocabulary.kinds.Literal
    )

    expect(literals).toHaveLength(2)
    expect(literals[0].occurrence).not.toBe(literals[1].occurrence)
    expect(span(result.provenance.get(literals[0].occurrence))).toBe('0:1')
    expect(span(result.provenance.get(literals[1].occurrence))).toBe('2:3')
  })

  it('keeps parser error coordinates on the same provenance shape', () => {
    try {
      parseSyntaxAset('a ⟼')
      throw new Error('expected parse failure')
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError)
      const loc: SourceLocation = (error as ParseError).token.loc
      expect(loc.start.line).toBe(1)
      expect(loc.start.offset).toBeGreaterThanOrEqual(3)
    }
  })
})
