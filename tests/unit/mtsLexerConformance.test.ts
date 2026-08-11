import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { tokenize, toMtsConformanceToken } from '../../src/core/lexer'

interface LexingCase {
  id: string
  source: string
  tokens: string[]
}

interface ConformanceCorpus {
  schema: string
  lexing: LexingCase[]
}

function loadCorpus(): ConformanceCorpus {
  const path = resolve(
    process.cwd(),
    'contracts/anum_docs-v0.5/mts-conformance-v0.2.json'
  )
  return JSON.parse(readFileSync(path, 'utf8')) as ConformanceCorpus
}

describe('current MTS base lexer conformance dependency', () => {
  const corpus = loadCorpus()

  it('uses the v0.2 base corpus required transitively by current MTS', () => {
    expect(corpus.schema).toBe('mts-conformance/v0.2')
    expect(corpus.lexing.length).toBeGreaterThan(0)
  })

  for (const testCase of corpus.lexing) {
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
