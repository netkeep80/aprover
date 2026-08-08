/**
 * Unit tests for МТС normalizer
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { parseExpr } from '../../src/core/parser'
import {
  normalize,
  toCanonicalString,
  astEqual,
  NormalizationError,
  clearNormalizationCache,
  getNormalizationCacheStats,
  setNormalizationCacheEnabled,
} from '../../src/core/normalizer'

describe('Normalizer', () => {
  const normExpr = (input: string) => normalize(parseExpr(input))
  const canonical = (input: string) => toCanonicalString(normExpr(input))

  describe('Desugaring', () => {
    it('should desugar !-> to !(a -> b)', () => {
      const ast = normExpr('a !-> b')
      expect(ast.type).toBe('Not')
      expect((ast as any).operand.type).toBe('Link')
    })

    it('should expand power a^1', () => {
      expect(canonical('a^1')).toBe('a')
    })

    it('should expand power a^2', () => {
      expect(canonical('a^2')).toBe('(a->a)')
    })

    it('should expand power a^3', () => {
      expect(canonical('a^3')).toBe('((a->a)->a)')
    })

    it('should expand power a^4', () => {
      expect(canonical('a^4')).toBe('(((a->a)->a)->a)')
    })
  })

  describe('Canonical form', () => {
    it('should eliminate double negation !!x -> x', () => {
      expect(canonical('!!x')).toBe('x')
    })

    it('should map inversion of end projection to start projection', () => {
      expect(canonical('!x♂')).toBe('♀x')
    })

    it('should map inversion of start projection to end projection', () => {
      expect(canonical('!♀x')).toBe('x♂')
    })

    it('should print the canonical inversion glyph', () => {
      expect(canonical('!!!x')).toBe('¬x')
      expect(canonical('!!!!x')).toBe('x')
    })
  })

  describe('Structural equality', () => {
    it('should detect equal expressions', () => {
      const a = normExpr('a -> b')
      const b = normExpr('a -> b')
      expect(astEqual(a, b)).toBe(true)
    })

    it('should detect different expressions', () => {
      const a = normExpr('a -> b')
      const b = normExpr('b -> a')
      expect(astEqual(a, b)).toBe(false)
    })

    it('should handle normalized equivalence', () => {
      const a = normExpr('!!x')
      const b = normExpr('x')
      expect(astEqual(a, b)).toBe(true)
    })
  })

  describe('Guarded recursion check', () => {
    it('should accept valid recursive definition', () => {
      expect(() => normExpr('abc : (abc -> x)')).not.toThrow()
    })

    it('should accept recursive definition under link constructor', () => {
      expect(() => normExpr('inf : (inf -> inf)')).not.toThrow()
    })

    it('should reject unguarded recursion', () => {
      expect(() => normExpr('x : x')).toThrow(NormalizationError)
    })

    it('should reject unguarded recursion under projection', () => {
      expect(() => normExpr('myvar : myvar♂')).toThrow(NormalizationError)
    })
  })

  describe('Canonical string', () => {
    it('should make non-empty round grouping semantically transparent', () => {
      expect(canonical('a -> b -> c')).toBe(canonical('(a -> b) -> c'))
    })

    it('should distinguish different structures', () => {
      expect(canonical('a -> b -> c')).not.toBe(canonical('a -> (b -> c)'))
    })

    it('should preserve empty round form as an atom', () => {
      expect(canonical('()')).toBe('()')
    })

    it('should preserve square and context forms', () => {
      expect(canonical('[1]')).toBe('[1]')
      expect(canonical('↑◁')).toBe('↑◁')
    })

    it('should sort set elements', () => {
      expect(canonical('{b, a}')).toBe(canonical('{a, b}'))
    })
  })

  describe('Normalization caching', () => {
    beforeEach(() => {
      clearNormalizationCache()
      setNormalizationCacheEnabled(true)
    })

    it('should cache normalization results', () => {
      const expr = 'a -> b -> c'
      normalize(parseExpr(expr))
      const stats1 = getNormalizationCacheStats()
      expect(stats1.misses).toBeGreaterThan(0)
      normalize(parseExpr(expr))
      const stats2 = getNormalizationCacheStats()
      expect(stats2.hits).toBeGreaterThan(0)
    })

    it('should return consistent results with caching', () => {
      const expr = '!!a -> b'
      const result1 = normalize(parseExpr(expr))
      const result2 = normalize(parseExpr(expr))
      expect(toCanonicalString(result1)).toBe(toCanonicalString(result2))
    })

    it('should work correctly when caching is disabled', () => {
      setNormalizationCacheEnabled(false)
      const expr = 'a -> b'
      const result1 = normalize(parseExpr(expr))
      const result2 = normalize(parseExpr(expr))
      expect(toCanonicalString(result1)).toBe(toCanonicalString(result2))
      const stats = getNormalizationCacheStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })

    it('should clear cache correctly', () => {
      const expr = 'x -> y'
      normalize(parseExpr(expr))
      const stats1 = getNormalizationCacheStats()
      expect(stats1.size).toBeGreaterThan(0)
      clearNormalizationCache()
      const stats2 = getNormalizationCacheStats()
      expect(stats2.size).toBe(0)
      expect(stats2.hits).toBe(0)
      expect(stats2.misses).toBe(0)
    })

    it('should track cache statistics correctly', () => {
      const expr1 = 'a -> b'
      const expr2 = 'c -> d'
      normalize(parseExpr(expr1))
      normalize(parseExpr(expr2))
      const statsAfterMisses = getNormalizationCacheStats()
      expect(statsAfterMisses.size).toBe(2)
      normalize(parseExpr(expr1))
      normalize(parseExpr(expr2))
      const statsAfterHits = getNormalizationCacheStats()
      expect(statsAfterHits.hits).toBe(2)
    })

    it('should cache complex expressions with power operator', () => {
      const expr = 'a^3'
      const result1 = normalize(parseExpr(expr))
      const result2 = normalize(parseExpr(expr))
      expect(toCanonicalString(result1)).toBe('((a->a)->a)')
      expect(toCanonicalString(result2)).toBe('((a->a)->a)')
    })

    it('should handle different normalization options separately', () => {
      const expr = parseExpr('a !-> b')
      const result1 = normalize(expr)
      expect(result1.type).toBe('Not')
      const result2 = normalize(expr, { desugarNotLink: false })
      expect(result2.type).toBe('NotLink')
    })

    it('should calculate hit rate correctly', () => {
      clearNormalizationCache()
      const expr = 'a -> b'
      normalize(parseExpr(expr))
      normalize(parseExpr('c -> d'))
      normalize(parseExpr(expr))
      normalize(parseExpr('c -> d'))
      const stats = getNormalizationCacheStats()
      expect(stats.hitRate).toBe(0.5)
    })
  })
})
