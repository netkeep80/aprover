import { describe, expect, it } from 'vitest'

import type {
  ContextPronounExpr,
  DefExpr,
  EqExpr,
  FemaleExpr,
  LiteralExpr,
  MaleExpr,
  RoundExpr,
  SetExpr,
  SquareExpr,
} from '../../src/core/ast'
import { astToString } from '../../src/core/ast'
import { parseExpr } from '../../src/core/parser'

const ROOT_V02 = [
  '∞ : {◁ = ∞, ▷ = ∞}',
  '() : ♀() ⟼ ()♂',
  '([) : (♀∞)',
  '(]) : (∞♂)',
  '(⟼) : (♀∞ ⟼ ∞♂)',
  '(↛) : (∞♂ ⟼ ♀∞)',
  '[1] : (⟼)',
  '[0] : (↛)',
  '(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}',
  '(!=) : ¬(=)',
]

describe('MTS v0.2 canonical parser surface', () => {
  it('parses every canonical root line as one definition', () => {
    for (const source of ROOT_V02) {
      expect(parseExpr(source).type, source).toBe('Definition')
    }
  })

  it('keeps meaning-of-equality distinct from equality judgment', () => {
    const meaning = parseExpr('(=)') as RoundExpr
    const judgment = parseExpr('a = b') as EqExpr

    expect(meaning.type).toBe('Round')
    expect((meaning.content as LiteralExpr).type).toBe('Literal')
    expect((meaning.content as LiteralExpr).value).toBe('=')
    expect(judgment.type).toBe('Equality')
  })

  it('keeps empty round and square forms as explicit AST nodes', () => {
    expect(parseExpr('()')).toMatchObject({ type: 'Round', content: null })
    expect(parseExpr('[]')).toMatchObject({ type: 'Square', content: null })
    expect(parseExpr('[1]')).toMatchObject({
      type: 'Square',
      content: { type: 'Num', value: 1 },
    })
  })

  it('parses the two atomic pronouns and separate ancestor ascent', () => {
    expect(parseExpr('◁')).toMatchObject({ type: 'ContextPronoun', pole: 'start', up: 0 })
    expect(parseExpr('▷')).toMatchObject({ type: 'ContextPronoun', pole: 'end', up: 0 })
    expect(parseExpr('↑↑◁')).toMatchObject({ type: 'ContextPronoun', pole: 'start', up: 2 })
    expect(() => parseExpr('↑')).toThrow(/Expected ◁ or ▷/)
  })

  it('uses canonical projection orientation', () => {
    const start = parseExpr('♀◁') as FemaleExpr
    const end = parseExpr('▷♂') as MaleExpr

    expect(start.type).toBe('Female')
    expect((start.operand as ContextPronounExpr).pole).toBe('start')
    expect(end.type).toBe('Male')
    expect((end.operand as ContextPronounExpr).pole).toBe('end')
    expect(astToString(start)).toBe('♀◁')
    expect(astToString(end)).toBe('▷♂')
  })

  it('parses aroot definition as a bundle of two contextual judgments', () => {
    const definition = parseExpr('∞ : {◁ = ∞, ▷ = ∞}') as DefExpr
    const bundle = definition.form as SetExpr

    expect(bundle.type).toBe('Set')
    expect(bundle.elements).toHaveLength(2)
    expect(bundle.elements.every(item => item.type === 'Equality')).toBe(true)
  })

  it('distinguishes square container from literal square boundary in round form', () => {
    const square = parseExpr('[0]') as SquareExpr
    const leftMeaning = parseExpr('([)') as RoundExpr
    const rightMeaning = parseExpr('(])') as RoundExpr

    expect(square.type).toBe('Square')
    expect(leftMeaning.content).toMatchObject({ type: 'Literal', value: '[' })
    expect(rightMeaning.content).toMatchObject({ type: 'Literal', value: ']' })
  })
})
