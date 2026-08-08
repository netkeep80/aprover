import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  canonicalAnum,
  denotateAnum,
  type AnumDenotation,
  type AnumDenotationContext,
  type StructuralAnumDenotation,
} from '../../src/core/anumDenotation'

interface DenotationCase {
  name: string
  raw: string
  context: AnumDenotationContext
  expected: AnumDenotation
  canonicalRaw: string | null
}

interface ConformanceCorpus {
  schema: string
  contract: string
  status: string
  cases: DenotationCase[]
}

function loadCorpus(filename: string): ConformanceCorpus {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `contracts/anum_docs-v0.2/${filename}`), 'utf8')
  ) as ConformanceCorpus
}

const pairCorpus = loadCorpus('anum-pair-denotation-conformance-v0.2.json')
const recursiveCorpus = loadCorpus('anum-recursive-denotation-conformance-v0.2.json')

function runCorpus(corpus: ConformanceCorpus): void {
  for (const testCase of corpus.cases) {
    it(testCase.name, () => {
      const actual = denotateAnum(testCase.raw, testCase.context)
      expect(actual).toEqual(testCase.expected)

      if (testCase.canonicalRaw !== null) {
        expect(actual.kind).toBe('structural')
        expect(canonicalAnum(actual)).toBe(testCase.canonicalRaw)
      } else {
        expect(() => canonicalAnum(actual)).toThrow()
      }
    })
  }
}

describe('Anum pair-denotation v0.2 upstream conformance', () => {
  it('uses the accepted pinned corpus', () => {
    expect(pairCorpus.schema).toBe('anum-pair-denotation-conformance/v0.2')
    expect(pairCorpus.contract).toBe('anum-pair-denotation/v0.2')
    expect(pairCorpus.status).toBe('accepted')
  })

  runCorpus(pairCorpus)
})

describe('Anum recursive-denotation v0.2 upstream conformance', () => {
  it('uses the accepted pinned corpus', () => {
    expect(recursiveCorpus.schema).toBe('anum-recursive-denotation-conformance/v0.2')
    expect(recursiveCorpus.contract).toBe('anum-recursive-denotation/v0.2')
    expect(recursiveCorpus.status).toBe('accepted')
  })

  runCorpus(recursiveCorpus)

  it('keeps the noncanonical uncollapsed root spelling raw', () => {
    expect(denotateAnum('[[01]1]0', 'root')).toEqual({ kind: 'raw', raw: '[[01]1]0' })
  })

  it('accepts the collapsed canonical root and round-trips it exactly', () => {
    const value = denotateAnum('[01]1]0', 'root')
    expect(value.kind).toBe('structural')
    expect(canonicalAnum(value)).toBe('[01]1]0')
  })

  it('does not run root recursive grammar in quote or relative context', () => {
    expect(denotateAnum('[[01]1]', 'quote')).toEqual({ kind: 'quoted-raw', raw: '[01]1' })
    expect(denotateAnum('[01]1', 'relative')).toEqual({ kind: 'raw', raw: '[01]1' })
  })
})

describe('canonical Anum inverse vetoes', () => {
  it('rejects shared structural node references', () => {
    const value: StructuralAnumDenotation = {
      kind: 'structural',
      anchors: ['protocol:0', 'protocol:1'],
      nodes: [
        {
          id: 0,
          start: { anchor: 'protocol:0' },
          end: { anchor: 'protocol:1' },
        },
        { id: 1, start: { node: 0 }, end: { node: 0 } },
      ],
      root: { node: 1 },
    }

    expect(() => canonicalAnum(value)).toThrow(/shared node references/i)
  })

  it('rejects unused nodes and mismatched anchor declarations', () => {
    const unusedNode: StructuralAnumDenotation = {
      kind: 'structural',
      anchors: ['protocol:0', 'protocol:1'],
      nodes: [
        {
          id: 0,
          start: { anchor: 'protocol:0' },
          end: { anchor: 'protocol:1' },
        },
        {
          id: 1,
          start: { anchor: 'protocol:1' },
          end: { anchor: 'protocol:0' },
        },
      ],
      root: { node: 0 },
    }
    expect(() => canonicalAnum(unusedNode)).toThrow(/unused structural nodes/i)

    const missingAnchor: StructuralAnumDenotation = {
      kind: 'structural',
      anchors: ['protocol:0'],
      nodes: [
        {
          id: 0,
          start: { anchor: 'protocol:0' },
          end: { anchor: 'protocol:1' },
        },
      ],
      root: { node: 0 },
    }
    expect(() => canonicalAnum(missingAnchor)).toThrow(/unused or missing anchors/i)
  })

  it('rejects external anchors even when supplied through untyped data', () => {
    const external = {
      kind: 'structural',
      anchors: ['protocol:x'],
      nodes: [],
      root: { anchor: 'protocol:x' },
    } as unknown as StructuralAnumDenotation

    expect(() => canonicalAnum(external)).toThrow(/protocol:0 or protocol:1/i)
  })
})
