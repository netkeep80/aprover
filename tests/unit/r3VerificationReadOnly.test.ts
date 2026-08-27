import { describe, expect, it } from 'vitest'

import {
  computePortableStructuralTheoryRevision,
  createPortableStructuralDerivationProvenanceClaim,
  exportPortableStructuralTheory,
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

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

async function immutableApprovalRequest() {
  const artifact = structuredClone(VALID_ARTIFACT)
  const provenance = await createPortableStructuralDerivationProvenanceClaim(
    artifact,
    SOURCE,
    PRODUCER,
  )
  const replayed = replayPortableStructuralProof(artifact)
  const theory =
    'theory' in replayed.evidence ? replayed.evidence.theory : replayed.evidence.derivation.theory
  const theoryArtifact = exportPortableStructuralTheory(replayed.memory, theory)
  const revision = await computePortableStructuralTheoryRevision(theoryArtifact)

  return {
    artifact,
    provenance,
    target: structuredClone(TARGET),
    expectedTheory: {
      artifact: theoryArtifact,
      revision,
    },
  }
}

describe('R3 verification read-only boundary', () => {
  it('accepts deeply frozen evidence without materializing into or mutating caller-owned state', async () => {
    const request = await immutableApprovalRequest()
    const before = structuredClone(request)
    deepFreeze(request)

    expect((await approvePortableStructuralProof(request)).verdict).toBe('ACCEPT')
    expect(request).toEqual(before)

    expect((await approvePortableStructuralProof(request)).verdict).toBe('ACCEPT')
    expect(request).toEqual(before)
  })
})
