import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  AnumCarrierInputError,
  decodeAnumCarrier,
  deserializeAnumCarrier,
  type AnumCarrierVocabulary,
} from '../../src/core/anumCarrier'
import {
  AnumStreamDeserializationError,
  deserializeAnumStream,
} from '../../src/core/anumDenotation'
import { ExplicitMemoryView, type DistinguishedLink } from '../../src/core/memoryView'
import type { LinkRef } from '../../src/core/interpreter'

interface ValidCase {
  id: string
  source: string
}
interface InvalidCase {
  id: string
  source: string
  error: string
}
interface AnumCorpus {
  valid: ValidCase[]
  invalid: InvalidCase[]
  carrier: {
    roleIsExplicit: boolean
    readOnly: boolean
    materializes: boolean
    structural: Array<{ id: string; carrier: string; expectedSource: string }>
    rejections: Array<{ id: string; error: string }>
  }
  equivalence: {
    validRawSourceIds: string[]
    applicableInvalidRawSourceIds: string[]
    sameDenotation: boolean
    sameStackErrorCode: boolean
  }
}

const conformance = JSON.parse(
  readFileSync(resolve(process.cwd(), 'contracts/anum_docs-v0.6/mts-conformance-v0.6.json'), 'utf8')
) as { corpora: { anum: AnumCorpus } }
const corpus = conformance.corpora.anum

class TestNetworkBuilder {
  readonly links: DistinguishedLink[] = [
    { id: 1, start: 1, end: 1 },
    { id: 2, start: 2, end: 1 },
    { id: 3, start: 1, end: 3 },
    { id: 4, start: 2, end: 3 },
    { id: 5, start: 3, end: 2 },
  ]
  readonly vocabulary: AnumCarrierVocabulary = {
    root: 1,
    opening: 2,
    closing: 3,
    linked: 4,
    unlinked: 5,
  }
  private readonly pairs = new Map<string, LinkRef>([
    ['1:1', 1],
    ['2:1', 2],
    ['1:3', 3],
    ['2:3', 4],
    ['3:2', 5],
  ])
  private nextId = 6

  ensure(start: LinkRef, end: LinkRef): LinkRef {
    const key = `${start}:${end}`
    const existing = this.pairs.get(key)
    if (existing !== undefined) return existing
    const id = this.nextId++
    this.pairs.set(key, id)
    this.links.push({ id, start, end })
    return id
  }

  carrier(source: string): LinkRef {
    const values: Record<string, LinkRef> = {
      '[': this.vocabulary.opening,
      ']': this.vocabulary.closing,
      '1': this.vocabulary.linked,
      '0': this.vocabulary.unlinked,
    }
    let current = this.vocabulary.root
    for (const token of source) current = this.ensure(current, values[token])
    return current
  }

  memory(): ExplicitMemoryView {
    return new ExplicitMemoryView(this.links)
  }
}

function fixture(source = '') {
  const builder = new TestNetworkBuilder()
  const carrier = builder.carrier(source)
  return { builder, carrier, memory: builder.memory(), vocabulary: builder.vocabulary }
}

describe('accepted ANUM existing-carrier transport v0.4', () => {
  it('pins the explicit role/read-only boundary', () => {
    expect(corpus.carrier.roleIsExplicit).toBe(true)
    expect(corpus.carrier.readOnly).toBe(true)
    expect(corpus.carrier.materializes).toBe(false)
    expect(corpus.equivalence.sameDenotation).toBe(true)
    expect(corpus.equivalence.sameStackErrorCode).toBe(true)
  })

  it('replays the normative structural carrier examples', () => {
    const empty = fixture('')
    expect(decodeAnumCarrier(empty.memory, empty.vocabulary.root, empty.vocabulary)).toBe('')

    const close = fixture(']')
    expect(close.carrier).toBe(close.vocabulary.closing)
    expect(decodeAnumCarrier(close.memory, close.carrier, close.vocabulary)).toBe(']')

    const role = fixture('')
    expect(decodeAnumCarrier(role.memory, role.vocabulary.unlinked, role.vocabulary)).toBe('][')

    const expected = Object.fromEntries(
      corpus.carrier.structural.map(item => [item.id, item.expectedSource])
    )
    expect(expected['root-empty-carrier']).toBe('')
    expect(expected['C-canonical-singleton-close']).toBe(']')
    expect(expected['U-explicit-carrier-role']).toBe('][')
  })

  for (const testCase of corpus.valid) {
    it(`matches raw denotation for ${testCase.id}`, () => {
      const { carrier, memory, vocabulary } = fixture(testCase.source)
      const before = memory.entries()
      expect(decodeAnumCarrier(memory, carrier, vocabulary)).toBe(testCase.source)
      expect(deserializeAnumCarrier(memory, carrier, vocabulary)).toEqual(
        deserializeAnumStream(testCase.source)
      )
      expect(memory.entries()).toEqual(before)
    })
  }

  for (const id of corpus.equivalence.applicableInvalidRawSourceIds) {
    it(`keeps the raw stack error for ${id}`, () => {
      const testCase = corpus.invalid.find(item => item.id === id)
      if (!testCase) throw new Error(`missing invalid vector ${id}`)
      const { carrier, memory, vocabulary } = fixture(testCase.source)
      let rawError: AnumStreamDeserializationError | undefined
      let carrierError: AnumStreamDeserializationError | undefined
      try {
        deserializeAnumStream(testCase.source)
      } catch (cause) {
        if (cause instanceof AnumStreamDeserializationError) rawError = cause
        else throw cause
      }
      try {
        deserializeAnumCarrier(memory, carrier, vocabulary)
      } catch (cause) {
        if (cause instanceof AnumStreamDeserializationError) carrierError = cause
        else throw cause
      }
      expect(rawError?.code).toBe(testCase.error)
      expect(carrierError?.code).toBe(testCase.error)
    })
  }

  it('rejects start-self-closed O as a carrier instead of inventing a singleton rule', () => {
    const { memory, vocabulary } = fixture('')
    expect(() => decodeAnumCarrier(memory, vocabulary.opening, vocabulary)).toThrowError(
      expect.objectContaining({ code: 'not-rooted-sequence' })
    )
  })

  it('rejects a non-abit sequence element before stack execution', () => {
    const builder = new TestNetworkBuilder()
    const other = builder.ensure(builder.vocabulary.linked, builder.vocabulary.root)
    const carrier = builder.ensure(builder.vocabulary.root, other)
    const memory = builder.memory()
    try {
      decodeAnumCarrier(memory, carrier, builder.vocabulary)
      throw new Error('expected non-abit carrier rejection')
    } catch (cause) {
      expect(cause).toBeInstanceOf(AnumCarrierInputError)
      expect((cause as AnumCarrierInputError).code).toBe('non-abit')
    }
  })

  it('rejects a forged root vocabulary fail-closed', () => {
    const { memory, vocabulary } = fixture('')
    const wrong: AnumCarrierVocabulary = {
      ...vocabulary,
      opening: vocabulary.closing,
      closing: vocabulary.opening,
    }
    try {
      decodeAnumCarrier(memory, vocabulary.root, wrong)
      throw new Error('expected vocabulary rejection')
    } catch (cause) {
      expect(cause).toBeInstanceOf(AnumCarrierInputError)
      expect((cause as AnumCarrierInputError).code).toBe('invalid-vocabulary')
    }
  })
})
