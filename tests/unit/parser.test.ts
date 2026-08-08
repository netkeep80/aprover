/** Unit tests for the single canonical МТС v0.2 parser. */

import { describe, expect, it } from 'vitest'
import { LexerError } from '../../src/core/lexer'
import { ParseError, parseExpr } from '../../src/core/parser'
import { toMtsSource } from '../../src/core/mtsSource'

describe('Parser', () => {
  it('parses canonical left-associative link chains', () => {
    const ast = parseExpr('a ⟼ b ⟼ c')
    expect(ast.type).toBe('Link')
    expect(toMtsSource(ast)).toBe('a ⟼ b ⟼ c')
  })

  it('preserves explicit right grouping', () => {
    expect(toMtsSource(parseExpr('a ⟼ (b ⟼ c)'))).toBe('a ⟼ (b ⟼ c)')
  })

  it('parses canonical projection fixity', () => {
    expect(toMtsSource(parseExpr('♀a'))).toBe('♀a')
    expect(toMtsSource(parseExpr('a♂'))).toBe('a♂')
    expect(toMtsSource(parseExpr('♀a♂'))).toBe('♀a♂')
  })

  it('parses canonical inversion without semantic rewriting', () => {
    expect(toMtsSource(parseExpr('¬a'))).toBe('¬a')
    expect(toMtsSource(parseExpr('¬¬a'))).toBe('¬¬a')
  })

  it('parses equality, inequality and definition', () => {
    expect(toMtsSource(parseExpr('a = b'))).toBe('a = b')
    expect(toMtsSource(parseExpr('a != b'))).toBe('a != b')
    expect(toMtsSource(parseExpr('a : b'))).toBe('a : b')
  })

  it('parses context pronouns and ancestor ascent', () => {
    expect(toMtsSource(parseExpr('◁'))).toBe('◁')
    expect(toMtsSource(parseExpr('▷'))).toBe('▷')
    expect(toMtsSource(parseExpr('↑↑◁'))).toBe('↑↑◁')
  })

  it('keeps square occurrences independent in the AST', () => {
    const ast = parseExpr('{[] = ◁, [] = ▷}') as any
    expect(ast.type).toBe('Set')
    expect(ast.elements).toHaveLength(2)
    expect(ast.elements[0].left).not.toBe(ast.elements[1].left)
    expect(toMtsSource(ast)).toBe('{[] = ◁, [] = ▷}')
  })

  it('preserves bundle source order and multiplicity syntactically', () => {
    expect(toMtsSource(parseExpr('{x,y}'))).toBe('{x, y}')
    expect(toMtsSource(parseExpr('{y,x}'))).toBe('{y, x}')
    expect(toMtsSource(parseExpr('{x,x}'))).toBe('{x, x}')
  })

  it('distinguishes round literals from judgments and link forms', () => {
    expect(toMtsSource(parseExpr('(=)'))).toBe('(=)')
    expect(toMtsSource(parseExpr('(!=)'))).toBe('(!=)')
    expect(toMtsSource(parseExpr('(⟼)'))).toBe('(⟼)')
    expect(toMtsSource(parseExpr('(↛)'))).toBe('(↛)')
    expect(toMtsSource(parseExpr('([)'))).toBe('([)')
    expect(toMtsSource(parseExpr('(])'))).toBe('(])')
  })

  it('does not treat binary ↛ as canonical grammar', () => {
    expect(() => parseExpr('a ↛ b')).toThrow(ParseError)
  })

  it.each(['a -> b', 'a !-> b', '!a', 'a ¬= b', 'a ≠ b', 'a^2'])(
    'rejects compatibility spelling %s',
    source => {
      expect(() => parseExpr(source)).toThrow(LexerError)
    }
  )

  it('parses numeric LinkRef-like symbols as identifiers', () => {
    expect(toMtsSource(parseExpr('10 = [] ⟼ []'))).toBe('10 = [] ⟼ []')
  })
})
