import { describe, expect, it } from 'vitest'
import {
  computePortableStructuralTheoryRevision,
  createPortableStructuralDerivationProvenanceClaim,
  exportPortableStructuralTheory,
  replayPortableStructuralProof,
} from '@mts/core'

import type { PortableProofApprovalRequest } from '../../src/core/proofApproval'
import { searchPortableStructuralProof } from '../../src/core/proofSearch'

const VALID_ARTIFACT = {
  schema: 'mts-portable-structural-derivation/v0.2',
  mtsSemanticBase: 'mts-contract/v0.11',
  topology: {
    schema: 'mts-storage-topology/v0.1',
    root: 0,
    links: [
      [0, 0], [1, 0], [0, 2], [2, 1], [3, 0], [4, 0], [5, 0], [5, 6],
      [6, 0], [4, 7], [8, 0], [8, 10], [10, 0], [13, 11], [0, 12], [12, 0],
      [16, 14], [12, 15], [18, 16], [18, 12], [18, 13], [6, 19], [9, 20], [19, 0],
      [24, 22], [6, 23], [15, 24], [24, 17],
    ],
  },
  theoryCoordinate: 6,
  targetOccurrenceCoordinate: 26,
  nodes: [{
    occurrence: 26,
    judgment: {
      application: {
        act: 24,
        rule: 19,
        ruleAdmission: 21,
        claimedBody: 15,
        expectedInterpreter: { dictionary: 4, grammar: 5, theory: 6 },
        expectedAfterContext: 13,
      },
      judgment: { theory: 6, context: 13, claim: 15 },
    },
    derivationRule: 23,
    derivationRuleAdmission: 25,
    premiseOccurrenceSequence: 0,
  }],
} as const

const SOURCE = {
  locator: 'https://github.com/leanprover-community/mathlib4',
  revision: '0123456789abcdef0123456789abcdef01234567',
  subject: 'Mathlib.Example.theorem',
} as const
const PRODUCER = { id: 'mts-proof-importer', version: '0.1.0' } as const

async function validRequest(): Promise<PortableProofApprovalRequest> {
  const replayed = replayPortableStructuralProof(VALID_ARTIFACT)
  const theory = 'theory' in replayed.evidence
    ? replayed.evidence.theory
    : replayed.evidence.derivation.theory
  const theoryArtifact = exportPortableStructuralTheory(replayed.memory, theory)
  return {
    artifact: VALID_ARTIFACT,
    provenance: await createPortableStructuralDerivationProvenanceClaim(
      VALID_ARTIFACT,
      SOURCE,
      PRODUCER,
    ),
    target: {
      theoryCoordinate: 6,
      targetOccurrenceCoordinate: 26,
      claimCoordinate: 15,
    },
    expectedTheory: {
      artifact: theoryArtifact,
      revision: await computePortableStructuralTheoryRevision(theoryArtifact),
    },
  }
}

function rejectedRequest(): PortableProofApprovalRequest {
  return {
    artifact: { forged: true },
    provenance: { forged: true },
    target: { theoryCoordinate: 0, targetOccurrenceCoordinate: 0, claimCoordinate: 0 },
    expectedTheory: { artifact: { forged: true }, revision: { forged: true } },
  }
}

describe('deterministic untrusted proof search', () => {
  it('returns FOUND only after the candidate receives fresh trusted approval', async () => {
    const candidate = await validRequest()
    const result = await searchPortableStructuralProof({
      seeds: [candidate],
      expand: () => [],
      bounds: { maxCandidates: 4, maxDepth: 2 },
    })

    expect(result.status).toBe('FOUND')
    if (result.status !== 'FOUND') throw new Error('expected FOUND')
    expect(result.candidate).toBe(candidate)
    expect(result.approval.verdict).toBe('ACCEPT')
    expect(result.metrics).toMatchObject({
      strategy: 'fifo-bfs',
      exploredCandidates: 1,
      rejectedCandidates: 0,
      candidateFound: true,
    })
  })

  it('uses stable FIFO breadth-first order and expands rejected candidates only within depth bound', async () => {
    const accepted = await validRequest()
    const first = rejectedRequest()
    const second = rejectedRequest()
    const expansionOrder: number[] = []

    const result = await searchPortableStructuralProof({
      seeds: [first, second],
      expand: (_candidate, depth) => {
        expansionOrder.push(depth)
        return depth === 0 ? [accepted] : []
      },
      bounds: { maxCandidates: 8, maxDepth: 1 },
    })

    expect(result.status).toBe('FOUND')
    expect(expansionOrder).toEqual([0, 0])
    expect(result.metrics.exploredCandidates).toBe(3)
    expect(result.metrics.rejectedCandidates).toBe(2)
    expect(result.metrics.maxDepthReached).toBe(1)
  })

  it('keeps search exhaustion operational: NOT_FOUND_WITHIN_BOUNDS never means theorem false', async () => {
    const result = await searchPortableStructuralProof({
      seeds: [rejectedRequest()],
      expand: () => [],
      bounds: { maxCandidates: 3, maxDepth: 2 },
    })

    expect(result).toMatchObject({
      status: 'NOT_FOUND_WITHIN_BOUNDS',
      reason: 'exhausted',
      metrics: {
        strategy: 'fifo-bfs',
        exploredCandidates: 1,
        rejectedCandidates: 1,
        candidateFound: false,
      },
    })
    expect('verdict' in result).toBe(false)
  })

  it('fails closed on invalid bounds and stops deterministically at candidate budget', async () => {
    await expect(searchPortableStructuralProof({
      seeds: [rejectedRequest()],
      expand: () => [],
      bounds: { maxCandidates: 0, maxDepth: 1 },
    })).rejects.toThrow('maxCandidates')

    const result = await searchPortableStructuralProof({
      seeds: [rejectedRequest(), rejectedRequest()],
      expand: () => [],
      bounds: { maxCandidates: 1, maxDepth: 0 },
    })
    expect(result.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
    if (result.status !== 'NOT_FOUND_WITHIN_BOUNDS') throw new Error('expected bounded miss')
    expect(result.reason).toBe('candidate-budget')
    expect(result.metrics.exploredCandidates).toBe(1)
  })
})
