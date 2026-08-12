import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
  error: string
}

interface AnumCorpus {
  schema: string
  status: string
  accepted: boolean
  contract: string
  valid: ValidCase[]
  invalid: InvalidCase[]
  raw: { stackSemanticsChangedFromV03: boolean }
}

interface CurrentConformance {
  corpora: { anum: AnumCorpus }
}

interface CurrentContract {
  surfaces: {
    anum: {
      schema: string
      semanticReset: number
      alphabet: { abits: string[]; rootIsFifthAbit: boolean }
      semanticIdentity: {
        linkIdentity: string
        samePairCreatesSecondSemanticLink: boolean
        repeatedSourcePositionCreatesSecondSemanticLink: boolean
      }
      transports: { rawChannel: { operation: string } }
    }
  }
}

const bundleRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.6')
const current = JSON.parse(
  readFileSync(resolve(bundleRoot, 'mts-conformance-v0.6.json'), 'utf8')
) as CurrentConformance
const contract = JSON.parse(
  readFileSync(resolve(bundleRoot, 'mts-contract-v0.6.json'), 'utf8')
) as CurrentContract
const corpus = current.corpora.anum
const surface = contract.surfaces.anum

describe('current ANUM raw transport inside deserialization v0.4', () => {
  it('pins the accepted post-reset raw transport without changing v0.3 stack semantics', () => {
    expect(ANUM_DESERIALIZATION_SCHEMA).toBe('anum-deserialization/v0.4')
    expect(surface.schema).toBe(ANUM_DESERIALIZATION_SCHEMA)
    expect(surface.semanticReset).toBe(343)
    expect(surface.alphabet.abits).toEqual(['[', ']', '1', '0'])
    expect(surface.alphabet.rootIsFifthAbit).toBe(false)
    expect(surface.semanticIdentity.linkIdentity).toBe('by ordered semantic poles')
    expect(surface.semanticIdentity.samePairCreatesSecondSemanticLink).toBe(false)
    expect(surface.semanticIdentity.repeatedSourcePositionCreatesSecondSemanticLink).toBe(false)
    expect(surface.transports.rawChannel.operation).toBe('deserialize_stream')
    expect(corpus.schema).toBe('anum-deserialization-conformance/v0.4')
    expect(corpus.status).toBe('accepted')
    expect(corpus.accepted).toBe(true)
    expect(corpus.contract).toBe('anum-deserialization/v0.4')
    expect(corpus.raw.stackSemanticsChangedFromV03).toBe(false)
  })

  for (const testCase of corpus.valid) {
    it(`executes ${testCase.id}`, () => {
      const actual = deserializeAnumStream(testCase.source)
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
    it(`rejects ${testCase.id}`, () => {
      try {
        deserializeAnumStream(testCase.source)
        throw new Error('expected deserialization to fail')
      } catch (cause) {
        expect(cause).toBeInstanceOf(AnumStreamDeserializationError)
        expect((cause as AnumStreamDeserializationError).code).toBe(testCase.error)
      }
    })
  }

  it('collapses the root self-link instead of creating a second root', () => {
    expect(semanticLink('R', 'R')).toBe('R')
    expect(deserializeAnumStream('').result).toBe('R')
    expect(deserializeAnumStream('[]').result).toBe('R')
    expect(deserializeAnumStream('[][]').result).toBe('R')
  })

  it('reuses the same semantic L across repeated source positions', () => {
    const actual = deserializeAnumStream('1110')
    expect(actual.resolvedValues).toEqual(['L', 'L', 'L', 'U'])
    expect(new Set(actual.resolvedValues)).toEqual(new Set(['L', 'U']))
    expect(actual.result).toBe('(((L⟼L)⟼L)⟼U)')
  })
})
