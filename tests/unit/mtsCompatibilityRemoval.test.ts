import { describe, expect, it } from 'vitest'

import { LexerError, tokenize } from '../../src/core/lexer'
import { ParseError, parseSyntaxAset } from '../../src/core/parser'

describe('removed MTS compatibility grammar', () => {
  it.each(['a -> b', 'a !-> b', '!a', 'a ¬= b', 'a ≠ b', 'a^2'])(
    'rejects legacy spelling %s',
    source => {
      expect(() => tokenize(source)).toThrow(LexerError)
    }
  )

  it('keeps ↛ only as a canonical round literal, not a binary relation', () => {
    const parsed = parseSyntaxAset('(↛)')
    const rounds = parsed.read.occurrences.filter(
      occurrence => occurrence.kind === parsed.vocabulary.kinds.Round
    )

    expect(rounds).toHaveLength(1)
    expect(() => parseSyntaxAset('a ↛ b')).toThrow(ParseError)
  })

  it('keeps the accepted canonical spellings', () => {
    for (const source of ['a ⟼ b', '¬a', 'a != b', '(⟼)', '(!=)']) {
      expect(() => parseSyntaxAset(source), source).not.toThrow()
    }
  })
})
