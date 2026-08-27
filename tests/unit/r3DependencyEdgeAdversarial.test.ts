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
  revision: 'r3-dependency-edge-adversarial',
  subject: '#157',
} as const
const PRODUCER = { id: 'aprover-r3-dependency-edge-adversarial', version: '0.1.0' } as const

interface Fixture {
  readonly memory: Memory
  readonly theory: LinkHandle
  readonly producer: ReturnType<typeof createStructuralProofProducer>
  readonly interpreter: LinkHandle
  readonly dictionary: LinkHandle
  readonly grammar: LinkHandle
  readonly role: LinkHandle
  readonly roleDictionary: LinkHandle
  readonly claim: LinkHandle
  readonly fresh: () => LinkHandle
}

function fixture(): Fixture {
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
  return {
    memory,
    theory,
    producer,
    interpreter,
    dictionary,
    grammar,
    role,
    roleDictionary,
    claim,
    fresh,
  }
}

function node(
  fx: Fixture,
  premiseOccurrences: readonly LinkHandle[],
): StructuralDerivationNodeEvidence {
  const context = fx.producer.defineContext(fx.fresh(), fx.fresh())
  const rule = fx.producer.defineRule(fx.roleDictionary, fx.role)
  const act = fx.producer.defineAct(fx.interpreter, fx.roleDictionary, context)
  fx.producer.defineActField(act, fx.role, fx.claim)
  const occurrence = fx.producer.defineProofOccurrence(act, fx.claim)
  const derivationRule = fx.producer.defineDerivationRule(
    rule,
    premiseOccurrences.map(() => fx.role),
  )
  return {
    occurrence,
    judgment: {
      application: {
        act,
        rule,
        ruleAdmission: fx.producer.admitRule(fx.theory, rule),
        claimedBody: fx.claim,
        expectedInterpreter: {
          dictionary: fx.dictionary,
          grammar: fx.grammar,
          theory: fx.theory,
        },
        expectedAfterContext: context,
      },
      judgment: { theory: fx.theory, context, claim: fx.claim },
    },
    derivationRule,
    derivationRuleAdmission: fx.producer.admitDerivationRule(fx.theory, derivationRule),
    premiseOccurrenceSequence: fx.producer.definePremiseOccurrenceSequence(premiseOccurrences),
  }
}

async function request(): Promise<PortableProofApprovalRequest> {
  const fx = fixture()
  const shared = node(fx, [])
  const left = node(fx, [shared.occurrence])
  const right = node(fx, [shared.occurrence])
  const target = node(fx, [left.occurrence, right.occurrence])
  const artifact = exportPortableStructuralDerivation(fx.memory, {
    theory: fx.theory,
    targetOccurrence: target.occurrence,
    nodes: [shared, left, right, target],
  })
  const targetNode = artifact.nodes.find(
    candidate => candidate.occurrence === artifact.targetOccurrenceCoordinate,
  )
  if (targetNode === undefined) throw new Error('target occurrence missing')
  const theoryArtifact = exportPortableStructuralTheory(fx.memory, fx.theory)
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

describe('R3 swapped dependency-edge adversarial certification', () => {
  it('rejects a target whose dependency sequence is swapped for another valid in-artifact sequence', async () => {
    const baseline = await request()
    expect((await search(baseline)).status).toBe('FOUND')

    const mutated = structuredClone(baseline) as any
    mutated.artifact.nodes[3].premiseOccurrenceSequence =
      mutated.artifact.nodes[1].premiseOccurrenceSequence
    mutated.provenance = await createPortableStructuralDerivationProvenanceClaim(
      mutated.artifact,
      SOURCE,
      PRODUCER,
    )

    const result = await search(mutated)
    expect(result.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
    if (result.status === 'NOT_FOUND_WITHIN_BOUNDS') {
      expect(result.metrics.candidateFound).toBe(false)
    }
  })
})
