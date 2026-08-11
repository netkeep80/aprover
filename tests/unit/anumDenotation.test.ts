import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
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

interface StreamContract {
  schema: string
  status: string
  accepted: boolean
  semanticReset: number
  alphabet: {
    abits: string[]
    rootIsFifthAbit: boolean
  }
  semanticIdentity: {
    linkIdentity: string
    samePairCreatesSecondSemanticLink: boolean
    repeatedSourcePositionCreatesSecondSemanticLink: boolean
  }
  conformance: {
    valid: ValidCase[]
    invalid: InvalidCase[]
  }
}

const contract = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'contracts/anum_docs-v0.5/anum-stream-deserialization-v0.3.json'),
    'utf8'
  )
) as StreamContract

describe('current ANUM stream deserialization v0.3', () => {
  it('pins the accepted post-reset surface', () => {
    expect(contract.schema).toBe('anum-stream-deserialization/v0.3')
    expect(contract.status).toBe('accepted')
    expect(contract.accepted).toBe(true)
    expect(contract.semanticReset).toBe(343)
    expect(contract.alphabet.abits).toEqual(['[', ']', '1', '0'])
    expect(contract.alphabet.rootIsFifthAbit).toBe(false)
    expect(contract.semanticIdentity.linkIdentity).toBe('by ordered semantic poles')
    expect(contract.semanticIdentity.samePairCreatesSecondSemanticLink).toBe(false)
    expect(contract.semanticIdentity.repeatedSourcePositionCreatesSecondSemanticLink).toBe(false)
  })

  for (const testCase of contract.conformance.valid) {
    it(`executes ${testCase.id}`, () => {
      const actual = deserializeAnumStream(testCase.source)
      expect(actual.result).toBe(testCase.expectedDenotation)
      expect(actual.operations).toEqual(testCase.expectedOperations)
      if (testCase.expectedResolvedValues) {
        expect(actual.resolvedValues).toEqual(testCase.expectedResolvedValues)
      }
      if (testCase.expectedDistinctRootRefs) {
        expect([...new Set(actual.resolvedValues)].sort()).toEqual(
          [...testCase.expectedDistinctRootRefs].sort()
        )
      }
    })
  }

  for (const testCase of contract.conformance.invalid) {
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
