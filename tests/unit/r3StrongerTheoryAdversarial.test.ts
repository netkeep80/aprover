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
  revision: 'r3-stronger-theory-adversarial',
  subject: '#157',
} as const
const PRODUCER = { id: 'aprover-r3-stronger-theory', version: '0.1.0' } as const

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

function admittedNode(fx: Fixture): StructuralDerivationNodeEvidence {
  const context = fx.producer.defineContext(fx.fresh(), fx.fresh())
  const rule = fx.producer.defineRule(fx.roleDictionary, fx.role)
  const act = fx.producer.defineAct(fx.interpreter, fx.roleDictionary, context)
  fx.producer.defineActField(act, fx.role, fx.claim)
  const occurrence = fx.producer.defineProofOccurrence(act, fx.claim)
  const derivationRule = fx.producer.defineDerivationRule(rule, [])
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
    premiseOccurrenceSequence: fx.producer.definePremiseOccurrenceSequence([]),
  }
}

async function proofValidOnlyUnderStrongerTheory(): Promise<PortableProofApprovalRequest> {
  const fx = fixture()

  // Freeze the externally selected Theory before the proof-only admissions exist.
  const selectedTheoryArtifact = exportPortableStructuralTheory(fx.memory, fx.theory)
  const selectedTheoryRevision = await computePortableStructuralTheoryRevision(selectedTheoryArtifact)

  // T' is strictly stronger: the proof below becomes valid only after these admissions.
  const target = admittedNode(fx)
  const artifact = exportPortableStructuralDerivation(fx.memory, {
    theory: fx.theory,
    targetOccurrence: target.occurrence,
    nodes: [target],
  })
  const targetNode = artifact.nodes.find(
    candidate => candidate.occurrence === artifact.targetOccurrenceCoordinate,
  )
  if (targetNode === undefined) throw new Error('target occurrence missing')

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
      artifact: selectedTheoryArtifact,
      revision: selectedTheoryRevision,
    },
  }
}

describe('R3 stronger-Theory adversarial boundary', () => {
  it("does not accept a proof valid only under stronger T' for the externally selected T", async () => {
    const result = await searchPortableStructuralProof({
      seeds: [await proofValidOnlyUnderStrongerTheory()],
      expand: () => [],
      bounds: { maxCandidates: 1, maxDepth: 0 },
    })

    expect(result.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
    if (result.status === 'NOT_FOUND_WITHIN_BOUNDS') {
      expect(result.metrics.candidateFound).toBe(false)
    }
  })
})
