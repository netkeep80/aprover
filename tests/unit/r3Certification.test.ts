import { describe, expect, it } from 'vitest'
import {
  Memory,
  computePortableStructuralTheoryRevision,
  createPortableStructuralDerivationProvenanceClaim,
  createPortableStructuralDerivationWithTheoremsProvenanceClaim,
  createStructuralProofProducer,
  ensureRootBasis,
  exportPortableStructuralDerivation,
  exportPortableStructuralDerivationWithTheorems,
  exportPortableStructuralTheory,
  replayPortableStructuralProof,
  type LinkHandle,
  type StructuralDerivationEvidence,
  type StructuralDerivationNodeEvidence,
} from '@mts/core'

import type { PortableProofApprovalRequest } from '../../src/core/proofApproval'
import { searchPortableStructuralProof } from '../../src/core/proofSearch'
import { createTheoremRecord } from '../../src/core/theoremLibrary'
import { InMemoryTheoremRepository } from '../../src/core/theoremRepository'

const SOURCE = {
  locator: 'github:netkeep80/aprover',
  revision: 'r3-c1-c3-certification',
  subject: '#157',
} as const
const PRODUCER = { id: 'aprover-r3-certification', version: '0.1.0' } as const

interface StructuralFixture {
  readonly memory: Memory
  readonly theory: LinkHandle
  readonly role: LinkHandle
  readonly claim: LinkHandle
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
  const claim = fresh()
  const producer = createStructuralProofProducer(memory)
  const interpreter = producer.defineInterpreter(dictionary, grammar, theory)
  const roleDictionary = producer.defineRoleDictionary([role])
  return { memory, theory, role, claim, producer, interpreter, dictionary, grammar, roleDictionary, fresh }
}

