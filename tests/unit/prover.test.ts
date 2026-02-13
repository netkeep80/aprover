/**
 * Unit tests for МТС prover
 */

import { describe, it, expect } from 'vitest'
import { parseExpr } from '../../src/core/parser'
import { normalize } from '../../src/core/normalizer'
import {
  createProverState,
  unify,
  applySubstitution,
  checkEquality,
  checkInequality,
  verify,
  AXIOMS,
} from '../../src/core/prover'

describe('Prover', () => {
  const state = () => createProverState()

  describe('Unification', () => {
    it('should unify identical terms', () => {
      const a = normalize(parseExpr('a -> b'))
      const b = normalize(parseExpr('a -> b'))
      expect(unify(a, b)).not.toBeNull()
    })

    it('should unify with variables', () => {
      const a = normalize(parseExpr('x -> y'))
      const b = normalize(parseExpr('a -> b'))
      const subst = unify(a, b)
      expect(subst).not.toBeNull()
      expect(subst!.get('x')).toBeDefined()
      expect(subst!.get('y')).toBeDefined()
    })

    it('should fail on conflicting structures', () => {
      const a = normalize(parseExpr('a -> b'))
      const b = normalize(parseExpr('♂c'))
      expect(unify(a, b)).toBeNull()
    })

    it('should handle nested unification', () => {
      const a = normalize(parseExpr('(x -> y) -> z'))
      const b = normalize(parseExpr('(a -> b) -> c'))
      const subst = unify(a, b)
      expect(subst).not.toBeNull()
    })

    it('should fail occurs check', () => {
      // Can't unify x with (x -> a)
      const a = normalize(parseExpr('x'))
      const b = normalize(parseExpr('x -> a'))
      expect(unify(a, b)).toBeNull()
    })
  })

  describe('Substitution', () => {
    it('should apply substitution', () => {
      const node = normalize(parseExpr('x -> y'))
      const subst = new Map<string, any>()
      subst.set('x', { type: 'Identifier', name: 'a' })
      subst.set('y', { type: 'Identifier', name: 'b' })
      const result = applySubstitution(node, subst)
      expect((result as any).left.name).toBe('a')
      expect((result as any).right.name).toBe('b')
    })
  })

  describe('Equality checking', () => {
    it('should prove reflexivity', () => {
      const a = normalize(parseExpr('a'))
      const result = checkEquality(a, a, state())
      expect(result.success).toBe(true)
    })

    it('should prove structural equality', () => {
      const a = normalize(parseExpr('a -> b'))
      const b = normalize(parseExpr('a -> b'))
      const result = checkEquality(a, b, state())
      expect(result.success).toBe(true)
    })

    it('should fail on different structures', () => {
      // Use multi-character identifiers to avoid being treated as variables
      const a1 = normalize(parseExpr('aa -> bb'))
      const b1 = normalize(parseExpr('bb -> aa'))
      const result = checkEquality(a1, b1, state())
      expect(result.success).toBe(false)
    })

    it('should use ♂ axiom', () => {
      // ♂x = ♂x -> x
      const left = normalize(parseExpr('♂a'))
      const right = normalize(parseExpr('♂a -> a'))
      const result = checkEquality(left, right, state())
      expect(result.success).toBe(true)
    })

    it('should use ♀ axiom', () => {
      // x♀ = x -> x♀
      const left = normalize(parseExpr('a♀'))
      const right = normalize(parseExpr('a -> a♀'))
      const result = checkEquality(left, right, state())
      expect(result.success).toBe(true)
    })

    it('should use ∞ axiom', () => {
      // ∞ = ∞ -> ∞
      const left = normalize(parseExpr('∞'))
      const right = normalize(parseExpr('∞ -> ∞'))
      const result = checkEquality(left, right, state())
      expect(result.success).toBe(true)
    })
  })

  describe('Inequality checking', () => {
    it('should prove inequality when equality fails', () => {
      // Use multi-character identifiers to avoid being treated as variables
      const aa = normalize(parseExpr('aa'))
      const bb = normalize(parseExpr('bb'))
      const result = checkInequality(aa, bb, state())
      expect(result.success).toBe(true)
    })

    it('should fail inequality when equality holds', () => {
      const a = normalize(parseExpr('a'))
      const b = normalize(parseExpr('a'))
      const result = checkInequality(a, b, state())
      expect(result.success).toBe(false)
    })
  })

  describe('Verify statements', () => {
    it('should verify equality statement', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify inequality statement', () => {
      // Use multi-character identifiers to avoid being treated as variables
      const neq = normalize(parseExpr('aa != bb'))
      const result = verify(neq, state())
      expect(result.success).toBe(true)
    })

    it('should register definition', () => {
      const s = state()
      const def = normalize(parseExpr('mydef : a -> b'))
      const result = verify(def, s)
      expect(result.success).toBe(true)
      expect(s.definitions.has('mydef')).toBe(true)
    })
  })

  describe('MTL formulas tests', () => {
    // Tests based on tests/mtl_formulas.mtc

    it('should verify ab = a -> b', () => {
      // This is definitional, handled by parser
      const eq = normalize(parseExpr('a -> b = a -> b'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify ♂v = ♂v -> v', () => {
      const eq = normalize(parseExpr('♂v = ♂v -> v'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify r♀ = r -> r♀', () => {
      const eq = normalize(parseExpr('r♀ = r -> r♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify ∞ = ∞ -> ∞', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify !♂x = x♀ (via normalization)', () => {
      // After normalization, !♂x becomes x♀
      const eq = normalize(parseExpr('!♂x = x♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify !x♀ = ♂x (via normalization)', () => {
      // After normalization, !x♀ becomes ♂x
      const eq = normalize(parseExpr('!x♀ = ♂x'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify left associativity: a->b->c = (a->b)->c', () => {
      const eq = normalize(parseExpr('a -> b -> c = (a -> b) -> c'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify power expansion: a^2 = a -> a', () => {
      const eq = normalize(parseExpr('a^2 = a -> a'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify power expansion: a^3 = (a -> a) -> a', () => {
      const eq = normalize(parseExpr('a^3 = (a -> a) -> a'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify ∞ = ∞ (reflexivity)', () => {
      const eq = normalize(parseExpr('∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })
  })

  describe('Detailed proof steps', () => {
    it('should return proofSteps array for successful verification', () => {
      const eq = normalize(parseExpr('∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.proofSteps).toBeDefined()
      expect(result.proofSteps!.length).toBeGreaterThan(0)
    })

    it('should include normalization step', () => {
      const eq = normalize(parseExpr('a = a'))
      const result = verify(eq, state())
      expect(result.proofSteps).toBeDefined()
      const normStep = result.proofSteps!.find(s => s.action.includes('Нормализация'))
      expect(normStep).toBeDefined()
    })

    it('should include step index numbers', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.proofSteps).toBeDefined()
      result.proofSteps!.forEach((step, idx) => {
        expect(step.index).toBe(idx + 1)
      })
    })

    it('should include before/after transformations when applicable', () => {
      const eq = normalize(parseExpr('♂a = ♂a -> a'))
      const result = verify(eq, state())
      expect(result.proofSteps).toBeDefined()
      const axiomStep = result.proofSteps!.find(s => s.axiom?.id === 'A5')
      expect(axiomStep).toBeDefined()
    })

    it('should include details in proof steps', () => {
      const eq = normalize(parseExpr('a = a'))
      const result = verify(eq, state())
      expect(result.proofSteps).toBeDefined()
      const hasDetails = result.proofSteps!.some(s => s.details !== undefined)
      expect(hasDetails).toBe(true)
    })
  })

  describe('Applied axioms tracking', () => {
    it('should track A1 for structural equality', () => {
      const eq = normalize(parseExpr('a = a'))
      const result = verify(eq, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A1')).toBe(true)
    })

    it('should track A4 for infinity axiom', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should track A5 for male axiom', () => {
      const eq = normalize(parseExpr('♂a = ♂a -> a'))
      const result = verify(eq, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A5')).toBe(true)
    })

    it('should track A6 for female axiom', () => {
      const eq = normalize(parseExpr('a♀ = a -> a♀'))
      const result = verify(eq, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A6')).toBe(true)
    })

    it('should track A0 for definitions', () => {
      const def = normalize(parseExpr('mydef : a -> b'))
      const result = verify(def, state())
      expect(result.appliedAxioms).toBeDefined()
      expect(result.appliedAxioms!.some(a => a.id === 'A0')).toBe(true)
    })

    it('should include axiom name and formula', () => {
      const eq = normalize(parseExpr('a = a'))
      const result = verify(eq, state())
      const a1 = result.appliedAxioms!.find(a => a.id === 'A1')
      expect(a1).toBeDefined()
      expect(a1!.name).toBeDefined()
      expect(a1!.formula).toBeDefined()
    })
  })

  describe('Verification hints', () => {
    it('should return hints for failed verification', () => {
      // Use multi-character identifiers to avoid being treated as variables
      const eq = normalize(parseExpr('♂∞ = ∞♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      expect(result.hints).toBeDefined()
      expect(result.hints!.length).toBeGreaterThan(0)
    })

    it('should suggest related axioms in hints', () => {
      // Male expression that can't be unified
      const eq = normalize(parseExpr('♂aa = bb'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      const axiomHint = result.hints!.find(h => h.relatedAxiom === 'A5')
      expect(axiomHint).toBeDefined()
    })

    it('should provide hint about duality for ♂ vs ♀', () => {
      const eq = normalize(parseExpr('♂∞ = ∞♀'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      const dualityHint = result.hints!.find(h => h.message.includes('дуальны'))
      expect(dualityHint).toBeDefined()
    })

    it('should provide structural hints for type mismatch', () => {
      const eq = normalize(parseExpr('∞ = ♂aa'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      expect(result.hints).toBeDefined()
    })

    it('should include hint type', () => {
      const eq = normalize(parseExpr('aa = bb'))
      const result = verify(eq, state())
      expect(result.success).toBe(false)
      result.hints!.forEach(hint => {
        expect(['structural', 'definition', 'axiom', 'suggestion']).toContain(hint.type)
      })
    })
  })

  describe('AXIOMS constant', () => {
    it('should have all axioms defined', () => {
      expect(AXIOMS.A0).toBeDefined()
      expect(AXIOMS.A1).toBeDefined()
      expect(AXIOMS.A4).toBeDefined()
      expect(AXIOMS.A5).toBeDefined()
      expect(AXIOMS.A6).toBeDefined()
      expect(AXIOMS.A7).toBeDefined()
    })

    it('should have required properties for each axiom', () => {
      Object.values(AXIOMS).forEach(axiom => {
        expect(axiom.id).toBeDefined()
        expect(axiom.name).toBeDefined()
        expect(axiom.formula).toBeDefined()
        expect(axiom.description).toBeDefined()
      })
    })
  })

  describe('Infinity collapse (issue #51)', () => {
    it('should verify ∞ = ∞ -> ∞ -> ∞ (left-associative)', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify ∞ = (∞ -> ∞) -> ∞', () => {
      const eq = normalize(parseExpr('∞ = (∞ -> ∞) -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify ∞ = ∞ -> ∞ -> ∞ -> ∞ (3-level nesting)', () => {
      const eq = normalize(parseExpr('∞ = ∞ -> ∞ -> ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify (∞ -> ∞) -> ∞ = ∞ (reverse direction)', () => {
      const eq = normalize(parseExpr('(∞ -> ∞) -> ∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify ((∞ -> ∞) -> ∞) -> ∞ = ∞ (deep nesting)', () => {
      const eq = normalize(parseExpr('((∞ -> ∞) -> ∞) -> ∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })

    it('should verify ∞ -> ∞ -> ∞ -> ∞ -> ∞ = ∞ (4-level nesting)', () => {
      const eq = normalize(parseExpr('∞ -> ∞ -> ∞ -> ∞ -> ∞ = ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
    })

    it('should verify symmetric case: ∞ = ∞ -> ∞ and ∞ -> ∞ = ∞', () => {
      const eq1 = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result1 = verify(eq1, state())
      expect(result1.success).toBe(true)

      const eq2 = normalize(parseExpr('∞ -> ∞ = ∞'))
      const result2 = verify(eq2, state())
      expect(result2.success).toBe(true)
    })

    it('should still respect the original ∞ = ∞ -> ∞ case', () => {
      // This is a regression test to ensure the simple case still works
      const eq = normalize(parseExpr('∞ = ∞ -> ∞'))
      const result = verify(eq, state())
      expect(result.success).toBe(true)
      expect(result.appliedAxioms!.some(a => a.id === 'A4')).toBe(true)
    })
  })
})
