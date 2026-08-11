import { describe, expect, it } from 'vitest'

import { parseExpr } from '../../src/core/parser'
import { toMtsSource } from '../../src/core/mtsSource'

const regressionCases = [
  {
    id: 'context-ascent-whitespace',
    source: '↑ ↑  ◁',
    canonical: '↑↑◁',
  },
  {
    id: 'canonical-equality-definition',
    source: '(=):{♀◁=♀▷,◁♂=▷♂}',
    canonical: '(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}',
  },
  {
    id: 'canonical-aroot-definition',
    source: '∞:{◁=∞,▷=∞}',
    canonical: '∞ : {◁ = ∞, ▷ = ∞}',
  },
] as const

describe('current MTS canonicalization regressions', () => {
  for (const testCase of regressionCases) {
    it(testCase.id, () => {
      expect(toMtsSource(parseExpr(testCase.source))).toBe(testCase.canonical)
    })
  }

  it('preserves canonical projection fixity during parse/serialize round-trip', () => {
    const canonical = '(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}'
    expect(toMtsSource(parseExpr(canonical))).toBe(canonical)
  })
})
