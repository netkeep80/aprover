import { describe, expect, it } from 'vitest'

import {
  Memory,
  computePortableStructuralTheoryRevision,
  createPortableStructuralDerivationProvenanceClaim,
  createPortableStructuralDerivationWithTheoremsProvenanceClaim,
  createStructuralProofProducer,
  ensureRootBasis,
  exportPortableStructuralDerivationWithTheorems,
  exportPortableStructuralTheory,
  replayPortableStructuralProof,
  type LinkHandle,
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

async function expectedTheoryFor(artifact: unknown = VALID_ARTIFACT) {
  const replayed = replayPortableStructuralProof(artifact)
  const theory =
    'theory' in replayed.evidence ? replayed.evidence.theory : replayed.evidence.derivation.theory
  const theoryArtifact = exportPortableStructuralTheory(replayed.memory, theory)
  return Object.freeze({
    artifact: theoryArtifact,
    revision: await computePortableStructuralTheoryRevision(theoryArtifact),
  })
}

async function approvalRequest(
  artifact: unknown = VALID_ARTIFACT,
  target = TARGET,
  provenance?: unknown,
) {
  return {
    artifact,
    provenance: provenance ?? (await provenanceFor(artifact)),
    target,
    expectedTheory: await expectedTheoryFor(),
  }
}

async function theoremApprovalRequest() {
  const memory = new Memory()
  const { R, U } = ensureRootBasis(memory)
  let cursor = U
  const fresh = (): LinkHandle => (cursor = memory.ensure(cursor, R))
  const dictionary = fresh()
  const grammar = fresh()
  const theory = fresh()
  const role = fresh()
  const lemmaClaim = fresh()
  const producer = createStructuralProofProducer(memory)
  const expectedInterpreter = { dictionary, grammar, theory }
  const interpreter = producer.defineInterpreter(dictionary, grammar, theory)
  const roleDictionary = producer.defineRoleDictionary([role])

  const make = (
    body: LinkHandle,
    claim: LinkHandle,
    premiseTemplates: readonly LinkHandle[],
    premiseOccurrences: readonly LinkHandle[],
  ) => {
    const rule = producer.defineRule(roleDictionary, body)
    const context = producer.defineContext(fresh(), fresh())
    const act = producer.defineAct(interpreter, roleDictionary, context)
    producer.defineActField(act, role, lemmaClaim)
    const occurrence = producer.defineProofOccurrence(act, claim)
    const derivationRule = producer.defineDerivationRule(rule, premiseTemplates)
    return {
      occurrence,
      node: {
        occurrence,
        judgment: {
          application: {
            act,
            rule,
            ruleAdmission: producer.admitRule(theory, rule),
            claimedBody: claim,
            expectedInterpreter,
            expectedAfterContext: context,
          },
          judgment: { theory, context, claim },
        },
        derivationRule,
        derivationRuleAdmission: producer.admitDerivationRule(theory, derivationRule),
        premiseOccurrenceSequence: producer.definePremiseOccurrenceSequence(premiseOccurrences),
      },
    }
  }

  const lemma = make(role, lemmaClaim, [], [])
  const targetClaim = memory.ensure(lemmaClaim, lemmaClaim)
  const target = make(
    memory.ensure(role, role),
    targetClaim,
    [role, role],
    [lemma.occurrence, lemma.occurrence],
  )
  const artifact = exportPortableStructuralDerivationWithTheorems(memory, {
    derivation: { theory, targetOccurrence: target.occurrence, nodes: [target.node] },
    theorems: [
      {
        theorem: producer.defineTheorem(lemmaClaim, theory),
        proof: { theory, targetOccurrence: lemma.occurrence, nodes: [lemma.node] },
      },
    ],
  })
  const theoryArtifact = exportPortableStructuralTheory(memory, theory)
  const revision = await computePortableStructuralTheoryRevision(theoryArtifact)
  const provenance = await createPortableStructuralDerivationWithTheoremsProvenanceClaim(
    artifact,
    SOURCE,
    PRODUCER,
  )
  const targetNode = artifact.nodes.find(
    node => node.occurrence === artifact.targetOccurrenceCoordinate,
  )
  if (targetNode === undefined) throw new Error('theorem target node must exist')

  return {
    artifact,
    provenance,
    expectedTheory: { artifact: theoryArtifact, revision },
    target: {
      theoryCoordinate: artifact.theoryCoordinate,
      targetOccurrenceCoordinate: artifact.targetOccurrenceCoordinate,
      claimCoordinate: targetNode.judgment.judgment.claim,
    },
  }
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

  it('accepts a replayed proof only with matching expected Theory, provenance and exact target', async () => {
    const request = await approvalRequest()
    const accepted = await approvePortableStructuralProof(request)

    expect(accepted).toMatchObject({
      verdict: 'ACCEPT',
      semanticBase: 'mts-contract/v0.11',
      target: TARGET,
      occurrenceCount: 1,
    })
    if (accepted.verdict === 'ACCEPT') {
      expect(accepted.provenanceDigest.value).toMatch(/^[0-9a-f]{64}$/)
      const repeated = await approvePortableStructuralProof(request)
      expect(repeated.verdict).toBe('ACCEPT')
      if (repeated.verdict === 'ACCEPT') {
        expect(repeated.provenanceDigest).toEqual(accepted.provenanceDigest)
      }
    }
  })

  it('requires an externally selected Theory instead of trusting the proof-local coordinate', async () => {
    const result = await approvePortableStructuralProof({
      artifact: VALID_ARTIFACT,
      provenance: await provenanceFor(),
      target: TARGET,
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'invalid-request' })
  })

  it('rejects a forged expected Theory revision before application acceptance', async () => {
    const request = await approvalRequest()
    const result = await approvePortableStructuralProof({
      ...request,
      expectedTheory: {
        ...request.expectedTheory,
        revision: { ...request.expectedTheory.revision, value: '0'.repeat(64) },
      },
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'theory-rejected' })
  })

  it('rejects a different valid Theory even when its own revision is exact', async () => {
    const replayed = replayPortableStructuralProof(VALID_ARTIFACT)
    const otherTheoryArtifact = exportPortableStructuralTheory(replayed.memory, replayed.memory.root)
    const request = await approvalRequest()
    const result = await approvePortableStructuralProof({
      ...request,
      expectedTheory: {
        artifact: otherTheoryArtifact,
        revision: await computePortableStructuralTheoryRevision(otherTheoryArtifact),
      },
    })
    expect(result).toEqual({ verdict: 'REJECT', code: 'theory-rejected' })
  })

  it('reapproves theorem-reuse transport through the same trusted boundary', async () => {
    const result = await approvePortableStructuralProof(await theoremApprovalRequest())
    expect(result).toMatchObject({
      verdict: 'ACCEPT',
      semanticBase: 'mts-contract/v0.11',
    })
  })

  it.each([
    ['theory', { ...TARGET, theoryCoordinate: 5 }],
    ['occurrence', { ...TARGET, targetOccurrenceCoordinate: 25 }],
    ['claim', { ...TARGET, claimCoordinate: 14 }],
  ])('rejects a wrong selected %s without changing proof semantics', async (_label, target) => {
    const result = await approvePortableStructuralProof(
      await approvalRequest(VALID_ARTIFACT, target),
    )
    expect(result).toEqual({ verdict: 'REJECT', code: 'target-mismatch' })
  })

  it('rejects a structurally forged proof even when provenance freshly matches the forgery', async () => {
    const forged = { ...VALID_ARTIFACT, theoryCoordinate: 0 }
    const result = await approvePortableStructuralProof(
      await approvalRequest(forged, TARGET, await provenanceFor(forged)),
    )
    expect(result).toEqual({ verdict: 'REJECT', code: 'theory-rejected' })
  })

  it('rejects provenance that no longer binds the accepted artifact', async () => {
    const provenance = await provenanceFor()
    const tampered = {
      ...provenance,
      contentDigest: { ...provenance.contentDigest, value: '0'.repeat(64) },
    }
    const result = await approvePortableStructuralProof(
      await approvalRequest(VALID_ARTIFACT, TARGET, tampered),
    )
    expect(result).toEqual({ verdict: 'REJECT', code: 'provenance-rejected' })
  })

  it('rejects unknown provenance transport instead of inventing authority', async () => {
    const provenance = await provenanceFor()
    const result = await approvePortableStructuralProof(
      await approvalRequest(VALID_ARTIFACT, TARGET, {
        ...provenance,
        schema: 'aprover-trusted-proof/v999',
      }),
    )
    expect(result).toEqual({ verdict: 'REJECT', code: 'provenance-rejected' })
  })

  it('rejects host callback vocabulary before provenance can matter', async () => {
    const hostile = { ...VALID_ARTIFACT, callback: 'host-authority' }
    const result = await approvePortableStructuralProof(
      await approvalRequest(hostile, TARGET, await provenanceFor()),
    )
    expect(result).toEqual({ verdict: 'REJECT', code: 'theory-rejected' })
  })

  it.each([
    { ...TARGET, claimCoordinate: -1 },
    { ...TARGET, theoryCoordinate: 1.5 },
  ])('rejects malformed target coordinates before replay', async target => {
    const request = await approvalRequest()
    const result = await approvePortableStructuralProof({ ...request, target })
    expect(result).toEqual({ verdict: 'REJECT', code: 'invalid-request' })
  })

  it('does not let changed source metadata make an invalid proof true', async () => {
    const forged = { ...VALID_ARTIFACT, targetOccurrenceCoordinate: 0 }
    const provenance = await createPortableStructuralDerivationProvenanceClaim(
      forged,
      { ...SOURCE, subject: 'Mathlib.Example.other' },
      { ...PRODUCER, version: '0.2.0' },
    )
    const result = await approvePortableStructuralProof(
      await approvalRequest(forged, TARGET, provenance),
    )
    expect(result).toEqual({ verdict: 'REJECT', code: 'theory-rejected' })
  })
})
