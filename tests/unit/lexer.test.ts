/** Unit tests for the canonical МТС v0.2 lexer. */

import { describe, expect, it } from 'vitest'
import { LexerError, tokenize } from '../../src/core/lexer'

describe('Lexer', () => {
  it('tokenizes canonical operators and context glyphs', () => {
    expect(tokenize('a ⟼ b').map(t => t.type)).toEqual(['ID', 'ARROW', 'ID', 'EOF'])
    expect(tokenize('a != b').map(t => t.type)).toEqual(['ID', 'NOT_EQUAL', 'ID', 'EOF'])
    expect(tokenize('¬a').map(t => t.type)).toEqual(['NOT', 'ID', 'EOF'])
    expect(tokenize('♀a♂').map(t => t.type)).toEqual(['FEMALE', 'ID', 'MALE', 'EOF'])
    expect(tokenize('↑↑◁').map(t => t.type)).toEqual([
      'CONTEXT_UP',
      'CONTEXT_UP',
      'CONTEXT_START',
      'EOF',
    ])
  })

  it('keeps ↛ available only as a literal token for canonical round form parsing', () => {
    const tokens = tokenize('(↛)')
    expect(tokens.map(t => t.type)).toEqual(['LPAREN', 'NOT_ARROW', 'RPAREN', 'EOF'])
    expect(tokens[1].value).toBe('↛')
  })

  it('tokenizes formal containers and punctuation independently', () => {
    expect(tokenize('◁[]▷').map(t => t.type)).toEqual([
      'CONTEXT_START',
      'LBRACKET',
      'RBRACKET',
      'CONTEXT_END',
      'EOF',
    ])
    expect(tokenize('{a,b}.').map(t => t.type)).toEqual([
      'LBRACE',
      'ID',
      'COMMA',
      'ID',
      'RBRACE',
      'DOT',
      'EOF',
    ])
  })

  it('tokenizes numeric symbols used as LinkRef-like identifiers', () => {
    expect(tokenize('10 = 2 ⟼ 3').map(t => t.type)).toEqual([
      'NAT',
      'EQUAL',
      'NAT',
      'ARROW',
      'NAT',
      'EOF',
    ])
  })

  it('tokenizes serialized abit and string literals', () => {
    expect(tokenize("'01[]'")[0]).toMatchObject({ type: 'ABIT_LIT', value: '01[]' })
    expect(tokenize('"связь"')[0]).toMatchObject({ type: 'STRING_LIT', value: 'связь' })
    expect(tokenize('"a\\nb\\tc"')[0].value).toBe('a\nb\tc')
  })

  it.each(['a -> b', 'a !-> b', '!a', 'a ¬= b', 'a ≠ b', 'a^2'])(
    'rejects compatibility spelling %s',
    source => {
      expect(() => tokenize(source)).toThrow(LexerError)
    }
  )

  it('tracks source lines and columns', () => {
    const tokens = tokenize('a\nb')
    expect(tokens[0].loc.start).toMatchObject({ line: 1, column: 1 })
    expect(tokens[1].loc.start).toMatchObject({ line: 2, column: 1 })
  })

  it('skips whitespace and // comments', () => {
    expect(tokenize('  a // comment\n ⟼ b').map(t => t.type)).toEqual([
      'ID',
      'ARROW',
      'ID',
      'EOF',
    ])
  })

  it('rejects malformed literals and unexpected characters', () => {
    expect(() => tokenize('@')).toThrow(LexerError)
    expect(() => tokenize("'01")).toThrow(LexerError)
    expect(() => tokenize("''")).toThrow(LexerError)
    expect(() => tokenize("'0a1'")).toThrow(LexerError)
    expect(() => tokenize('"hello')).toThrow(LexerError)
  })
})
