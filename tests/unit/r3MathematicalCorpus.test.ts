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
  type StructuralDerivationEvidence,
  type StructuralDerivationNodeEvidence,
} from '@mts/core'

import type { PortableProofApprovalRequest } from '../../src/core/proofApproval'
import { searchPortableStructuralProof } from '../../src/core/proofSearch'

const SOURCE = {
  locator: 'github:netkeep80/aprover',
  revision: 'r3-c4-c6-mathematical-corpus',
  subject: '#157',
} as const
const PRODUCER = { id: 'aprover-r3-mathematical-corpus', version: '0.1.0' } as const

interface StructuralFixture {
  readonly memory: Memory
  readonly theory: LinkHandle
  readonly role: LinkHandle
  readonly producer: ReturnType<typeof createStructuralProofProducer>
  readonly interpreter: LinkHandle
  readonly dictionary: LinkHandle
  readonly grammar: LinkHandle
  readonly roleDictionary: LinkHandle
  readonly fresh: () => LinkHandle
}

function fixture(): StructuralFixture {
  const memory = new Memory()
  const { R, U } = ensureRootBasis(memory)
  let cursor = U
  const fresh = (): LinkHandle => (cursor = memory.ensure(cursor, R))
  const dictionary = fresh()
  const grammar = fresh()
  const theory = fresh()
  const role = fresh()
  const producer = createStructuralProofProducer(memory)
  const interpreter = producer.defineInterpreter(dictionary, grammar, theory)
  const roleDictionary = producer.defineRoleDictionary([role])
  return { memory, theory, role, producer, interpreter, dictionary, grammar, roleDictionary, fresh }
}

function node(
  fx: StructuralFixture,
  claim: LinkHandle,
  premiseOccurrences: readonly LinkHandle[],
): StructuralDerivationNodeEvidence {
  const context = fx.producer.defineContext(fx.fresh(), fx.fresh())
  const rule = fx.producer.defineRule(fx.roleDictionary, fx.role)
  const act = fx.producer.defineAct(fx.interpreter, fx.roleDictionary, context)
  fx.producer.defineActField(act, fx.role, claim)
  const occurrence = fx.producer.defineProofOccurrence(act, claim)
  const derivationRule = fx.producer.defineDerivationRule(
    rule,
    premiseOccurrences.map(premise => fx.memory.poles(premise).start),
  )
  return {
    occurrence,
    judgment: {
      application: {
        act,
        rule,
        ruleAdmission: fx.producer.admitRule(fx.theory, rule),
        claimedBody: claim,
        expectedInterpreter: {
          dictionary: fx.dictionary,
          grammar: fx.grammar,
          theory: fx.theory,
        },
        expectedAfterContext: context,
      },
      judgment: { theory: fx.theory, context, claim },
    },
    derivationRule,
    derivationRuleAdmission: fx.producer.admitDerivationRule(fx.theory, derivationRule),
    premiseOccurrenceSequence: fx.producer.definePremiseOccurrenceSequence(premiseOccurrences),
  }
}

async function request(
  fx: StructuralFixture,
  evidence: StructuralDerivationEvidence,
): Promise<PortableProofApprovalRequest> {
  const artifact = exportPortableStructuralDerivation(fx.memory, evidence)
  const target = artifact.nodes.find(
    candidate => candidate.occurrence === artifact.targetOccurrenceCoordinate,
  )
  if (target === undefined) throw new Error('target occurrence missing from portable artifact')
  const theoryArtifact = exportPortableStructuralTheory(fx.memory, fx.theory)
  return {
    artifact,
    provenance: await createPortableStructuralDerivationProvenanceClaim(artifact, SOURCE, PRODUCER),
    target: {
      theoryCoordinate: artifact.theoryCoordinate,
      targetOccurrenceCoordinate: artifact.targetOccurrenceCoordinate,
      claimCoordinate: target.judgment.judgment.claim,
    },
    expectedTheory: {
      artifact: theoryArtifact,
      revision: await computePortableStructuralTheoryRevision(theoryArtifact),
    },
  }
}

