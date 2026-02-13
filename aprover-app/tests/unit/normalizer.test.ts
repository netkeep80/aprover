/**
 * Unit tests for МТС normalizer
 */

import { describe, it, expect } from 'vitest'
import { parseExpr } from '../../src/core/parser'
import {
  normalize,
  toCanonicalString,
  astEqual,
  NormalizationError,
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
      // a^2 = (a -> a)
      expect(canonical('a^2')).toBe('(a->a)')
    })

    it('should expand power a^3', () => {
      // a^3 = ((a -> a) -> a)
      expect(canonical('a^3')).toBe('((a->a)->a)')
    })

    it('should expand power a^4', () => {
      // a^4 = (((a -> a) -> a) -> a)
      expect(canonical('a^4')).toBe('(((a->a)->a)->a)')
    })
  })

  describe('Canonical form', () => {
    it('should eliminate double negation !!x -> x', () => {
      expect(canonical('!!x')).toBe('x')
    })

    it('should convert !(♂x) -> x♀', () => {
      expect(canonical('!♂x')).toBe('x♀')
    })

    it('should convert !(x♀) -> ♂x', () => {
      expect(canonical('!x♀')).toBe('♂x')
    })

    it('should handle nested negations', () => {
      expect(canonical('!!!x')).toBe('!x')
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
      // After normalization, these should be equal
      const a = normExpr('!!x')
      const b = normExpr('x')
      expect(astEqual(a, b)).toBe(true)
    })
  })

  describe('Guarded recursion check', () => {
    it('should accept valid recursive definition', () => {
      // ♂x : (♂x -> x) is valid because ♂x appears under ->
      expect(() => normExpr('abc : (abc -> x)')).not.toThrow()
    })

    it('should accept ∞ definition', () => {
      // ∞ : (∞ -> ∞) is valid because ∞ appears under ->
      expect(() => normExpr('inf : (inf -> inf)')).not.toThrow()
    })

    it('should reject unguarded recursion', () => {
      // x : x is not valid
      expect(() => normExpr('x : x')).toThrow(NormalizationError)
    })

    it('should reject unguarded recursion in complex expression', () => {
      // x : ♂x is not valid (♂ doesn't guard recursion)
      expect(() => normExpr('myvar : ♂myvar')).toThrow(NormalizationError)
    })
  })

  describe('Canonical string', () => {
    it('should produce consistent canonical form', () => {
      // These should have the same canonical form
      expect(canonical('a -> b -> c')).toBe(canonical('(a -> b) -> c'))
    })

    it('should distinguish different structures', () => {
      expect(canonical('a -> b -> c')).not.toBe(canonical('a -> (b -> c)'))
    })

    it('should sort set elements', () => {
      expect(canonical('{b, a}')).toBe(canonical('{a, b}'))
    })
  })
})
