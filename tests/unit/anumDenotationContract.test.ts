import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  canonicalDenotationJson,
  validateAnumDenotation,
  type AnumDenotation,
} from '../../src/core/anumDenotation'

interface BaseCase {
  name: string
  value: AnumDenotation
  canonicalJson: string
}

interface BaseCorpus {
  schema: string
  contract: string
  status: string
  cases: BaseCase[]
}

function loadCorpus(): BaseCorpus {
  const path = resolve(
    process.cwd(),
    'contracts/anum_docs-v0.2/anum-denotation-conformance-v0.2.json'
  )
  return JSON.parse(readFileSync(path, 'utf8')) as BaseCorpus
}

describe('Anum denotation v0.2 base IR contract', () => {
  const corpus = loadCorpus()

  it('uses the accepted pinned base corpus', () => {
    expect(corpus.schema).toBe('anum-denotation-conformance/v0.2')
    expect(corpus.contract).toBe('anum-denotation/v0.2')
    expect(corpus.status).toBe('accepted')
  })

  for (const testCase of corpus.cases) {
    it(`validates and canonicalizes ${testCase.name}`, () => {
      expect(() => validateAnumDenotation(testCase.value)).not.toThrow()
      expect(canonicalDenotationJson(testCase.value)).toBe(testCase.canonicalJson)
    })
  }

  it('allows opaque anchors and explicit sharing in the general IR', () => {
    const shared: AnumDenotation = {
      kind: 'structural',
      anchors: ['a', 'b'],
      nodes: [
        { id: 0, start: { anchor: 'a' }, end: { anchor: 'b' } },
        { id: 1, start: { node: 0 }, end: { node: 0 } },
      ],
      root: { node: 1 },
    }
    expect(() => validateAnumDenotation(shared)).not.toThrow()
  })

  it('rejects undeclared anchors', () => {
    const value = {
      kind: 'structural',
      anchors: ['a'],
      nodes: [],
      root: { anchor: 'b' },
    } as AnumDenotation
    expect(() => validateAnumDenotation(value)).toThrow(/undeclared anchor/i)
  })

  it('rejects forward node references', () => {
    const value = {
      kind: 'structural',
      anchors: ['a'],
      nodes: [
        { id: 0, start: { node: 1 }, end: { anchor: 'a' } },
        { id: 1, start: { anchor: 'a' }, end: { anchor: 'a' } },
      ],
      root: { node: 1 },
    } as AnumDenotation
    expect(() => validateAnumDenotation(value)).toThrow(/earlier node/i)
  })

  it('rejects non-contiguous node ids', () => {
    const value = {
      kind: 'structural',
      anchors: ['a'],
      nodes: [{ id: 1, start: { anchor: 'a' }, end: { anchor: 'a' } }],
      root: { node: 0 },
    } as AnumDenotation
    expect(() => validateAnumDenotation(value)).toThrow(/contiguous and ordered/i)
  })

  it('rejects mixed reference shapes from untyped data', () => {
    const value = {
      kind: 'structural',
      anchors: ['a'],
      nodes: [],
      root: { anchor: 'a', node: 0 },
    } as unknown as AnumDenotation
    expect(() => validateAnumDenotation(value)).toThrow(/exactly one anchor or node/i)
  })

  it('rejects unsorted, duplicate, or empty anchor declarations', () => {
    const withAnchors = (anchors: string[]): AnumDenotation => ({
      kind: 'structural',
      anchors,
      nodes: [],
      root: { anchor: anchors[0] ?? '' },
    })

    expect(() => validateAnumDenotation(withAnchors(['b', 'a']))).toThrow(/sorted/i)
    expect(() => validateAnumDenotation(withAnchors(['a', 'a']))).toThrow(/unique/i)
    expect(() => validateAnumDenotation(withAnchors(['']))).toThrow(/non-empty/i)
  })
})