async function certify(candidate: PortableProofApprovalRequest) {
  return searchPortableStructuralProof({
    seeds: [candidate],
    expand: () => [],
    bounds: { maxCandidates: 1, maxDepth: 0 },
  })
}

describe('R3.5 C4-C6 mathematical certification corpus', () => {
  it('C4 certifies a finite-function application only with its explicit graph premise', async () => {
    const fx = fixture()
    const input = fx.fresh()
    const output = fx.fresh()
    const finiteFunctionGraph = fx.memory.ensure(input, output)
    const applicationClaim = fx.memory.ensure(finiteFunctionGraph, input)

    const graphEvidence = node(fx, finiteFunctionGraph, [])
    const application = node(fx, applicationClaim, [graphEvidence.occurrence])
    const candidate = await request(fx, {
      theory: fx.theory,
      targetOccurrence: application.occurrence,
      nodes: [graphEvidence, application],
    })

    const accepted = await certify(candidate)
    expect(accepted.status).toBe('FOUND')
    if (accepted.status !== 'FOUND') throw new Error('C4 finite function must be accepted')
    expect(accepted.approval.occurrenceCount).toBe(2)

    const missingGraph = structuredClone(candidate) as any
    missingGraph.artifact.nodes = missingGraph.artifact.nodes.slice(1)
    const rejected = await certify(missingGraph)
    expect(rejected.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })

  it('C5 keeps bounded search failure distinct from a closed negative theorem', async () => {
    const boundedMiss = await searchPortableStructuralProof({
      seeds: [],
      expand: () => [],
      bounds: { maxCandidates: 1, maxDepth: 0 },
    })
    expect(boundedMiss.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
    if (boundedMiss.status !== 'NOT_FOUND_WITHIN_BOUNDS') throw new Error('empty search must miss')
    expect(boundedMiss.reason).toBe('exhausted')
    expect(boundedMiss.metrics.candidateFound).toBe(false)

    const fx = fixture()
    const memberA = fx.fresh()
    const memberB = fx.fresh()
    const queried = fx.fresh()
    const finiteCollection = fx.memory.ensure(memberA, memberB)
    const closedBoundary = fx.memory.ensure(finiteCollection, finiteCollection)
    const negativeClaim = fx.memory.ensure(queried, closedBoundary)

    const collectionEvidence = node(fx, finiteCollection, [])
    const closureEvidence = node(fx, closedBoundary, [collectionEvidence.occurrence])
    const negative = node(fx, negativeClaim, [
      collectionEvidence.occurrence,
      closureEvidence.occurrence,
    ])
    const candidate = await request(fx, {
      theory: fx.theory,
      targetOccurrence: negative.occurrence,
      nodes: [collectionEvidence, closureEvidence, negative],
    })

    const accepted = await certify(candidate)
    expect(accepted.status).toBe('FOUND')
    if (accepted.status !== 'FOUND') throw new Error('explicit closed negative evidence must be accepted')
    expect(accepted.approval.occurrenceCount).toBe(3)

    const withoutClosure = structuredClone(candidate) as any
    withoutClosure.artifact.nodes.splice(1, 1)
    const rejected = await certify(withoutClosure)
    expect(rejected.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })

  it('C6 certifies the finite count theorem 1 + 1 -> 2 through two explicit premises', async () => {
    const fx = fixture()
    const zero = fx.fresh()
    const one = fx.memory.ensure(zero, zero)
    const two = fx.memory.ensure(one, one)

    const leftOne = node(fx, one, [])
    const rightOne = node(fx, one, [])
    const sum = node(fx, two, [leftOne.occurrence, rightOne.occurrence])
    const candidate = await request(fx, {
      theory: fx.theory,
      targetOccurrence: sum.occurrence,
      nodes: [leftOne, rightOne, sum],
    })

    const accepted = await certify(candidate)
    expect(accepted.status).toBe('FOUND')
    if (accepted.status !== 'FOUND') throw new Error('C6 1 + 1 -> 2 must be accepted')
    expect(accepted.approval.occurrenceCount).toBe(3)

    const onePremiseOnly = structuredClone(candidate) as any
    onePremiseOnly.artifact.nodes.splice(1, 1)
    const rejected = await certify(onePremiseOnly)
    expect(rejected.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })
})
