/**
 * Test with the exact formulas from issue #51
 */

import { parseExpr } from '../src/core/parser'
import { normalize } from '../src/core/normalizer'
import { createProverState, verify } from '../src/core/prover'

const state = createProverState()

console.log('='.repeat(60))
console.log('Testing formulas from issue #51')
console.log('='.repeat(60))

// From the issue, this was marked as ✗ but should be ✓
console.log('\n1. Testing: ∞ = ∞ -> ∞ -> ∞')
const test1 = normalize(parseExpr('∞ = ∞ -> ∞ -> ∞'))
const result1 = verify(test1, state)
console.log(`   Result: ${result1.success ? '✓' : '✗'} ${result1.message}`)

// Additional cases mentioned in the issue description
console.log('\n2. Testing: ∞ = (∞ -> ∞) -> ∞')
const test2 = normalize(parseExpr('∞ = (∞ -> ∞) -> ∞'))
const result2 = verify(test2, state)
console.log(`   Result: ${result2.success ? '✓' : '✗'} ${result2.message}`)

console.log('\n3. Testing: ∞ = ∞ -> ∞ -> ∞ -> ∞')
const test3 = normalize(parseExpr('∞ = ∞ -> ∞ -> ∞ -> ∞'))
const result3 = verify(test3, state)
console.log(`   Result: ${result3.success ? '✓' : '✗'} ${result3.message}`)

console.log('\n' + '='.repeat(60))
console.log('Summary:')
console.log('='.repeat(60))

if (result1.success && result2.success && result3.success) {
  console.log('\n✅ All formulas from issue #51 now verify correctly!')
  console.log('\nIssue #51 is FIXED! 🎉')
} else {
  console.log('\n❌ Some formulas still fail')
  process.exit(1)
}
