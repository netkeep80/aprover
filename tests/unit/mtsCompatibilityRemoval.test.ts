import { describe, expect, it } from 'vitest'

import type { ASTNode } from '../../src/core/ast'
import { LexerError, tokenize } from '../../src/core/lexer'
import { ParseError, parseExpr } from '../../src/core/parser'
import { toMtsSource } from '../../src/core/mtsSource'

describe('removed MTS compatibility grammar', () => {
  it.each(['a -> b', 'a !-> b', '!a', 'a ¬= b', 'a ≠ b', 'a^2'])(
    'rejects legacy spelling %s',
    source => {
      expect(() => tokenize(source)).toThrow(LexerError)
    }
  )

  it('keeps ↛ only as a canonical round literal, not a binary relation', () => {
    expect(toMtsSource(parseExpr('(↛)'))).toBe('(↛)')
    expect(() => parseExpr('a ↛ b')).toThrow(ParseError)
  })

  it('keeps the accepted canonical spellings', () => {
    expect(toMtsSource(parseExpr('a ⟼ b'))).toBe('a ⟼ b')
    expect(toMtsSource(parseExpr('¬a'))).toBe('¬a')
    expect(toMtsSource(parseExpr('a != b'))).toBe('a != b')
    expect(toMtsSource(parseExpr('(⟼)'))).toBe('(⟼)')
    expect(toMtsSource(parseExpr('(!=)'))).toBe('(!=)')
  })

  it('has no legacy AST node kinds in the public structural union', () => {
    const canonicalNodes: ASTNode[] = [
      parseExpr('a ⟼ b'),
      parseExpr('¬a'),
      parseExpr('{a, b}'),
      parseExpr('(↛)'),
    ]
    expect(canonicalNodes.map(node => node.type)).toEqual(['Link', 'Not', 'Set', 'Round'])
    expect(canonicalNodes.some(node => ['NotLink', 'Power', 'Bracket'].includes(node.type))).toBe(
      false
    )
  })
})