function node(
  fx: StructuralFixture,
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

async function expectedTheory(memory: Memory, theory: LinkHandle) {
  const artifact = exportPortableStructuralTheory(memory, theory)
  return {
    artifact,
    revision: await computePortableStructuralTheoryRevision(artifact),
  }
}

async function plainRequest(
  memory: Memory,
  theory: LinkHandle,
  evidence: StructuralDerivationEvidence,
): Promise<PortableProofApprovalRequest> {
  const artifact = exportPortableStructuralDerivation(memory, evidence)
  const target = artifact.nodes.find(
    candidate => candidate.occurrence === artifact.targetOccurrenceCoordinate,
  )
  if (target === undefined) throw new Error('target occurrence missing from portable artifact')
  return {
    artifact,
    provenance: await createPortableStructuralDerivationProvenanceClaim(artifact, SOURCE, PRODUCER),
    target: {
      theoryCoordinate: artifact.theoryCoordinate,
      targetOccurrenceCoordinate: artifact.targetOccurrenceCoordinate,
      claimCoordinate: target.judgment.judgment.claim,
    },
    expectedTheory: await expectedTheory(memory, theory),
  }
}

describe('R3.4 C1-C3 structural certification corpus', () => {
  it('C1 accepts a three-step derivation only with its explicit dependency closure', async () => {
    const fx = fixture()
    const first = node(fx, [])
    const second = node(fx, [first.occurrence])
    const target = node(fx, [second.occurrence])
    const request = await plainRequest(fx.memory, fx.theory, {
      theory: fx.theory,
      targetOccurrence: target.occurrence,
      nodes: [first, second, target],
    })

    const result = await searchPortableStructuralProof({
      seeds: [request],
      expand: () => [],
      bounds: { maxCandidates: 1, maxDepth: 0 },
    })

    expect(result.status).toBe('FOUND')
    if (result.status !== 'FOUND') throw new Error('C1 must be accepted')
    expect(result.approval.occurrenceCount).toBe(3)

    const incomplete = structuredClone(request) as any
    incomplete.artifact.nodes = incomplete.artifact.nodes.slice(1)
    const rejected = await searchPortableStructuralProof({
      seeds: [incomplete],
      expand: () => [],
      bounds: { maxCandidates: 1, maxDepth: 0 },
    })
    expect(rejected.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })

  it('C2 accepts branching with one shared dependency and rejects a missing branch', async () => {
    const fx = fixture()
    const shared = node(fx, [])
    const left = node(fx, [shared.occurrence])
    const right = node(fx, [shared.occurrence])
    const target = node(fx, [left.occurrence, right.occurrence])
    const request = await plainRequest(fx.memory, fx.theory, {
      theory: fx.theory,
      targetOccurrence: target.occurrence,
      nodes: [shared, left, right, target],
    })

    const result = await searchPortableStructuralProof({
      seeds: [request],
      expand: () => [],
      bounds: { maxCandidates: 1, maxDepth: 0 },
    })
    expect(result.status).toBe('FOUND')
    if (result.status !== 'FOUND') throw new Error('C2 must be accepted')
    expect(result.approval.occurrenceCount).toBe(4)

    const missingBranch = structuredClone(request) as any
    missingBranch.artifact.nodes = missingBranch.artifact.nodes.filter(
      (candidate: any) => candidate.occurrence !== right.occurrence,
    )
    const rejected = await searchPortableStructuralProof({
      seeds: [missingBranch],
      expand: () => [],
      bounds: { maxCandidates: 1, maxDepth: 0 },
    })
    expect(rejected.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })

  it('C3 stores L1, reapproves it on use, then reuses its proof in a later searched theorem', async () => {
    const fx = fixture()
    const lemma = node(fx, [])
    const lemmaEvidence: StructuralDerivationEvidence = {
      theory: fx.theory,
      targetOccurrence: lemma.occurrence,
      nodes: [lemma],
    }
    const lemmaRecord = await createTheoremRecord(
      await plainRequest(fx.memory, fx.theory, lemmaEvidence),
    )
    const repository = new InMemoryTheoremRepository()
    repository.put({ id: 'L1', record: lemmaRecord })

    const stored = await repository.use('L1')
    expect(stored.verdict).toBe('ACCEPT')
    if (stored.verdict !== 'ACCEPT') throw new Error('stored L1 must freshly reapprove')

    const replayed = replayPortableStructuralProof(stored.record.proof.artifact)
    if ('derivation' in replayed.evidence) throw new Error('L1 must be a plain derivation')
    const proof = replayed.evidence
    const proofNode = proof.nodes[0]
    if (proofNode === undefined) throw new Error('L1 proof node missing')

    const memory = replayed.memory
    const producer = createStructuralProofProducer(memory)
    const theory = proof.theory
    const lemmaClaim = proofNode.judgment.judgment.claim
    const lemmaOccurrence = proof.targetOccurrence
    const role = memory.ensure(lemmaClaim, ensureRootBasis(memory).R)
    const roleDictionary = producer.defineRoleDictionary([role])
    const context = producer.defineContext(memory.ensure(role, role), memory.ensure(role, theory))
    const expectedInterpreter = proofNode.judgment.application.expectedInterpreter
    const interpreter = producer.defineInterpreter(
      expectedInterpreter.dictionary,
      expectedInterpreter.grammar,
      theory,
    )
    const targetClaim = memory.ensure(lemmaClaim, lemmaClaim)
    const ruleBody = memory.ensure(role, role)
    const rule = producer.defineRule(roleDictionary, ruleBody)
    const act = producer.defineAct(interpreter, roleDictionary, context)
    producer.defineActField(act, role, lemmaClaim)
    const targetOccurrence = producer.defineProofOccurrence(act, targetClaim)
    const derivationRule = producer.defineDerivationRule(rule, [role, role])
    const targetNode: StructuralDerivationNodeEvidence = {
      occurrence: targetOccurrence,
      judgment: {
        application: {
          act,
          rule,
          ruleAdmission: producer.admitRule(theory, rule),
          claimedBody: targetClaim,
          expectedInterpreter,
          expectedAfterContext: context,
        },
        judgment: { theory, context, claim: targetClaim },
      },
      derivationRule,
      derivationRuleAdmission: producer.admitDerivationRule(theory, derivationRule),
      premiseOccurrenceSequence: producer.definePremiseOccurrenceSequence([
        lemmaOccurrence,
        lemmaOccurrence,
      ]),
    }
    const theorem = producer.defineTheorem(lemmaClaim, theory)
    const evidence = {
      derivation: { theory, targetOccurrence, nodes: [targetNode] },
      theorems: [{ theorem, proof }],
    }
    const artifact = exportPortableStructuralDerivationWithTheorems(memory, evidence)
    const portableTarget = artifact.nodes.find(
      candidate => candidate.occurrence === artifact.targetOccurrenceCoordinate,
    )
    if (portableTarget === undefined) throw new Error('C3 target missing from portable artifact')
    const request: PortableProofApprovalRequest = {
      artifact,
      provenance: await createPortableStructuralDerivationWithTheoremsProvenanceClaim(
        artifact,
        SOURCE,
        PRODUCER,
      ),
      target: {
        theoryCoordinate: artifact.theoryCoordinate,
        targetOccurrenceCoordinate: artifact.targetOccurrenceCoordinate,
        claimCoordinate: portableTarget.judgment.judgment.claim,
      },
      expectedTheory: await expectedTheory(memory, theory),
    }

    const result = await searchPortableStructuralProof({
      seeds: [request],
      expand: () => [],
      bounds: { maxCandidates: 1, maxDepth: 0 },
    })
    expect(result.status).toBe('FOUND')
    if (result.status !== 'FOUND') throw new Error('C3 theorem reuse must be accepted')
    expect(result.approval.occurrenceCount).toBe(2)

    const forged = structuredClone(request) as any
    forged.artifact.theorems[0].proof.nodes = []
    const rejected = await searchPortableStructuralProof({
      seeds: [forged],
      expand: () => [],
      bounds: { maxCandidates: 1, maxDepth: 0 },
    })
    expect(rejected.status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })
})
