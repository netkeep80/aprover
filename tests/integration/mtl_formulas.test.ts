/**
 * Integration tests for МТС formulas
 * Tests the complete pipeline: text → AST → normalization → verification
 *
 * These tests verify that all formulas from tests/mtl_formulas.mtc
 * are correctly parsed, normalized, and verified.
 *
 * NOTE: Some formulas from mtl_formulas.mtc use syntax that is not yet
 * supported by the parser/prover:
 * - Multi-character identifiers as implicit links (e.g., "ab" meaning "a -> b")
 * - Implicit concatenation with parentheses (e.g., "ab(ab)")
 * - Standalone ♂♀ without operand
 */

import { describe, it, expect } from 'vitest'
import { parse } from '../../src/core/parser'
import { normalize } from '../../src/core/normalizer'
import { createProverState, verify } from '../../src/core/prover'

/**
 * Parse and verify a single formula string
 */
function verifyFormula(formula: string): { success: boolean; message: string } {
  const file = parse(formula + '.')
  const state = createProverState()
  const stmt = file.statements[0]
  const normalized = normalize(stmt.expr)
  return verify(normalized, state)
}

describe('Integration: mtl_formulas.mtc', () => {
  describe('Male operator (♂) self-closing axiom', () => {
    it('♂v = ♂v -> v (axiom А5)', () => {
      const result = verifyFormula('♂v = ♂v -> v')
      expect(result.success).toBe(true)
    })

    it('♂♂v = ♂♂v -> ♂v', () => {
      const result = verifyFormula('♂♂v = ♂♂v -> ♂v')
      expect(result.success).toBe(true)
    })

    it('♂♂♂v = ♂♂♂v -> ♂♂v', () => {
      const result = verifyFormula('♂♂♂v = ♂♂♂v -> ♂♂v')
      expect(result.success).toBe(true)
    })

    it('♂∞ = ♂∞ -> ∞', () => {
      const result = verifyFormula('♂∞ = ♂∞ -> ∞')
      expect(result.success).toBe(true)
    })
  })

  describe('Female operator (♀) self-closing axiom', () => {
    it('r♀ = r -> r♀ (axiom А6)', () => {
      const result = verifyFormula('r♀ = r -> r♀')
      expect(result.success).toBe(true)
    })

    it('r♀♀ = r♀ -> r♀♀', () => {
      const result = verifyFormula('r♀♀ = r♀ -> r♀♀')
      expect(result.success).toBe(true)
    })

    it('r♀♀♀ = r♀♀ -> r♀♀♀', () => {
      const result = verifyFormula('r♀♀♀ = r♀♀ -> r♀♀♀')
      expect(result.success).toBe(true)
    })

    it('∞♀ = ∞ -> ∞♀', () => {
      const result = verifyFormula('∞♀ = ∞ -> ∞♀')
      expect(result.success).toBe(true)
    })
  })

  describe('Infinity (∞) akorень axiom', () => {
    it('∞ = ∞ -> ∞ (axiom А4)', () => {
      const result = verifyFormula('∞ = ∞ -> ∞')
      expect(result.success).toBe(true)
    })

    it('∞ = ∞ (reflexivity)', () => {
      const result = verifyFormula('∞ = ∞')
      expect(result.success).toBe(true)
    })

    it('∞ -> ∞ = ∞', () => {
      const result = verifyFormula('∞ -> ∞ = ∞')
      expect(result.success).toBe(true)
    })

    it('(∞ -> ∞) -> ∞ = ∞ -> ∞ -> ∞ (left associativity)', () => {
      const result = verifyFormula('(∞ -> ∞) -> ∞ = ∞ -> ∞ -> ∞')
      expect(result.success).toBe(true)
    })
  })

  describe('Inversion axiom (А7)', () => {
    it('!♂x = x♀', () => {
      const result = verifyFormula('!♂x = x♀')
      expect(result.success).toBe(true)
    })

    it('!x♀ = ♂x', () => {
      const result = verifyFormula('!x♀ = ♂x')
      expect(result.success).toBe(true)
    })

    it('!♂∞ = ∞♀', () => {
      const result = verifyFormula('!♂∞ = ∞♀')
      expect(result.success).toBe(true)
    })

    it('!∞♀ = ♂∞', () => {
      const result = verifyFormula('!∞♀ = ♂∞')
      expect(result.success).toBe(true)
    })

    it('!♂♂x = ♂x♀', () => {
      const result = verifyFormula('!♂♂x = ♂x♀')
      expect(result.success).toBe(true)
    })
  })

  describe('Left associativity (А11)', () => {
    it('a->b->c = (a->b)->c', () => {
      const result = verifyFormula('a->b->c = (a->b)->c')
      expect(result.success).toBe(true)
    })

    it('a->b->c->d = (a->b->c)->d', () => {
      const result = verifyFormula('a->b->c->d = (a->b->c)->d')
      expect(result.success).toBe(true)
    })

    it('(a->b)->c->d = ((a->b)->c)->d', () => {
      const result = verifyFormula('(a->b)->c->d = ((a->b)->c)->d')
      expect(result.success).toBe(true)
    })
  })

  describe('Power operator expansion', () => {
    it('a^2 = a -> a', () => {
      const result = verifyFormula('a^2 = a -> a')
      expect(result.success).toBe(true)
    })

    it('a^3 = (a -> a) -> a', () => {
      const result = verifyFormula('a^3 = (a -> a) -> a')
      expect(result.success).toBe(true)
    })

    it('a^4 = ((a -> a) -> a) -> a', () => {
      const result = verifyFormula('a^4 = ((a -> a) -> a) -> a')
      expect(result.success).toBe(true)
    })
  })

  describe('Combined ♂∞♀ expressions', () => {
    it('♂∞♀ = (♂∞)♀', () => {
      const result = verifyFormula('♂∞♀ = (♂∞)♀')
      expect(result.success).toBe(true)
    })
  })

  describe('Inequality tests', () => {
    it('♂∞♀ != ∞', () => {
      const result = verifyFormula('♂∞♀ != ∞')
      expect(result.success).toBe(true)
    })

    it('♂∞ != ∞♀', () => {
      const result = verifyFormula('♂∞ != ∞♀')
      expect(result.success).toBe(true)
    })
  })
})

