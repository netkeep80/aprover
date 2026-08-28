/** Unit tests for the structural МТС v0.2 normalizer. */

import { beforeEach, describe, expect, it } from 'vitest'
import { parseExpr, parseSyntaxAset } from '../../src/core/parser'
import {
  NormalizationError,
  SyntaxAsetNormalizationError,
  astEqual,
  clearNormalizationCache,
  getNormalizationCacheStats,
  normalize,
  normalizeSyntaxAset,
  setNormalizationCacheEnabled,
  syntaxAsetEqual,
  toCanonicalString,
} from '../../src/core/normalizer'

describe('Normalizer', () => {
  const normExpr = (input: string) => normalize(parseExpr(input))
  const canonical = (input: string) => toCanonicalString(normExpr(input))

  describe('Accepted structural normalization', () => {
    it('makes non-empty round grouping semantically transparent', () => {
      expect(canonical('a ⟼ b ⟼ c')).toBe(canonical('(a ⟼ b) ⟼ c'))
    })

    it('keeps empty round form as an atom', () => {
      expect(canonical('()')).toBe('()')
    })

    it('normalizes children without inventing inversion algebra', () => {
      expect(canonical('¬¬x')).toBe('¬¬x')
      expect(canonical('¬x♂')).toBe('¬x♂')
      expect(canonical('¬♀x')).toBe('¬♀x')
    })

    it('prints only canonical glyphs', () => {
      expect(canonical('a ⟼ b')).toBe('(a⟼b)')
      expect(canonical('¬a')).toBe('¬a')
      expect(canonical('a != b')).toBe('(a!=b)')
    })
  })

  describe('Structural equality key', () => {
    it('detects equal and different link structures', () => {
      expect(astEqual(normExpr('a ⟼ b'), normExpr('a ⟼ b'))).toBe(true)
      expect(astEqual(normExpr('a ⟼ b'), normExpr('b ⟼ a'))).toBe(false)
    })

    it('does not claim unsupported inversion equivalence', () => {
      expect(astEqual(normExpr('¬¬x'), normExpr('x'))).toBe(false)
    })

    it('preserves bundle order instead of imposing unaccepted set algebra', () => {
      expect(canonical('{x,y}')).toBe('{x,y}')
      expect(canonical('{y,x}')).toBe('{y,x}')
      expect(canonical('{x,y}')).not.toBe(canonical('{y,x}'))
    })

    it('preserves bundle multiplicity syntactically', () => {
      expect(canonical('{x,x}')).toBe('{x,x}')
      expect(canonical('{x,x}')).not.toBe(canonical('{x}'))
    })
  })

  describe('Guarded recursion check', () => {
    it('accepts recursive definition under canonical link constructor', () => {
      expect(() => normExpr('abc : abc ⟼ x')).not.toThrow()
    })

    it('rejects unguarded recursion', () => {
      expect(() => normExpr('x : x')).toThrow(NormalizationError)
    })

    it('rejects unguarded recursion under projection', () => {
      expect(() => normExpr('myvar : myvar♂')).toThrow(NormalizationError)
    })
  })

  describe('Canonical structures', () => {
    it('distinguishes left and right association', () => {
      expect(canonical('a ⟼ b ⟼ c')).not.toBe(canonical('a ⟼ (b ⟼ c)'))
    })

    it('preserves square and context forms', () => {
      expect(canonical('[1]')).toBe('[1]')
      expect(canonical('↑◁')).toBe('↑◁')
    })
  })

  describe('SyntaxAset-native normalization migration', () => {
    const asetCanonical = (input: string) => normalizeSyntaxAset(parseSyntaxAset(input)).canonical

    it.each([
      'a ⟼ b',
      '(a ⟼ b)',
      'x : y',
      'a = b',
      'a != b',
      '¬♀x♂',
      '{x,y,x}',
      'a{b,c}',
      '[↑◁]',
      "'['",
      '"hello"',
      '42',
      '∞',
    ])('matches the accepted AST migration oracle for %s', (input) => {
      expect(asetCanonical(input)).toBe(canonical(input))
    })

    it('keeps non-empty round grouping transparent and empty round atomic', () => {
      expect(asetCanonical('(a)')).toBe(asetCanonical('a'))
      expect(asetCanonical('()')).toBe('()')
    })

    it('preserves the external occurrence provenance map while lowering', () => {
      const parsed = parseSyntaxAset('(a ⟼ b)')
      const normalized = normalizeSyntaxAset(parsed)
      expect(normalized.provenance).toBe(parsed.provenance)
      expect(normalized.provenance.size).toBeGreaterThan(0)
    })

    it('provides Aset-native structural equality without new semantic equivalences', () => {
      expect(syntaxAsetEqual(parseSyntaxAset('(a ⟼ b)'), parseSyntaxAset('a ⟼ b'))).toBe(true)
      expect(syntaxAsetEqual(parseSyntaxAset('a ⟼ b'), parseSyntaxAset('b ⟼ a'))).toBe(false)
      expect(syntaxAsetEqual(parseSyntaxAset('¬¬x'), parseSyntaxAset('x'))).toBe(false)
      expect(syntaxAsetEqual(parseSyntaxAset('{x,y}'), parseSyntaxAset('{y,x}'))).toBe(false)
    })

    it('applies the guarded-recursion rule directly to SyntaxAset structure', () => {
      expect(() => normalizeSyntaxAset(parseSyntaxAset('abc : abc ⟼ x'))).not.toThrow()
      expect(() => normalizeSyntaxAset(parseSyntaxAset('x : x'))).toThrow(
        SyntaxAsetNormalizationError
      )
      expect(() => normalizeSyntaxAset(parseSyntaxAset('myvar : myvar♂'))).toThrow(
        SyntaxAsetNormalizationError
      )
    })
  })

  describe('Normalization caching', () => {
    beforeEach(() => {
      clearNormalizationCache()
      setNormalizationCacheEnabled(true)
    })

    it('caches structural normalization results', () => {
      const expr = 'a ⟼ b ⟼ c'
      normalize(parseExpr(expr))
      expect(getNormalizationCacheStats().misses).toBeGreaterThan(0)
      normalize(parseExpr(expr))
      expect(getNormalizationCacheStats().hits).toBeGreaterThan(0)
    })

    it('works when caching is disabled', () => {
      setNormalizationCacheEnabled(false)
      const first = normalize(parseExpr('a ⟼ b'))
      const second = normalize(parseExpr('a ⟼ b'))
      expect(toCanonicalString(first)).toBe(toCanonicalString(second))
      expect(getNormalizationCacheStats()).toMatchObject({ hits: 0, misses: 0 })
    })

    it('clears cache statistics', () => {
      normalize(parseExpr('x ⟼ y'))
      expect(getNormalizationCacheStats().size).toBeGreaterThan(0)
      clearNormalizationCache()
      expect(getNormalizationCacheStats()).toMatchObject({ size: 0, hits: 0, misses: 0 })
    })

    it('separates the remaining guarded-recursion option', () => {
      const expr = parseExpr('x : x')
      expect(() => normalize(expr)).toThrow(NormalizationError)
      expect(() => normalize(expr, { checkGuardedRecursion: false })).not.toThrow()
    })

    it('calculates hit rate', () => {
      clearNormalizationCache()
      normalize(parseExpr('a ⟼ b'))
      normalize(parseExpr('c ⟼ d'))
      normalize(parseExpr('a ⟼ b'))
      normalize(parseExpr('c ⟼ d'))
      expect(getNormalizationCacheStats().hitRate).toBe(0.5)
    })
  })
})
