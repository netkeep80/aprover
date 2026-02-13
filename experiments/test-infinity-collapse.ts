/**
 * Experiment to reproduce issue #51: ∞ = ∞ -> ∞ -> ∞
 *
 * According to axiom A4: ∞ : (∞ -> ∞), which means ∞ = ∞ -> ∞
 *
 * But this should also mean (by recursive application):
 * - ∞ = (∞ -> ∞) -> ∞  (left-associative: ∞ -> ∞ -> ∞)
 * - ∞ = ((∞ -> ∞) -> ∞) -> ∞  (left-associative: ∞ -> ∞ -> ∞ -> ∞)
 * - And so on...
 *
 * The current implementation only checks the direct case: ∞ vs (∞ -> ∞)
 * It doesn't recursively apply A4 to handle deeper nestings.
 */

import { parseExpr } from '../src/core/parser'
import { normalize } from '../src/core/normalizer'
import { createProverState, verify } from '../src/core/prover'

const state = createProverState()

console.log('='.repeat(60))
console.log('Testing ∞ collapse behavior (issue #51)')
console.log('='.repeat(60))

// Test 1: Direct case (should work)
console.log('\n1. Testing: ∞ = ∞ -> ∞')
const test1 = normalize(parseExpr('∞ = ∞ -> ∞'))
const result1 = verify(test1, state)
console.log(`   Result: ${result1.success ? '✓' : '✗'} ${result1.message}`)

// Test 2: Two-level nesting (FAILS - this is the bug!)
console.log('\n2. Testing: ∞ = ∞ -> ∞ -> ∞')
const test2 = normalize(parseExpr('∞ = ∞ -> ∞ -> ∞'))
const result2 = verify(test2, state)
console.log(`   Result: ${result2.success ? '✓' : '✗'} ${result2.message}`)
console.log(`   Left:  ∞`)
console.log(`   Right: ((∞ -> ∞) -> ∞)  [left-associative]`)

// Test 3: Explicit parentheses (FAILS - this is the bug!)
console.log('\n3. Testing: ∞ = (∞ -> ∞) -> ∞')
const test3 = normalize(parseExpr('∞ = (∞ -> ∞) -> ∞'))
const result3 = verify(test3, state)
console.log(`   Result: ${result3.success ? '✓' : '✗'} ${result3.message}`)

// Test 4: Three-level nesting (FAILS - this is the bug!)
console.log('\n4. Testing: ∞ = ∞ -> ∞ -> ∞ -> ∞')
const test4 = normalize(parseExpr('∞ = ∞ -> ∞ -> ∞ -> ∞'))
const result4 = verify(test4, state)
console.log(`   Result: ${result4.success ? '✓' : '✗'} ${result4.message}`)

// Test 5: Reverse direction
console.log('\n5. Testing: (∞ -> ∞) -> ∞ = ∞')
const test5 = normalize(parseExpr('(∞ -> ∞) -> ∞ = ∞'))
const result5 = verify(test5, state)
console.log(`   Result: ${result5.success ? '✓' : '✗'} ${result5.message}`)

console.log('\n' + '='.repeat(60))
console.log('Analysis:')
console.log('='.repeat(60))
console.log(`
The issue is that the current implementation in prover.ts (lines 838-888)
only handles the direct case: ∞ vs (∞ -> ∞).

However, axiom A4 states: ∞ : (∞ -> ∞), which means ∞ = (∞ -> ∞)

This should be applied recursively:
  ∞ = (∞ -> ∞)

  Substituting the left ∞ in (∞ -> ∞):
  ∞ = ((∞ -> ∞) -> ∞)

  Substituting the right ∞ in (∞ -> ∞):
  ∞ = (∞ -> (∞ -> ∞))

  But due to left-associativity: ∞ -> ∞ -> ∞ = (∞ -> ∞) -> ∞

  Therefore: ∞ = (∞ -> ∞) -> ∞ = ∞ -> ∞ -> ∞

The fix should recursively check if an expression can be reduced to ∞
by repeatedly applying A4 in reverse (collapsing (∞ -> ∞) into ∞).
`)

console.log('\n' + '='.repeat(60))
console.log('Expected results (all should be ✓):')
console.log('='.repeat(60))
console.log('✓ ∞ = ∞ -> ∞')
console.log('✓ ∞ = ∞ -> ∞ -> ∞')
console.log('✓ ∞ = (∞ -> ∞) -> ∞')
console.log('✓ ∞ = ∞ -> ∞ -> ∞ -> ∞')
console.log('✓ (∞ -> ∞) -> ∞ = ∞')
