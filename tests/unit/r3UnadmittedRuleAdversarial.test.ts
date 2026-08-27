import { describe, expect, it } from 'vitest'
import {
  Memory,
  computePortableStructuralTheoryRevision,
  createPortableStructuralDerivationProvenanceClaim,
  createStructuralProofProducer,
  ensureRootBasis,
  exportPortableStructuralDerivation,
  exportPortableStructuralTheory,
  type LinkHandle,
  type StructuralDerivationNodeEvidence,
} from '@mts/core'

import type { PortableProofApprovalRequest } from '../../src/core/proofApproval'
import { searchPortableStructuralProof } from '../../src/core/proofSearch'

const SOURCE = {
  locator: 'github:netkeep80/aprover',
  revision: 'r3-unadmitted-rule-adversarial',
  subject: '#157',
} as const
const PRODUCER = { id: 'aprover-r3-unadmitted-rule-adversarial', version: '0.1.0' } as const

type Mode = 'valid' | 'unadmitted-rule' | 'unadmitted-derivation-rule'

async function candidate(mode: Mode): Promise<PortableProofApprovalRequest> {
  const memory = new Memory()
  const { R, U } = ensureRootBasis(memory)
  let cursor = U
  const fresh = (): LinkHandle => (cursor = memory.ensure(cursor, R))

  const dictionary = fresh()
  const grammar = fresh()
  const theory = fresh()
  const role = fresh()
  const claim = fresh()
  const producer = createStructuralProofProducer(memory)
  const interpreter = producer.defineInterpreter(dictionary, grammar, theory)
  const roleDictionary = producer.defineRoleDictionary([role])
  const context = producer.defineContext(fresh(), fresh())

  const rule = producer.defineRule(roleDictionary, role)
  const ruleAdmission =
    mode === 'unadmitted-rule' ? fresh() : producer.admitRule(theory, rule)

  const act = producer.defineAct(interpreter, roleDictionary, context)
  producer.defineActField(act, role, claim)
  const occurrence = producer.defineProofOccurrence(act, claim)

  const derivationRule = producer.defineDerivationRule(rule, [])
  const derivationRuleAdmission =
    mode === 'unadmitted-derivation-rule'
      ? fresh()
      : producer.admitDerivationRule(theory, derivationRule)

  const node: StructuralDerivationNodeEvidence = {
    occurrence,
    judgment: {
      application: {
        act,
        rule,
        ruleAdmission,
        claimedBody: claim,
        expectedInterpreter: { dictionary, grammar, theory },
        expectedAfterContext: context,
      },
      judgment: { theory, context, claim },
    },
    derivationRule,
    derivationRuleAdmission,
    premiseOccurrenceSequence: producer.definePremiseOccurrenceSequence([]),
  }

  const artifact = exportPortableStructuralDerivation(memory, {
    theory,
    targetOccurrence: occurrence,
    nodes: [node],
  })
  const theoryArtifact = exportPortableStructuralTheory(memory, theory)
  return {
    artifact,
    provenance: await createPortableStructuralDerivationProvenanceClaim(
      artifact,
      SOURCE,
      PRODUCER,
    ),
    target: {
      theoryCoordinate: artifact.theoryCoordinate,
      targetOccurrenceCoordinate: artifact.targetOccurrenceCoordinate,
      claimCoordinate: artifact.nodes[0].judgment.judgment.claim,
    },
    expectedTheory: {
      artifact: theoryArtifact,
      revision: await computePortableStructuralTheoryRevision(theoryArtifact),
    },
  }
}

async function certify(request: PortableProofApprovalRequest) {
  return searchPortableStructuralProof({
    seeds: [request],
    expand: () => [],
    bounds: { maxCandidates: 1, maxDepth: 0 },
  })
}

describe('R3 unadmitted Rule / DerivationRule adversarial certification', () => {
  it('accepts the structurally identical admitted control', async () => {
    expect((await certify(await candidate('valid'))).status).toBe('FOUND')
  })

  it.each([
    ['Rule', 'unadmitted-rule'],
    ['DerivationRule', 'unadmitted-derivation-rule'],
  ] as const)('rejects a valid but unadmitted %s', async (_name, mode) => {
    const result = await certify(await candidate(mode))
    expect(result.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
    if (result.status === 'NOT_FOUND_WITHIN_BOUNDS') {
      expect(result.metrics.candidateFound).toBe(false)
    }
  })
})
