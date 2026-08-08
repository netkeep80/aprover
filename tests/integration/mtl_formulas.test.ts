/**
 * Integration tests for the aprover text → AST → normalization → verification
 * pipeline.
 *
 * The application does not define an independent MTS axiom system here.
 * Normative MTS v0.2 syntax/contract lives in the pinned anum_docs artifacts;
 * these tests only exercise application consumers of that language.
 */

import { describe, it, expect } from 'vitest'
import { parse, parseExpr } from '../../src/core/parser'
import { normalize, toCanonicalString } from '../../src/core/normalizer'
import { createProverState, verify } from '../../src/core/prover'

function verifyFormula(formula: string): { success: boolean; message: string } {
  const normalized = normalize(parseExpr(formula))
  return verify(normalized, createProverState())
}

describe('Integration: canonical MTS v0.2 application pipeline', () => {
  it('keeps explicit grouping in parser and removes it only for semantic normalization', () => {
    const parsed = parseExpr('a ⟼ (b ⟼ c)') as any
    expect(parsed.type).toBe('Link')
    expect(parsed.right.type).toBe('Round')
    expect(parsed.right.content.type).toBe('Link')

    const normalized = normalize(parsed) as any
    expect(normalized.type).toBe('Link')
    expect(normalized.right.type).toBe('Link')
  })

  it('verifies reflexive judgments over canonical link syntax', () => {
    expect(verifyFormula('(a ⟼ b) = (a ⟼ b)').success).toBe(true)
  })

  it('verifies reflexive judgments over canonical start projections', () => {
    expect(verifyFormula('♀a = ♀a').success).toBe(true)
  })

  it('verifies reflexive judgments over canonical end projections', () => {
    expect(verifyFormula('a♂ = a♂').success).toBe(true)
  })

  it('normalizes the canonical inversion glyph deterministically', () => {
    expect(toCanonicalString(normalize(parseExpr('¬¬a')))).toBe('a')
  })

  it('preserves empty round form as a semantic atom', () => {
    expect(toCanonicalString(normalize(parseExpr('()')))).toBe('()')
    expect(verifyFormula('() = ()').success).toBe(true)
  })

  it('preserves square forms as structures distinct from bare boundary glyphs', () => {
    expect(toCanonicalString(normalize(parseExpr('[]')))).toBe('[]')
    expect(toCanonicalString(normalize(parseExpr('[1]')))).toBe('[1]')
    expect(toCanonicalString(normalize(parseExpr('[0]')))).toBe('[0]')
  })

  it('preserves context pronouns through normalization', () => {
    expect(toCanonicalString(normalize(parseExpr('◁')))).toBe('◁')
    expect(toCanonicalString(normalize(parseExpr('▷')))).toBe('▷')
    expect(toCanonicalString(normalize(parseExpr('↑↑◁')))).toBe('↑↑◁')
  })

  it('keeps literal (=) structurally distinct from equality judgment', () => {
    const literal = parseExpr('(=)') as any
    const judgment = parseExpr('a = b')
    expect(literal.type).toBe('Round')
    expect(literal.content.type).toBe('Literal')
    expect(judgment.type).toBe('Equality')
  })

  it('parses every canonical root definition as an application input', () => {
    const root = [
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

    for (const formula of root) {
      expect(parseExpr(formula).type).toBe('Definition')
    }
  })
})

describe('Integration: multi-statement app input', () => {
  it('processes several canonical judgments in one file', () => {
    const input = `
      ∞ = ∞
      ♀v = ♀v
      r♂ = r♂
      (a ⟼ b) = (a ⟼ b)
    `
    const file = parse(input)
    expect(file.statements).toHaveLength(4)

    const state = createProverState()
    for (const stmt of file.statements) {
      const result = verify(normalize(stmt.expr), state)
      expect(result.success).toBe(true)
    }
  })

  it('still expands application-only power sugar before verification', () => {
    const normalized = normalize(parseExpr('a^5'))
    expect(normalized.type).toBe('Link')
  })
})
