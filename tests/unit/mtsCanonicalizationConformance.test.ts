import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseExpr } from '../../src/core/parser'
import { toMtsSource } from '../../src/core/mtsSource'

interface CanonicalizationCase {
  id: string
  source: string
  canonical: string
}

interface ConformanceCorpus {
  schema: string
  canonicalization: CanonicalizationCase[]
}

function loadCorpus(): ConformanceCorpus {
  const path = resolve(
    process.cwd(),
    'contracts/anum_docs-v0.5/mts-conformance-v0.2.json'
  )
  return JSON.parse(readFileSync(path, 'utf8')) as ConformanceCorpus
}

describe('current MTS base canonicalization dependency', () => {
  const corpus = loadCorpus()

  it('uses the v0.2 base corpus required transitively by current MTS', () => {
    expect(corpus.schema).toBe('mts-conformance/v0.2')
    expect(corpus.canonicalization.length).toBeGreaterThan(0)
  })

  for (const testCase of corpus.canonicalization) {
    it(testCase.id, () => {
      expect(toMtsSource(parseExpr(testCase.source))).toBe(testCase.canonical)
    })
  }

  it('preserves canonical projection fixity during parse/serialize round-trip', () => {
    const canonical = '(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}'
    expect(toMtsSource(parseExpr(canonical))).toBe(canonical)
  })
})
