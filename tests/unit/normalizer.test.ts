/** Unit tests for SyntaxAset-native structural normalization. */

import { describe, expect, it } from 'vitest'
import { parseSyntaxAset } from '../../src/core/parser'
import {
  SyntaxAsetNormalizationError,
  normalizeSyntaxAset,
  syntaxAsetEqual,
} from '../../src/core/normalizer'

const canonical = (source: string): string => normalizeSyntaxAset(parseSyntaxAset(source)).canonical

describe('Normalizer', () => {
  describe('Accepted structural normalization', () => {
    it('makes non-empty round grouping transparent', () => {
      expect(canonical('a ⟼ b ⟼ c')).toBe(canonical('(a ⟼ b) ⟼ c'))
      expect(canonical('(a)')).toBe(canonical('a'))
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
      expect(syntaxAsetEqual(parseSyntaxAset('(a ⟼ b)'), parseSyntaxAset('a ⟼ b'))).toBe(true)
      expect(syntaxAsetEqual(parseSyntaxAset('a ⟼ b'), parseSyntaxAset('b ⟼ a'))).toBe(false)
    })

    it('does not claim unsupported inversion equivalence', () => {
      expect(syntaxAsetEqual(parseSyntaxAset('¬¬x'), parseSyntaxAset('x'))).toBe(false)
    })

    it('preserves bundle order instead of imposing unaccepted set algebra', () => {
      expect(canonical('{x,y}')).toBe('{x,y}')
      expect(canonical('{y,x}')).toBe('{y,x}')
      expect(canonical('{x,y}')).not.toBe(canonical('{y,x}'))
      expect(syntaxAsetEqual(parseSyntaxAset('{x,y}'), parseSyntaxAset('{y,x}'))).toBe(false)
    })

    it('preserves bundle multiplicity syntactically', () => {
      expect(canonical('{x,x}')).toBe('{x,x}')
      expect(canonical('{x,x}')).not.toBe(canonical('{x}'))
    })
  })

  describe('Guarded recursion check', () => {
    it('accepts recursive definition under canonical link constructor', () => {
      expect(() => normalizeSyntaxAset(parseSyntaxAset('abc : abc ⟼ x'))).not.toThrow()
    })

    it('rejects unguarded recursion', () => {
      expect(() => normalizeSyntaxAset(parseSyntaxAset('x : x'))).toThrow(
        SyntaxAsetNormalizationError
      )
    })

    it('rejects unguarded recursion under projection', () => {
      expect(() => normalizeSyntaxAset(parseSyntaxAset('myvar : myvar♂'))).toThrow(
        SyntaxAsetNormalizationError
      )
    })

    it('can disable the guarded-recursion validation without changing structure', () => {
      const parsed = parseSyntaxAset('x : x')
      expect(() => normalizeSyntaxAset(parsed)).toThrow(SyntaxAsetNormalizationError)
      expect(normalizeSyntaxAset(parsed, { checkGuardedRecursion: false }).canonical).toBe('(x:x)')
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

    it('preserves the external occurrence provenance map while lowering', () => {
      const parsed = parseSyntaxAset('(a ⟼ b)')
      const normalized = normalizeSyntaxAset(parsed)
      expect(normalized.provenance).toBe(parsed.provenance)
      expect(normalized.provenance.size).toBeGreaterThan(0)
    })
  })
})
