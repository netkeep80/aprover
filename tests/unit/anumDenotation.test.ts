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

const currentValidCases: readonly ValidCase[] = [
  {
    id: 'empty-stream-is-root',
    source: '',
    expectedDenotation: 'R',
    expectedOperations: [],
  },
  {
    id: 'single-one-is-L',
    source: '1',
    expectedDenotation: 'L',
    expectedResolvedValues: ['L'],
    expectedOperations: ['VALUE'],
  },
  {
    id: 'flat-pair-left-fold',
    source: '10',
    expectedDenotation: '(L⟼U)',
    expectedResolvedValues: ['L', 'U'],
    expectedOperations: ['VALUE', 'VALUE'],
  },
  {
    id: 'empty-group-is-root',
    source: '[]',
    expectedDenotation: 'R',
    expectedResolvedValues: [],
    expectedOperations: ['OPEN', 'CLOSE'],
  },
  {
    id: 'two-empty-groups-collapse-to-root',
    source: '[][]',
    expectedDenotation: 'R',
    expectedResolvedValues: [],
    expectedOperations: ['OPEN', 'CLOSE', 'OPEN', 'CLOSE'],
  },
  {
    id: 'nonempty-group-root-wraps-inner-result',
    source: '[10]',
    expectedDenotation: '(R⟼(L⟼U))',
    expectedResolvedValues: ['L', 'U'],
    expectedOperations: ['OPEN', 'VALUE', 'VALUE', 'CLOSE'],
  },
  {
    id: 'group-result-is-one-parent-value',
    source: '1[10]',
    expectedDenotation: '(L⟼(R⟼(L⟼U)))',
    expectedResolvedValues: ['L', 'L', 'U'],
    expectedOperations: ['VALUE', 'OPEN', 'VALUE', 'VALUE', 'CLOSE'],
  },
  {
    id: 'nested-root-wrap',
    source: '[[10]]',
    expectedDenotation: '(R⟼(R⟼(L⟼U)))',
    expectedResolvedValues: ['L', 'U'],
    expectedOperations: ['OPEN', 'OPEN', 'VALUE', 'VALUE', 'CLOSE', 'CLOSE'],
  },
  {
    id: 'repeated-position-reuses-semantic-L',
    source: '1110',
    expectedDenotation: '(((L⟼L)⟼L)⟼U)',
    expectedResolvedValues: ['L', 'L', 'L', 'U'],
    expectedDistinctRootRefs: ['L', 'U'],
    expectedOperations: ['VALUE', 'VALUE', 'VALUE', 'VALUE'],
  },
]

const currentInvalidCases: readonly InvalidCase[] = [
  { id: 'unexpected-close', source: ']', error: 'unexpected-close' },
  { id: 'close-after-value-without-open', source: '1]', error: 'unexpected-close' },
  { id: 'unclosed-open', source: '[', error: 'unclosed-open' },
  { id: 'unclosed-nonempty-group', source: '[1', error: 'unclosed-open' },
  { id: 'non-abit', source: '2', error: 'non-abit' },
]

describe('ANUM presentation adapter over exact accepted @mts/core v0.10', () => {
  it('exposes the accepted upstream ANUM schema tag', () => {
    expect(ANUM_DESERIALIZATION_SCHEMA).toBe('anum-deserialization/v0.4')
  })

  for (const testCase of currentValidCases) {
    it(`matches current upstream semantics: ${testCase.id}`, () => {
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

  for (const testCase of currentInvalidCases) {
    it(`maps current upstream rejection: ${testCase.id}`, () => {
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
