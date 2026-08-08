import { describe, expect, it } from 'vitest'

import {
  MTS_CONTRACT_VERSION,
  MTS_PROOF_SCHEMA,
  checkProof,
  type MtsProofObjectV02,
} from '../../src/core/proofReplay'

function proof(steps: MtsProofObjectV02['steps']): MtsProofObjectV02 {
  return {
    schema: MTS_PROOF_SCHEMA,
    contractVersion: MTS_CONTRACT_VERSION,
    steps,
  }
}

describe('mts-proof/v0.2 replay checker', () => {
  it('replays occurrence-local substitution', () => {
    expect(
      checkProof(
        proof([
          {
            rule: 'interpret',
            expression: '[] = ◁',
            context: { start: 10, end: 12 },
            expected: {
              success: true,
              substitutions: [{ path: [0], link: 10 }],
              aliases: [],
            },
          },
        ])
      )
    ).toBe(true)
  })

  it('rejects forged substitution', () => {
    expect(
      checkProof(
        proof([
          {
            rule: 'interpret',
            expression: '[] = ◁',
            context: { start: 10, end: 12 },
            expected: {
              success: true,
              substitutions: [{ path: [0], link: 12 }],
              aliases: [],
            },
          },
        ])
      )
    ).toBe(false)
  })

  it('replays structural link decomposition through immutable distinguished memory', () => {
    expect(
      checkProof(
        proof([
          {
            rule: 'interpret',
            expression: '30 = [] ⟼ []',
            context: { start: 10, end: 10 },
            symbols: { '30': 30 },
            distinguishedMemory: [{ id: 30, start: 2, end: 3 }],
            expected: {
              success: true,
              substitutions: [
                { path: [1, 0], link: 2 },
                { path: [1, 1], link: 3 },
              ],
              aliases: [],
            },
          },
        ])
      )
    ).toBe(true)
  })

  it('rejects unknown rules instead of extending trust', () => {
    const candidate = proof([
      {
        rule: 'interpret',
        expression: '[] = ◁',
        context: { start: 10, end: 12 },
        expected: {
          success: true,
          substitutions: [{ path: [0], link: 10 }],
          aliases: [],
        },
      },
    ]) as unknown as { schema: string; contractVersion: string; steps: Array<Record<string, unknown>> }

    candidate.steps[0].rule = 'transitivity'
    expect(checkProof(candidate as unknown as MtsProofObjectV02)).toBe(false)
  })

  it('rejects wrong contract provenance', () => {
    const candidate = proof([]) as unknown as { schema: string; contractVersion: string; steps: [] }
    candidate.contractVersion = 'mts-contract/v0.1'
    expect(checkProof(candidate as unknown as MtsProofObjectV02)).toBe(false)
  })

  it('does not realize a missing distinguished link', () => {
    expect(
      checkProof(
        proof([
          {
            rule: 'interpret',
            expression: '30 = 2 ⟼ 3',
            context: { start: 10, end: 10 },
            symbols: { '30': 30, '2': 2, '3': 3 },
            distinguishedMemory: [],
            expected: { success: true, substitutions: [], aliases: [] },
          },
        ])
      )
    ).toBe(false)
  })
})