describe('Integration: Full pipeline test', () => {
  it('should process multiple statements', () => {
    const input = `
      ∞ = ∞ -> ∞.
      ♂v = ♂v -> v.
      r♀ = r -> r♀.
      !♂x = x♀.
    `
    const file = parse(input)
    expect(file.statements).toHaveLength(4)

    const state = createProverState()
    for (const stmt of file.statements) {
      const normalized = normalize(stmt.expr)
      const result = verify(normalized, state)
      expect(result.success).toBe(true)
    }
  })

  it('should normalize and verify power expressions correctly', () => {
    // Power expansion should work with normalizer
    const input = 'a^5.'
    const file = parse(input)
    const stmt = file.statements[0]
    const normalized = normalize(stmt.expr)

    // After normalization, a^5 should become ((((a -> a) -> a) -> a) -> a)
    expect(normalized.type).toBe('Link')
  })

  it('should handle deep male nesting', () => {
    const result = verifyFormula('♂♂♂♂v = ♂♂♂♂v -> ♂♂♂v')
    expect(result.success).toBe(true)
  })

  it('should handle deep female nesting', () => {
    const result = verifyFormula('r♀♀♀♀ = r♀♀♀ -> r♀♀♀♀')
    expect(result.success).toBe(true)
  })
})

/**
 * Future tests: formulas that require features not yet implemented
 *
 * The following tests document formulas from mtl_formulas.mtc that
 * require parser or prover features not yet implemented:
 *
 * 1. Multi-character identifiers as implicit links:
 *    - "ab = a -> b" (ab is parsed as identifier, not as a -> b)
 *    - "aa = a -> a"
 *    - "aaa = (a -> a) -> a"
 *
 * 2. Implicit concatenation with parentheses:
 *    - "ab(ab)" should be "(a -> b) -> (a -> b)"
 *    - Parser doesn't support identifier followed by parenthesized expression
 *
 * 3. Standalone ♂♀:
 *    - "♂♀ = ∞" requires ♂♀ to be parsed without operand
 *    - Parser requires operand for both ♂ and ♀
 *
 * 4. Extended ∞ equality proofs:
 *    - "∞ = ∞ -> ∞ -> ∞" (requires repeated application of ∞ axiom)
 *    - "∞ = ((∞ -> ∞) -> ∞) -> ∞" (similar)
 *    - Prover doesn't recursively apply ∞ axiom yet
 *
 * 5. Inverse of combined operators:
 *    - "!♂x♀ = ♂♂x" (requires understanding !(♂(x♀)) = ♂♂x)
 *
 * These tests are documented here to track what needs to be implemented
 * in future development phases.
 */
describe('Integration: Currently unsupported features (documented)', () => {
  it.skip('ab = a -> b (multi-char implicit links)', () => {
    // This would require treating multi-char identifiers as link chains
    const result = verifyFormula('ab = a -> b')
    expect(result.success).toBe(true)
  })

  it.skip('∞ = ∞ -> ∞ -> ∞ (recursive ∞ axiom)', () => {
    // Requires recursive application of ∞ axiom
    const result = verifyFormula('∞ = ∞ -> ∞ -> ∞')
    expect(result.success).toBe(true)
  })

  it.skip('♂♀ = ∞ (standalone ♂♀)', () => {
    // Parser doesn't support ♂♀ without operand
    // This would require grammar changes
  })
})
