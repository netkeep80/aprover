import { describe, expect, it } from 'vitest'

import { parseExpr } from '../../src/core/parser'
import { deserializeAnumStream } from '../../src/core/anumDenotation'
import {
  cleanQuatAnum,
  describeRawCarrier,
  getQuatAnumStats,
  isQuatAnumContent,
  quatAnumFileToMtl,
  validateQuatAnum,
  visualizeQuatConversion,
} from '../../src/core/quatAnum'

describe('Anum quaternary channel presentation adapter', () => {
  it('uses exactly the four transport abits without a fifth root symbol', () => {
    expect(isQuatAnumContent('01[]')).toBe(true)
    expect(isQuatAnumContent('R')).toBe(false)
    expect(isQuatAnumContent('01x')).toBe(false)
  })

  it('keeps lexical channel validation separate from semantic stack validation', () => {
    expect(validateQuatAnum('][')).toEqual({ valid: true })
    expect(describeRawCarrier('][').raw).toBe('][')
    expect(() => deserializeAnumStream('][')).toThrow(/unexpected-close/)
  })

  it('removes only transport whitespace/comments', () => {
    expect(cleanQuatAnum('0 1 // pair\n[ ]')).toBe('01[]')
  })

  it('presents transport positions losslessly without making them Link identities', () => {
    const carrier = describeRawCarrier('1110')
    expect(carrier.nodes).toHaveLength(4)
    expect(carrier.raw).toBe('1110')

    const semantic = deserializeAnumStream(carrier.raw)
    expect(semantic.resolvedValues).toEqual(['L', 'L', 'L', 'U'])
    expect(new Set(semantic.resolvedValues)).toEqual(new Set(['L', 'U']))
  })

  it('presents .anum losslessly and names current semantic contract separately', () => {
    const source = quatAnumFileToMtl('10\n[]')
    expect(source).toContain('anum-stream-deserialization/v0.3')
    expect(source).toContain("'10'.")
    expect(source).toContain("'[]'.")
    expect(source).not.toContain('R⟼')
    expect(() => parseExpr("'10'")).not.toThrow()
  })

  it('visualizes source positions as transport presentation only', () => {
    const steps = visualizeQuatConversion('10')
    expect(steps.map(step => step.definition)).toEqual(['abit:1', 'abit:0'])
    expect(steps.map(step => step.formal)).toEqual(["'1'", "'10'"])
    expect(steps.every(step => step.description.includes('not semantic identity'))).toBe(true)
  })

  it('reports channel counts only', () => {
    expect(getQuatAnumStats('001[]')).toEqual({
      abitCount: 5,
      zeroCount: 2,
      oneCount: 1,
      openCount: 1,
      closeCount: 1,
    })
  })
})
