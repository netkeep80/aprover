import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { StreamError, deserializeStream, symbolicStackAlgebra } from '@mts/core'
import { describe, expect, it } from 'vitest'

import {
  ANUM_DESERIALIZATION_SCHEMA,
  AnumStreamDeserializationError,
  deserializeAnumStream,
  semanticLink,
} from '../../src/core/anumDenotation'

interface ValidCase {
  id: string
  source: string
  expectedDenotation: string
  expectedResolvedValues?: string[]
  expectedDistinctRootRefs?: string[]
  expectedOperations: string[]
}

interface InvalidCase {
  id: string
  source: string
  error: 'unexpected-close' | 'unclosed-open' | 'non-abit'
}

interface HistoricalAnumCorpus {
  valid: ValidCase[]
  invalid: InvalidCase[]
}

interface HistoricalConformance {
  corpora: { anum: HistoricalAnumCorpus }
}

// v0.6 is retained only as migration evidence: expected observations that the
// current v0.10 package must still reproduce where the ANUM behavior overlaps.
const historical = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'contracts/anum_docs-v0.6/mts-conformance-v0.6.json'),
    'utf8'
  )
) as HistoricalConformance
const corpus = historical.corpora.anum

describe('ANUM presentation adapter over exact accepted @mts/core v0.10', () => {
  it('keeps the v0.4 tag only as historical transport metadata', () => {
    expect(ANUM_DESERIALIZATION_SCHEMA).toBe('anum-deserialization/v0.4')
  })

  for (const testCase of corpus.valid) {
    it(`replays historical vector ${testCase.id} through current upstream semantics`, () => {
      const upstream = deserializeStream(testCase.source, symbolicStackAlgebra)
      const actual = deserializeAnumStream(testCase.source)

      expect(actual.result).toBe(upstream.denotation)
      expect(actual.operations).toEqual(upstream.operations)
      expect(actual.resolvedValues).toEqual(upstream.resolvedValues)

      expect(actual.result).toBe(testCase.expectedDenotation)
      expect(actual.operations).toEqual(testCase.expectedOperations)
      if (testCase.expectedResolvedValues)
        expect(actual.resolvedValues).toEqual(testCase.expectedResolvedValues)
      if (testCase.expectedDistinctRootRefs) {
        expect([...new Set(actual.resolvedValues)].sort()).toEqual(
          [...testCase.expectedDistinctRootRefs].sort()
        )
      }
    })
  }

  for (const testCase of corpus.invalid) {
    it(`maps upstream rejection for historical vector ${testCase.id}`, () => {
      expect(() => deserializeStream(testCase.source, symbolicStackAlgebra)).toThrow(StreamError)

      try {
        deserializeAnumStream(testCase.source)
        throw new Error('expected deserialization to fail')
      } catch (cause) {
        expect(cause).toBeInstanceOf(AnumStreamDeserializationError)
        expect((cause as AnumStreamDeserializationError).code).toBe(testCase.error)
      }
    })
  }

  it('delegates canonical Link construction to the upstream symbolic algebra', () => {
    expect(semanticLink('R', 'R')).toBe(symbolicStackAlgebra.link('R', 'R'))
    expect(semanticLink('O', 'C')).toBe(symbolicStackAlgebra.link('O', 'C'))
    expect(semanticLink('L', 'U')).toBe(symbolicStackAlgebra.link('L', 'U'))
  })

  it('preserves presentation-only maximum nesting depth', () => {
    expect(deserializeAnumStream('').maxDepth).toBe(0)
    expect(deserializeAnumStream('[]').maxDepth).toBe(1)
    expect(deserializeAnumStream('[[1]]').maxDepth).toBe(2)
  })
})
