import { describe, expect, it } from 'vitest'

import { searchInterpretProof } from '../../src/core/proofSearch'
import {
  MTS_PROOF_CONTRACT_VERSION_V04,
  MTS_PROOF_SCHEMA_V04,
  checkProofV04,
  type MtsProofObjectV04,
} from '../../src/core/proofReplayV04'

describe('untrusted current-format interpret proof search', () => {
  it('constructs a canonical ContextuallySatisfies witness accepted by independent replay', () => {
    const result = searchInterpretProof({
      expression: '  []=◁  ',
      context: { start: 10, end: 12 },
    })

    expect(result.status).toBe('proven')
    if (result.status !== 'proven') throw new Error('expected a proof witness')

    expect(result.proof.proofVersion).toBe(MTS_PROOF_SCHEMA_V04)
    expect(result.proof.contractVersion).toBe(MTS_PROOF_CONTRACT_VERSION_V04)
    expect(result.proof.judgments).toHaveLength(1)
    const judgment = result.proof.judgments[0]
    expect(judgment.relation).toBe('ContextuallySatisfies')
    if (judgment.relation !== 'ContextuallySatisfies') throw new Error('expected contextual judgment')
    expect(judgment.expression).toBe('[] = ◁')
    expect(judgment.expected).toEqual({
      substitutions: [{ path: [0], link: 10 }],
      aliases: [],
    })
    expect(checkProofV04(result.proof)).toBe(true)
  })

  it('returns not-proven for a failed match instead of manufacturing a proof', () => {
    const result = searchInterpretProof({
      expression: '◁ = ▷',
      context: { start: 10, end: 12 },
    })

    expect(result).toEqual({ status: 'not-proven', reason: 'not-matched' })
  })

  it('separates parse errors from interpretation errors', () => {
    const parseFailure = searchInterpretProof({
      expression: '↑ = []',
      context: { start: 10, end: 12 },
    })
    expect(parseFailure.status).toBe('error')
    if (parseFailure.status !== 'error') throw new Error('expected parse error')
    expect(parseFailure.stage).toBe('parse')

    const interpretationFailure = searchInterpretProof({
      expression: 'x = ◁',
      context: { start: 10, end: 12 },
    })
    expect(interpretationFailure.status).toBe('error')
    if (interpretationFailure.status !== 'error') throw new Error('expected interpretation error')
    expect(interpretationFailure.stage).toBe('interpret')
    expect(interpretationFailure.message).toContain('not bound')
  })

  it('captures structural decomposition in a replayable current proof object', () => {
    const result = searchInterpretProof({
      expression: '30 = [] ⟼ []',
      context: { start: 10, end: 12 },
      symbols: { '30': 30 },
      distinguishedMemory: [{ id: 30, start: 2, end: 3 }],
    })

    expect(result.status).toBe('proven')
    if (result.status !== 'proven') throw new Error('expected structural proof')
    const judgment = result.proof.judgments[0]
    expect(judgment.relation).toBe('ContextuallySatisfies')
    if (judgment.relation !== 'ContextuallySatisfies') throw new Error('expected contextual judgment')
    expect(judgment.expected.substitutions).toEqual([
      { path: [1, 0], link: 2 },
      { path: [1, 1], link: 3 },
    ])
    expect(checkProofV04(result.proof)).toBe(true)
  })

  it('snapshots caller-owned context, symbols and distinguished memory', () => {
    const context = { start: 10, end: 12, parent: { start: 20, end: 22 } }
    const symbols = { x: 30 }
    const distinguishedMemory = [{ id: 30, start: 2, end: 3 }]

    const result = searchInterpretProof({
      expression: '[] = x',
      context,
      symbols,
      distinguishedMemory,
    })
    expect(result.status).toBe('proven')
    if (result.status !== 'proven') throw new Error('expected proof')

    context.start = 999
    context.parent.start = 999
    symbols.x = 999
    distinguishedMemory[0].start = 999

    const judgment = result.proof.judgments[0]
    expect(judgment.relation).toBe('ContextuallySatisfies')
    if (judgment.relation !== 'ContextuallySatisfies') throw new Error('expected contextual judgment')
    expect(judgment.context).toEqual({ start: 10, end: 12, parent: { start: 20, end: 22 } })
    expect(judgment.symbols).toEqual([['x', 30]])
    expect(judgment.memory).toEqual([{ id: 30, start: 2, end: 3 }])
    expect(checkProofV04(result.proof)).toBe(true)
  })

  it('does not make search output trusted: a forged copy is rejected by replay', () => {
    const result = searchInterpretProof({
      expression: '[] = ◁',
      context: { start: 10, end: 12 },
    })
    expect(result.status).toBe('proven')
    if (result.status !== 'proven') throw new Error('expected proof')

    const forged = JSON.parse(JSON.stringify(result.proof)) as MtsProofObjectV04
    const judgment = forged.judgments[0]
    if (judgment.relation !== 'ContextuallySatisfies') throw new Error('expected contextual judgment')
    ;(judgment.expected.substitutions[0] as { path: number[]; link: number }).link = 12

    expect(checkProofV04(forged)).toBe(false)
  })
})
