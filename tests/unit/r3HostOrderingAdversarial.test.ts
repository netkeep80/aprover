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
  revision: 'r3-host-ordering-adversarial',
  subject: '#157',
} as const
const PRODUCER = { id: 'aprover-r3-host-ordering-adversarial', version: '0.1.0' } as const

function candidateFixture(): {
  memory: Memory
  theory: LinkHandle
  nodes: StructuralDerivationNodeEvidence[]
  targetOccurrence: LinkHandle
} {
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

  const defineNode = (premises: readonly LinkHandle[]): StructuralDerivationNodeEvidence => {
    const context = producer.defineContext(fresh(), fresh())
    const rule = producer.defineRule(roleDictionary, role)
    const act = producer.defineAct(interpreter, roleDictionary, context)
    producer.defineActField(act, role, claim)
    const occurrence = producer.defineProofOccurrence(act, claim)
    const derivationRule = producer.defineDerivationRule(rule, premises.map(() => role))
    return {
      occurrence,
      judgment: {
        application: {
          act,
          rule,
          ruleAdmission: producer.admitRule(theory, rule),
          claimedBody: claim,
          expectedInterpreter: { dictionary, grammar, theory },
          expectedAfterContext: context,
        },
        judgment: { theory, context, claim },
      },
      derivationRule,
      derivationRuleAdmission: producer.admitDerivationRule(theory, derivationRule),
      premiseOccurrenceSequence: producer.definePremiseOccurrenceSequence(premises),
    }
  }

  const premise = defineNode([])
  const target = defineNode([premise.occurrence])
  return { memory, theory, nodes: [premise, target], targetOccurrence: target.occurrence }
}

async function validRequest(): Promise<PortableProofApprovalRequest> {
  const fx = candidateFixture()
  const artifact = exportPortableStructuralDerivation(fx.memory, {
    theory: fx.theory,
    targetOccurrence: fx.targetOccurrence,
    nodes: fx.nodes,
  })
  const targetNode = artifact.nodes.find(node => node.occurrence === artifact.targetOccurrenceCoordinate)
  if (targetNode === undefined) throw new Error('target occurrence missing')
  const theoryArtifact = exportPortableStructuralTheory(fx.memory, fx.theory)
  return {
    artifact,
    provenance: await createPortableStructuralDerivationProvenanceClaim(artifact, SOURCE, PRODUCER),
    target: {
      theoryCoordinate: artifact.theoryCoordinate,
      targetOccurrenceCoordinate: artifact.targetOccurrenceCoordinate,
      claimCoordinate: targetNode.judgment.judgment.claim,
    },
    expectedTheory: {
      artifact: theoryArtifact,
      revision: await computePortableStructuralTheoryRevision(theoryArtifact),
    },
  }
}

async function search(candidate: PortableProofApprovalRequest) {
  return searchPortableStructuralProof({
    seeds: [candidate],
    expand: () => [],
    bounds: { maxCandidates: 1, maxDepth: 0 },
  })
}

describe('R3 accidental host ordering is not proof authority', () => {
  it('rejects a host-reordered derivation even with fresh provenance', async () => {
    const baseline = await validRequest()
    expect((await search(baseline)).status).toBe('FOUND')

    const reordered = structuredClone(baseline) as PortableProofApprovalRequest & {
      artifact: { nodes: unknown[] }
    }
    reordered.artifact.nodes = [...reordered.artifact.nodes].reverse()
    const candidate: PortableProofApprovalRequest = {
      ...reordered,
      provenance: await createPortableStructuralDerivationProvenanceClaim(
        reordered.artifact,
        SOURCE,
        PRODUCER,
      ),
    }

    const result = await search(candidate)
    expect(result.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
    if (result.status === 'NOT_FOUND_WITHIN_BOUNDS') {
      expect(result.metrics.candidateFound).toBe(false)
    }
  })
})
