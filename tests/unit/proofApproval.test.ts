import { describe, expect, it } from 'vitest'

import {
  createPortableStructuralDerivationProvenanceClaim,
  replayPortableStructuralProof,
} from '@mts/core'

import { approvePortableStructuralProof } from '../../src/core/proofApproval'

const VALID_ARTIFACT = {
  schema: 'mts-portable-structural-derivation/v0.2',
  mtsSemanticBase: 'mts-contract/v0.11',
  topology: {
    schema: 'mts-storage-topology/v0.1',
    root: 0,
    links: [
      [0, 0],
      [1, 0],
      [0, 2],
      [2, 1],
      [3, 0],
      [4, 0],
      [5, 0],
      [5, 6],
      [6, 0],
      [4, 7],
      [8, 0],
      [8, 10],
      [10, 0],
      [13, 11],
      [0, 12],
      [12, 0],
      [16, 14],
      [12, 15],
      [18, 16],
      [18, 12],
      [18, 13],
      [6, 19],
      [9, 20],
      [19, 0],
      [24, 22],
      [6, 23],
      [15, 24],
      [24, 17],
    ],
  },
  theoryCoordinate: 6,
  targetOccurrenceCoordinate: 26,
  nodes: [
    {
      occurrence: 26,
      judgment: {
        application: {
          act: 24,
          rule: 19,
          ruleAdmission: 21,
          claimedBody: 15,
          expectedInterpreter: {
            dictionary: 4,
            grammar: 5,
            theory: 6,
          },
          expectedAfterContext: 13,
        },
        judgment: {
          theory: 6,
          context: 13,
          claim: 15,
        },
      },
      derivationRule: 23,
      derivationRuleAdmission: 25,
      premiseOccurrenceSequence: 0,
    },
  ],
} as const

const SOURCE = {
  locator: 'https://github.com/leanprover-community/mathlib4',
  revision: '0123456789abcdef0123456789abcdef01234567',
  subject: 'Mathlib.Example.theorem',
} as const

const PRODUCER = {
  id: 'mts-proof-importer',
  version: '0.1.0',
} as const

const TARGET = {
  theoryCoordinate: 6,
  targetOccurrenceCoordinate: 26,
  claimCoordinate: 15,
} as const

async function provenanceFor(artifact: unknown = VALID_ARTIFACT) {
  return createPortableStructuralDerivationProvenanceClaim(artifact, SOURCE, PRODUCER)
}

describe('portable proof approval', () => {
  it('uses an exact accepted package-root portable proof as the positive fixture', () => {
    const replayed = replayPortableStructuralProof(VALID_ARTIFACT)
    expect('derivation' in replayed.replay).toBe(false)
    if (!('derivation' in replayed.replay)) {
      expect(replayed.replay.occurrenceCount).toBe(1)
    }
    expect(replayed.memory.linkCount).toBe(VALID_ARTIFACT.topology.links.length)
  })

  it('accepts a replayed proof only with matching provenance and exact selected target', async () => {
    const provenance = await provenanceFor()
    const accepted = await approvePortableStructuralProof({
      artifact: VALID_ARTIFACT,
      provenance,
      target: TARGET,
    })

    expect(accepted).toMatchObject({
      verdict: 'ACCEPT',
      semanticBase: 'mts-contract/v0.11',
      target: TARGET,
      occurrenceCount: 1,
    })
    if (accepted.verdict === 'ACCEPT') {
      expect(accepted.provenanceDigest.value).toMatch(/^[0-9a-f]{64}$/)
      const repeated = await approvePortableStructuralProof({
        artifact: VALID_ARTIFACT,
        provenance,
        target: TARGET,
      })
      expect(repeated.verdict).toBe('ACCEPT')
      if (repeated.verdict === 'ACCEPT') {
        expect(repeated.provenanceDigest).toEqual(accepted.provenanceDigest)
      }
    }
  })

  it.each([
    ['theory', { ...TARGET, theoryCoordinate: 5 }],
    ['occurrence', { ...TARGET, targetOccurrenceCoordinate: 25 }],
    ['claim', { ...TARGET, claimCoordinate: 14 }],
  ])('rejects a wrong selected %s without changing proof semantics', async (_label, target) => {
    const result = await approvePortableStructuralProof({
      artifact: VALID_ARTIFACT,
      provenance: await provenanceFor(),
      target,
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'target-mismatch' })
  })

  it('rejects a structurally forged proof even when provenance freshly matches the forgery', async () => {
    const forged = { ...VALID_ARTIFACT, theoryCoordinate: 0 }
    const result = await approvePortableStructuralProof({
      artifact: forged,
      provenance: await provenanceFor(forged),
      target: TARGET,
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'proof-rejected' })
  })

  it('rejects provenance that no longer binds the accepted artifact', async () => {
    const provenance = await provenanceFor()
    const tampered = {
      ...provenance,
      contentDigest: { ...provenance.contentDigest, value: '0'.repeat(64) },
    }
    const result = await approvePortableStructuralProof({
      artifact: VALID_ARTIFACT,
      provenance: tampered,
      target: TARGET,
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'provenance-rejected' })
  })

  it('rejects unknown provenance transport instead of inventing authority', async () => {
    const provenance = await provenanceFor()
    const result = await approvePortableStructuralProof({
      artifact: VALID_ARTIFACT,
      provenance: { ...provenance, schema: 'aprover-trusted-proof/v999' },
      target: TARGET,
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'provenance-rejected' })
  })

  it('rejects host callback vocabulary before provenance can matter', async () => {
    const hostile = { ...VALID_ARTIFACT, callback: 'host-authority' }
    const result = await approvePortableStructuralProof({
      artifact: hostile,
      provenance: await provenanceFor(hostile),
      target: TARGET,
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'proof-rejected' })
  })

  it.each([
    { ...TARGET, claimCoordinate: -1 },
    { ...TARGET, theoryCoordinate: 1.5 },
  ])('rejects malformed target coordinates before replay', async (target) => {
    const result = await approvePortableStructuralProof({
      artifact: VALID_ARTIFACT,
      provenance: await provenanceFor(),
      target,
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'invalid-request' })
  })

  it('does not let changed source metadata make an invalid proof true', async () => {
    const forged = { ...VALID_ARTIFACT, targetOccurrenceCoordinate: 0 }
    const provenance = await createPortableStructuralDerivationProvenanceClaim(
      forged,
      { ...SOURCE, subject: 'Mathlib.Example.other' },
      { ...PRODUCER, version: '0.2.0' },
    )
    const result = await approvePortableStructuralProof({
      artifact: forged,
      provenance,
      target: TARGET,
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'proof-rejected' })
  })
})
