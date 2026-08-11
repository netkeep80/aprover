import { describe, expect, it } from 'vitest'

import { tokenize, toMtsConformanceToken } from '../../src/core/lexer'

const regressionCases = [
  {
    id: 'atomic-pronouns-do-not-overload-brackets',
    source: '◁[]▷',
    tokens: ['context-start', 'lbracket', 'rbracket', 'context-end'],
  },
  {
    id: 'context-ascent-is-separate',
    source: '↑↑◁',
    tokens: ['context-up', 'context-up', 'context-start'],
  },
] as const

describe('current MTS lexer regressions', () => {
  for (const testCase of regressionCases) {
    it(testCase.id, () => {
      const actual = tokenize(testCase.source)
        .filter(token => token.type !== 'EOF')
        .map(toMtsConformanceToken)

      expect(actual).not.toContain(null)
      expect(actual).toEqual(testCase.tokens)
    })
  }

  it('keeps square brackets lexically independent from pronouns', () => {
    const tokens = tokenize('◁[]▷').filter(token => token.type !== 'EOF')

    expect(tokens.map(token => token.value)).toEqual(['◁', '[', ']', '▷'])
    expect(tokens.map(token => token.type)).toEqual([
      'CONTEXT_START',
      'LBRACKET',
      'RBRACKET',
      'CONTEXT_END',
    ])
  })

  it('accepts the canonical link glyph without changing its token class', () => {
    const tokens = tokenize('◁ ⟼ ▷')
    expect(tokens.map(token => token.type)).toEqual([
      'CONTEXT_START',
      'ARROW',
      'CONTEXT_END',
      'EOF',
    ])
    expect(tokens[1].value).toBe('⟼')
  })
})
