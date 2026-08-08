import { describe, expect, it } from 'vitest'

import {
  MTS_CONTRACT_VERSION,
  MTS_PROOF_SCHEMA,
  ProofObjectValidationError,
  checkProof,
  parseProofJson,
  parseProofObject,
  type MtsProofObjectV02,
} from '../../src/core/proofReplay'

function proof(steps: MtsProofObjectV02['steps']): MtsProofObjectV02 {
  return {
    schema: MTS_PROOF_SCHEMA,
    contractVersion: MTS_CONTRACT_VERSION,
    steps,
  }
}

const substitutionStep: MtsProofObjectV02['steps'][number] = {
  rule: 'interpret',
  expression: '[] = ◁',
  context: { start: 10, end: 12 },
  expected: {
    success: true,
    substitutions: [{ path: [0], link: 10 }],
    aliases: [],
  },
}

describe('mts-proof/v0.2 replay checker', () => {
  it('replays occurrence-local substitution', () => {
    expect(checkProof(proof([substitutionStep]))).toBe(true)
  })

  it('rejects forged substitution', () => {
    expect(
      checkProof(
        proof([
          {
            ...substitutionStep,
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
    const candidate = {
      schema: MTS_PROOF_SCHEMA,
      contractVersion: MTS_CONTRACT_VERSION,
      steps: [{ ...substitutionStep, rule: 'transitivity' }],
    }
    expect(checkProof(candidate as unknown as MtsProofObjectV02)).toBe(false)
  })

  it('rejects wrong contract provenance', () => {
    const candidate = {
      schema: MTS_PROOF_SCHEMA,
      contractVersion: 'mts-contract/v0.1',
      steps: [],
    }
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

describe('untrusted proof artifact validation', () => {
  it('decodes valid JSON before independent replay', () => {
    const source = JSON.stringify(proof([substitutionStep]))
    const decoded = parseProofJson(source)

    expect(decoded.schema).toBe(MTS_PROOF_SCHEMA)
    expect(decoded.contractVersion).toBe(MTS_CONTRACT_VERSION)
    expect(checkProof(decoded)).toBe(true)
  })

  it('rebuilds a clean object and drops untrusted extra fields', () => {
    const decoded = parseProofObject({
      schema: MTS_PROOF_SCHEMA,
      contractVersion: MTS_CONTRACT_VERSION,
      hiddenSemantics: 'must not survive',
      steps: [
        {
          ...substitutionStep,
          hiddenRuleData: { trusted: true },
          expected: {
            ...substitutionStep.expected,
            hiddenExpectedData: 123,
          },
        },
      ],
    })

    expect(decoded).toEqual(proof([substitutionStep]))
    expect('hiddenSemantics' in decoded).toBe(false)
    expect('hiddenRuleData' in decoded.steps[0]).toBe(false)
    expect('hiddenExpectedData' in decoded.steps[0].expected).toBe(false)
  })

  it('reports malformed JSON as a validation error', () => {
    expect(() => parseProofJson('{not-json')).toThrow(ProofObjectValidationError)
    expect(() => parseProofJson('{not-json')).toThrow(/invalid JSON/)
  })

  it('rejects the wrong proof schema', () => {
    expect(() =>
      parseProofObject({
        ...proof([]),
        schema: 'mts-proof/v0.1',
      })
    ).toThrow(/\$\.schema/)
  })

  it('rejects an untrusted inference rule at the decoder boundary', () => {
    expect(() =>
      parseProofObject({
        ...proof([]),
        steps: [{ ...substitutionStep, rule: 'modus-ponens' }],
      })
    ).toThrow(/unsupported trusted rule/)
  })

  it('validates recursive context frames', () => {
    expect(() =>
      parseProofObject({
        ...proof([]),
        steps: [
          {
            ...substitutionStep,
            context: { start: 10, end: 12, parent: { start: 'bad', end: 4 } },
          },
        ],
      })
    ).toThrow(/context\.parent\.start/)
  })

  it('requires integer LinkRefs in symbols and memory', () => {
    expect(() =>
      parseProofObject({
        ...proof([]),
        steps: [{ ...substitutionStep, symbols: { x: 1.5 } }],
      })
    ).toThrow(/integer LinkRef/)

    expect(() =>
      parseProofObject({
        ...proof([]),
        steps: [
          {
            ...substitutionStep,
            distinguishedMemory: [{ id: 30, start: 2, end: '3' }],
          },
        ],
      })
    ).toThrow(/integer LinkRef/)
  })

  it('rejects invalid occurrence paths', () => {
    expect(() =>
      parseProofObject({
        ...proof([]),
        steps: [
          {
            ...substitutionStep,
            expected: {
              success: true,
              substitutions: [{ path: [-1], link: 10 }],
              aliases: [],
            },
          },
        ],
      })
    ).toThrow(/non-negative integer path segment/)
  })
})
