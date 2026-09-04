/** Unit tests for the single canonical МТС parser. */

import { describe, expect, it } from 'vitest'
import { LexerError } from '../../src/core/lexer'
import { ParseError, parseSyntaxAset } from '../../src/core/parser'
import { normalizeSyntaxAset } from '../../src/core/normalizer'

const canonical = (source: string): string => normalizeSyntaxAset(parseSyntaxAset(source)).canonical

describe('Parser', () => {
  it('parses canonical left-associative link chains', () => {
    expect(canonical('a ⟼ b ⟼ c')).toBe('((a⟼b)⟼c)')
  })

  it('preserves explicit right grouping', () => {
    expect(canonical('a ⟼ (b ⟼ c)')).toBe('(a⟼(b⟼c))')
  })

  it('parses canonical projection fixity', () => {
    expect(canonical('♀a')).toBe('♀a')
    expect(canonical('a♂')).toBe('a♂')
    expect(canonical('♀a♂')).toBe('♀a♂')
  })

  it('parses canonical inversion without semantic rewriting', () => {
    expect(canonical('¬a')).toBe('¬a')
    expect(canonical('¬¬a')).toBe('¬¬a')
  })

  it('parses equality, inequality and definition', () => {
    expect(canonical('a = b')).toBe('(a=b)')
    expect(canonical('a != b')).toBe('(a!=b)')
    expect(canonical('a : b')).toBe('(a:b)')
  })

  it('keeps definition weaker than judgments and right-associative', () => {
    expect(canonical('a : b = c')).toBe('(a:(b=c))')
    expect(canonical('a : b : c')).toBe('(a:(b:c))')
  })

  it('parses context pronouns and ancestor ascent', () => {
    expect(canonical('◁')).toBe('◁')
    expect(canonical('▷')).toBe('▷')
    expect(canonical('↑↑◁')).toBe('↑↑◁')
  })

  it('keeps equal-looking square occurrences independent', () => {
    const parsed = parseSyntaxAset('{[] = ◁, [] = ▷}')
    const squares = parsed.read.occurrences.filter(
      occurrence => occurrence.kind === parsed.vocabulary.kinds.Square
    )

    expect(squares).toHaveLength(2)
    expect(squares[0].occurrence).not.toBe(squares[1].occurrence)
    expect(canonical('{[] = ◁, [] = ▷}')).toBe('{([]=◁),([]=▷)}')
  })

  it('preserves bundle source order and multiplicity syntactically', () => {
    expect(canonical('{x,y}')).toBe('{x,y}')
    expect(canonical('{y,x}')).toBe('{y,x}')
    expect(canonical('{x,x}')).toBe('{x,x}')
  })

  it('parses juxtaposition inside one line', () => {
    expect(canonical('a{b,c}')).toBe('a{b,c}')
    expect(canonical('{}b')).toBe('{}b')
    expect(canonical('{}{}')).toBe('{}{}')
    expect(canonical('[][]')).toBe('[][]')
  })

  it('keeps a newline as an application-level statement boundary', () => {
    const parsed = parseSyntaxAset('a : {x = y}\nb : {y = x}')
    const statements = parsed.read.occurrences.filter(
      occurrence => occurrence.kind === parsed.vocabulary.kinds.Statement
    )

    expect(statements).toHaveLength(2)
    expect(normalizeSyntaxAset(parsed).canonical).toBe('(a:{(x=y)})\n(b:{(y=x)})')
  })

  it('does not glue canonical root definitions across lines', () => {
    const parsed = parseSyntaxAset('∞ : {◁ = ∞, ▷ = ∞}\n(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}')
    const definitions = parsed.read.occurrences.filter(
      occurrence => occurrence.kind === parsed.vocabulary.kinds.Definition
    )

    expect(definitions).toHaveLength(2)
    expect(normalizeSyntaxAset(parsed).canonical).toBe(
      '(∞:{(◁=∞),(▷=∞)})\n(=:{(♀◁=♀▷),(◁♂=▷♂)})'
    )
  })

  it.each([
    ['(=)', '='],
    ['(!=)', '!='],
    ['(⟼)', '⟼'],
    ['(↛)', '↛'],
    ['([)', '['],
    ['(])', ']'],
  ])('distinguishes round literal %s from binary grammar', (source, expected) => {
    const parsed = parseSyntaxAset(source)
    const rounds = parsed.read.occurrences.filter(
      occurrence => occurrence.kind === parsed.vocabulary.kinds.Round
    )

    expect(rounds).toHaveLength(1)
    expect(normalizeSyntaxAset(parsed).canonical).toBe(expected)
  })

  it('does not treat binary ↛ as canonical grammar', () => {
    expect(() => parseSyntaxAset('a ↛ b')).toThrow(ParseError)
  })

  it.each(['a -> b', 'a !-> b', '!a', 'a ¬= b', 'a ≠ b', 'a^2'])(
    'rejects compatibility spelling %s',
    source => {
      expect(() => parseSyntaxAset(source)).toThrow(LexerError)
    }
  )

  it('parses numeric LinkRef-like symbols as identifiers', () => {
    expect(canonical('10 = [] ⟼ []')).toBe('(10=([]⟼[]))')
  })
})
