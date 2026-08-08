import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseExpr } from '../../src/core/parser'
import {
  ANUM_RAW_CARRIER_SCHEMA,
  cleanQuatAnum,
  describeRawCarrier,
  getQuatAnumStats,
  isQuatAnumContent,
  quatAnumFileToMtl,
  validateQuatAnum,
  visualizeQuatConversion,
} from '../../src/core/quatAnum'

interface RawCarrierCase {
  name: string
  raw: string
  expected: unknown
}

interface RawCarrierCorpus {
  schema: string
  contract: string
  status: string
  cases: RawCarrierCase[]
}

function loadCorpus(): RawCarrierCorpus {
  const path = resolve(
    process.cwd(),
    'contracts/anum_docs-v0.2/anum-raw-carrier-conformance-v0.2.json'
  )
  return JSON.parse(readFileSync(path, 'utf8')) as RawCarrierCorpus
}

describe('Anum raw-carrier adapter', () => {
  const corpus = loadCorpus()

  it('is pinned to the accepted upstream raw-carrier contract', () => {
    expect(ANUM_RAW_CARRIER_SCHEMA).toBe('anum-raw-carrier/v0.2')
    expect(corpus.contract).toBe(ANUM_RAW_CARRIER_SCHEMA)
    expect(corpus.status).toBe('accepted')
  })

  for (const testCase of corpus.cases) {
    it(`matches upstream raw carrier: ${testCase.name}`, () => {
      expect(describeRawCarrier(testCase.raw)).toEqual(testCase.expected)
    })
  }

  it('does not impose bracket-denotation rules on the raw carrier', () => {
    expect(validateQuatAnum('][')).toEqual({ valid: true })
    expect(describeRawCarrier('][').raw).toBe('][')
  })

  it('rejects characters outside the four raw abits', () => {
    expect(isQuatAnumContent('01[]')).toBe(true)
    expect(isQuatAnumContent('01x')).toBe(false)
  })

  it('removes only transport whitespace/comments', () => {
    expect(cleanQuatAnum('0 1 // pair\n[ ]')).toBe('01[]')
  })

  it('presents .anum losslessly without inventing L2 denotation', () => {
    const source = quatAnumFileToMtl('01\n][')
    expect(source).toContain("'01'.")
    expect(source).toContain("']['.")
    expect(source).not.toContain('⟼')
    expect(source).not.toContain('♂')
    expect(source).not.toContain('♀')
    expect(() => parseExpr("'01'")).not.toThrow()
  })

  it('visualizes carrier construction in protocol roles, not old abit formulas', () => {
    const steps = visualizeQuatConversion('01')
    expect(steps.map(step => step.definition)).toEqual(['abit:0', 'abit:1'])
    expect(steps.map(step => step.formal)).toEqual(["'0'", "'01'"])
    expect(steps.every(step => !step.description.includes('denotation'))).toBe(true)
  })

  it('reports raw-carrier counts only', () => {
    expect(getQuatAnumStats('001[]')).toEqual({
      abitCount: 5,
      zeroCount: 2,
      oneCount: 1,
      openCount: 1,
      closeCount: 1,
    })
  })
})
