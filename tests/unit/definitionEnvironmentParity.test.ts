import { describe, expect, it } from 'vitest'

import {
  DefinitionEnvironment,
  definitionTargetKey,
  openDefinition,
  parseDefinition,
  parseDefinitionTarget,
} from '../../src/core/definitionEnvironment'

describe('DefinitionEnvironment upstream structural-key parity', () => {
  it('keeps quote delimiters as part of Symbol spelling', () => {
    const abit = parseDefinitionTarget("'01'")
    const string = parseDefinitionTarget('"01"')

    expect(definitionTargetKey(abit)).toBe(JSON.stringify(['symbol', "'01'"]))
    expect(definitionTargetKey(string)).toBe(JSON.stringify(['symbol', '"01"']))
    expect(definitionTargetKey(abit)).not.toBe(definitionTargetKey(string))
  })

  it('does not cross-match distinct quoted spellings', () => {
    const environment = new DefinitionEnvironment()
    expect(environment.register(parseDefinition("'01' : a")).kind).toBe('registered')
    expect(environment.register(parseDefinition('"01" : b')).kind).toBe('registered')

    const abit = openDefinition(parseDefinitionTarget("'01'"), environment)
    const string = openDefinition(parseDefinitionTarget('"01"'), environment)

    expect(abit.kind).toBe('match')
    expect(string.kind).toBe('match')
    expect(abit.definitionId).toEqual({ scopePath: [], ordinal: 0 })
    expect(string.definitionId).toEqual({ scopePath: [], ordinal: 1 })
  })
})
