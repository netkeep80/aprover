import { describe, expect, it } from 'vitest'

import { normalizeSyntaxAset } from '../../src/core/normalizer'
import { parseSyntaxAset } from '../../src/core/parser'

const canonical = (source: string): string => normalizeSyntaxAset(parseSyntaxAset(source)).canonical

const regressionCases = [
  {
    id: 'context-ascent-whitespace',
    source: '↑ ↑  ◁',
    canonical: '↑↑◁',
  },
  {
    id: 'canonical-equality-definition',
    source: '(=):{♀◁=♀▷,◁♂=▷♂}',
    canonical: '(=:{(♀◁=♀▷),(◁♂=▷♂)})',
  },
  {
    id: 'canonical-aroot-definition',
    source: '∞:{◁=∞,▷=∞}',
    canonical: '(∞:{(◁=∞),(▷=∞)})',
  },
] as const

describe('current MTS canonicalization regressions', () => {
  for (const testCase of regressionCases) {
    it(testCase.id, () => {
      expect(canonical(testCase.source)).toBe(testCase.canonical)
    })
  }

  it('preserves canonical projection fixity during parse/normalize round-trip', () => {
    const source = '(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}'
    expect(canonical(source)).toBe('(=:{(♀◁=♀▷),(◁♂=▷♂)})')
  })
})
