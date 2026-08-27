import { describe, expect, it } from 'vitest'
import {
  Memory,
  computePortableStructuralTheoryRevision,
  createPortableStructuralDerivationProvenanceClaim,
  createPortableStructuralDerivationWithAssumptionsProvenanceClaim,
  createStructuralProofProducer,
  ensureRootBasis,
  exportPortableStructuralDerivation,
  exportPortableStructuralDerivationWithAssumptions,
  exportPortableStructuralTheory,
  type LinkHandle,
  type StructuralDerivationEvidence,
  type StructuralDerivationNodeEvidence,
  type StructuralDerivationWithAssumptionsEvidence,
} from '@mts/core'

import type { PortableProofApprovalRequest } from '../../src/core/proofApproval'
import { searchPortableStructuralProof } from '../../src/core/proofSearch'

const SOURCE = {
  locator: 'github:netkeep80/aprover',
  revision: 'r3-c7-link-logic-corpus',
  subject: '#157',
} as const
const PRODUCER = { id: 'aprover-r3-link-logic-corpus', version: '0.1.0' } as const

type Binding = readonly [LinkHandle, LinkHandle]

interface Fixture {
  readonly memory: Memory
  readonly R: LinkHandle
  readonly L: LinkHandle
  readonly U: LinkHandle
  readonly theory: LinkHandle
  readonly foreignTheory: LinkHandle
  readonly dictionary: LinkHandle
  readonly grammar: LinkHandle
  readonly producer: ReturnType<typeof createStructuralProofProducer>
  readonly fresh: () => LinkHandle
  readonly pair: (left: LinkHandle, right: LinkHandle) => LinkHandle
}

interface RulePack {
  readonly theory: LinkHandle
  readonly roles: readonly LinkHandle[]
  readonly roleDictionary: LinkHandle
  readonly rule: LinkHandle
  readonly ruleAdmission: LinkHandle
  readonly derivationRule: LinkHandle
  readonly derivationRuleAdmission: LinkHandle
}

interface BuiltNode {
  readonly occurrence: LinkHandle
  readonly node: StructuralDerivationNodeEvidence
}

function fixture(): Fixture {
  const memory = new Memory()
  const { R, L, U } = ensureRootBasis(memory)
  let cursor = U
  const fresh = (): LinkHandle => (cursor = memory.ensure(cursor, R))
  const pair = (left: LinkHandle, right: LinkHandle): LinkHandle => memory.ensure(left, right)
  const dictionary = fresh()
  const grammar = fresh()
  const theory = fresh()
  const foreignTheory = fresh()
  return {
    memory,
    R,
    L,
    U,
    theory,
    foreignTheory,
    dictionary,
    grammar,
    producer: createStructuralProofProducer(memory),
    fresh,
    pair,
  }
}

function pack(
  fx: Fixture,
  roles: readonly LinkHandle[],
  conclusionTemplate: LinkHandle,
  premiseTemplates: readonly LinkHandle[],
  theory = fx.theory,
): RulePack {
  const roleDictionary = fx.producer.defineRoleDictionary(roles)
  const rule = fx.producer.defineRule(roleDictionary, conclusionTemplate)
  const ruleAdmission = fx.producer.admitRule(theory, rule)
  const derivationRule = fx.producer.defineDerivationRule(rule, premiseTemplates)
  return {
    theory,
    roles,
    roleDictionary,
    rule,
    ruleAdmission,
    derivationRule,
    derivationRuleAdmission: fx.producer.admitDerivationRule(theory, derivationRule),
  }
}

function node(
  fx: Fixture,
  rule: RulePack,
  bindings: readonly Binding[],
  claim: LinkHandle,
  premiseOccurrences: readonly LinkHandle[],
): BuiltNode {
  const context = fx.producer.defineContext(fx.fresh(), fx.fresh())
  const interpreter = fx.producer.defineInterpreter(fx.dictionary, fx.grammar, rule.theory)
  const act = fx.producer.defineAct(interpreter, rule.roleDictionary, context)
  for (const [role, value] of bindings) fx.producer.defineActField(act, role, value)
  const occurrence = fx.producer.defineProofOccurrence(act, claim)
  return {
    occurrence,
    node: {
      occurrence,
      judgment: {
        application: {
          act,
          rule: rule.rule,
          ruleAdmission: rule.ruleAdmission,
          claimedBody: claim,
          expectedInterpreter: {
            dictionary: fx.dictionary,
            grammar: fx.grammar,
            theory: rule.theory,
          },
          expectedAfterContext: context,
        },
        judgment: { theory: rule.theory, context, claim },
      },
      derivationRule: rule.derivationRule,
      derivationRuleAdmission: rule.derivationRuleAdmission,
      premiseOccurrenceSequence: fx.producer.definePremiseOccurrenceSequence(premiseOccurrences),
    },
  }
}

function fact(fx: Fixture, claim: LinkHandle, theory = fx.theory): BuiltNode {
  const role = fx.fresh()
  const root = pack(fx, [role], role, [], theory)
  return node(fx, root, [[role, claim]], claim, [])
}

async function expectedTheory(fx: Fixture, theory = fx.theory) {
  const artifact = exportPortableStructuralTheory(fx.memory, theory)
  return {
    artifact,
    revision: await computePortableStructuralTheoryRevision(artifact),
  }
}

function targetFromArtifact(artifact: any) {
  const target = artifact.nodes.find(
    (candidate: any) => candidate.occurrence === artifact.targetOccurrenceCoordinate,
  )
  if (target === undefined) throw new Error('target occurrence missing from portable artifact')
  return {
    theoryCoordinate: artifact.theoryCoordinate,
    targetOccurrenceCoordinate: artifact.targetOccurrenceCoordinate,
    claimCoordinate: target.judgment.judgment.claim,
  }
}

async function request(
  fx: Fixture,
  evidence: StructuralDerivationEvidence,
  selectedTheory = fx.theory,
): Promise<PortableProofApprovalRequest> {
  const artifact = exportPortableStructuralDerivation(fx.memory, evidence)
  return {
    artifact,
    provenance: await createPortableStructuralDerivationProvenanceClaim(artifact, SOURCE, PRODUCER),
    target: targetFromArtifact(artifact),
    expectedTheory: await expectedTheory(fx, selectedTheory),
  }
}

async function requestWithAssumptions(
  fx: Fixture,
  evidence: StructuralDerivationWithAssumptionsEvidence,
): Promise<PortableProofApprovalRequest> {
  const artifact = exportPortableStructuralDerivationWithAssumptions(fx.memory, evidence)
  return {
    artifact,
    provenance: await createPortableStructuralDerivationWithAssumptionsProvenanceClaim(
      artifact,
      SOURCE,
      PRODUCER,
    ),
    target: targetFromArtifact(artifact),
    expectedTheory: await expectedTheory(fx),
  }
}

async function certify(candidate: PortableProofApprovalRequest) {
  return searchPortableStructuralProof({
    seeds: [candidate],
    expand: () => [],
    bounds: { maxCandidates: 1, maxDepth: 0 },
  })
}

function expectFound(result: Awaited<ReturnType<typeof certify>>, message: string) {
  expect(result.status).toBe('FOUND')
  if (result.status !== 'FOUND') throw new Error(message)
  return result
}

function assumptionOccurrence(fx: Fixture, context: LinkHandle, claim: LinkHandle): LinkHandle {
  const occurrence = fx.memory.find(context, claim)
  if (occurrence === undefined) throw new Error('assumption occurrence missing')
  return occurrence
}

describe('R3 C7 link-logic certification corpus', () => {
  it('C7a accepts raw-Link modus ponens only under the exact selected Theory', async () => {
    const fx = fixture()
    const P = fx.fresh()
    const Q = fx.fresh()
    const pRole = fx.fresh()
    const qRole = fx.fresh()
    const implication = fx.pair(P, Q)
    const mp = pack(fx, [pRole, qRole], qRole, [pRole, fx.pair(pRole, qRole)])
    const assumptions = fx.producer.defineAssumptionContext(fx.theory, [P, implication])
    const target = node(
      fx,
      mp,
      [[pRole, P], [qRole, Q]],
      Q,
      [
        assumptionOccurrence(fx, assumptions, P),
        assumptionOccurrence(fx, assumptions, implication),
      ],
    )
    const candidate = await requestWithAssumptions(fx, {
      derivation: { theory: fx.theory, targetOccurrence: target.occurrence, nodes: [target.node] },
      assumptionContext: assumptions,
    })

    const accepted = expectFound(await certify(candidate), 'C7a modus ponens must be accepted')
    expect(accepted.approval.occurrenceCount).toBe(1)

    const wrongTheory = structuredClone(candidate) as any
    wrongTheory.expectedTheory = await expectedTheory(fx, fx.foreignTheory)
    expect((await certify(wrongTheory)).status).toBe('NOT_FOUND_WITHIN_BOUNDS')

    const missingImplication = structuredClone(candidate) as any
    missingImplication.artifact.assumptionContextCoordinate =
      missingImplication.artifact.targetOccurrenceCoordinate
    expect((await certify(missingImplication)).status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })

  it('C7b certifies proof-relevant AND intro/projection and rejects a missing side', async () => {
    const fx = fixture()
    const P = fx.fresh()
    const Q = fx.fresh()
    const andTag = fx.fresh()
    const pRole = fx.fresh()
    const qRole = fx.fresh()
    const and = (left: LinkHandle, right: LinkHandle) => fx.pair(andTag, fx.pair(left, right))
    const intro = pack(fx, [pRole, qRole], and(pRole, qRole), [pRole, qRole])
    const left = pack(fx, [pRole, qRole], pRole, [and(pRole, qRole)])
    const proofP = fact(fx, P)
    const proofQ = fact(fx, Q)
    const conjunction = node(
      fx,
      intro,
      [[pRole, P], [qRole, Q]],
      and(P, Q),
      [proofP.occurrence, proofQ.occurrence],
    )
    const projection = node(
      fx,
      left,
      [[pRole, P], [qRole, Q]],
      P,
      [conjunction.occurrence],
    )
    const candidate = await request(fx, {
      theory: fx.theory,
      targetOccurrence: projection.occurrence,
      nodes: [proofP.node, proofQ.node, conjunction.node, projection.node],
    })

    const accepted = expectFound(await certify(candidate), 'C7b AND projection must be accepted')
    expect(accepted.approval.occurrenceCount).toBe(4)

    const missingSide = structuredClone(candidate) as any
    missingSide.artifact.nodes = missingSide.artifact.nodes.filter(
      (candidateNode: any) => candidateNode.occurrence !== missingSide.artifact.nodes[1].occurrence,
    )
    expect((await certify(missingSide)).status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })

  it('C7c keeps OR choice proof-relevant and case elimination requires both branches', async () => {
    const fx = fixture()
    const P = fx.fresh()
    const Q = fx.fresh()
    const R = fx.fresh()
    const orTag = fx.fresh()
    const pRole = fx.fresh()
    const qRole = fx.fresh()
    const rRole = fx.fresh()
    const or = (left: LinkHandle, right: LinkHandle) => fx.pair(orTag, fx.pair(left, right))
    const leftIntro = pack(fx, [pRole, qRole], or(pRole, qRole), [pRole])
    const rightIntro = pack(fx, [pRole, qRole], or(pRole, qRole), [qRole])
    const cases = pack(
      fx,
      [pRole, qRole, rRole],
      rRole,
      [or(pRole, qRole), fx.pair(pRole, rRole), fx.pair(qRole, rRole)],
    )

    const proofP = fact(fx, P)
    const selectedLeft = node(
      fx,
      leftIntro,
      [[pRole, P], [qRole, Q]],
      or(P, Q),
      [proofP.occurrence],
    )
    const proofPtoR = fact(fx, fx.pair(P, R))
    const proofQtoR = fact(fx, fx.pair(Q, R))
    const caseResult = node(
      fx,
      cases,
      [[pRole, P], [qRole, Q], [rRole, R]],
      R,
      [selectedLeft.occurrence, proofPtoR.occurrence, proofQtoR.occurrence],
    )
    const candidate = await request(fx, {
      theory: fx.theory,
      targetOccurrence: caseResult.occurrence,
      nodes: [proofP.node, selectedLeft.node, proofPtoR.node, proofQtoR.node, caseResult.node],
    })
    expectFound(await certify(candidate), 'C7c OR case elimination must be accepted')

    const proofQ = fact(fx, Q)
    const selectedRight = node(
      fx,
      rightIntro,
      [[pRole, P], [qRole, Q]],
      or(P, Q),
      [proofQ.occurrence],
    )
    expectFound(
      await certify(await request(fx, {
        theory: fx.theory,
        targetOccurrence: selectedRight.occurrence,
        nodes: [proofQ.node, selectedRight.node],
      })),
      'C7c OR-right must preserve its distinct admitted derivation rule',
    )

    const missingBranch = structuredClone(candidate) as any
    missingBranch.artifact.nodes = missingBranch.artifact.nodes.filter(
      (candidateNode: any) => candidateNode.occurrence !== missingBranch.artifact.nodes[3].occurrence,
    )
    expect((await certify(missingBranch)).status).toBe('NOT_FOUND_WITHIN_BOUNDS')

    const rawPairClaim = fx.pair(P, Q)
    const forged = node(
      fx,
      leftIntro,
      [[pRole, P], [qRole, Q]],
      rawPairClaim,
      [proofP.occurrence],
    )
    expect((await certify(await request(fx, {
      theory: fx.theory,
      targetOccurrence: forged.occurrence,
      nodes: [proofP.node, forged.node],
    }))).status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })

  it('C7d distinguishes proof-level equality from explicit L/U and never turns unknown into U', async () => {
    const fx = fixture()
    const K = fx.fresh()
    const K2 = fx.fresh()
    const A = fx.fresh()
    const B = fx.fresh()
    const eqTag = fx.fresh()
    const neqTag = fx.fresh()
    const valueTag = fx.fresh()
    const kRole = fx.fresh()
    const aRole = fx.fresh()
    const bRole = fx.fresh()
    const eq = (k: LinkHandle, a: LinkHandle, b: LinkHandle) =>
      fx.pair(eqTag, fx.pair(k, fx.pair(a, b)))
    const neq = (k: LinkHandle, a: LinkHandle, b: LinkHandle) =>
      fx.pair(neqTag, fx.pair(k, fx.pair(a, b)))
    const value = (k: LinkHandle, a: LinkHandle, b: LinkHandle, v: LinkHandle) =>
      fx.pair(valueTag, fx.pair(k, fx.pair(a, fx.pair(b, v))))
    const eqToL = pack(
      fx,
      [kRole, aRole, bRole],
      value(kRole, aRole, bRole, fx.L),
      [eq(kRole, aRole, bRole)],
    )
    const neqToU = pack(
      fx,
      [kRole, aRole, bRole],
      value(kRole, aRole, bRole, fx.U),
      [neq(kRole, aRole, bRole)],
    )

    const equality = fact(fx, eq(K, A, B))
    const lValue = node(
      fx,
      eqToL,
      [[kRole, K], [aRole, A], [bRole, B]],
      value(K, A, B, fx.L),
      [equality.occurrence],
    )
    expectFound(
      await certify(await request(fx, {
        theory: fx.theory,
        targetOccurrence: lValue.occurrence,
        nodes: [equality.node, lValue.node],
      })),
      'C7d explicit equality evidence must produce L',
    )

    const inequality = fact(fx, neq(K, A, B))
    const uValue = node(
      fx,
      neqToU,
      [[kRole, K], [aRole, A], [bRole, B]],
      value(K, A, B, fx.U),
      [inequality.occurrence],
    )
    expectFound(
      await certify(await request(fx, {
        theory: fx.theory,
        targetOccurrence: uValue.occurrence,
        nodes: [inequality.node, uValue.node],
      })),
      'C7d explicit inequality evidence must produce U',
    )

    const unknown = node(
      fx,
      neqToU,
      [[kRole, K], [aRole, A], [bRole, B]],
      value(K, A, B, fx.U),
      [],
    )
    expect((await certify(await request(fx, {
      theory: fx.theory,
      targetOccurrence: unknown.occurrence,
      nodes: [unknown.node],
    }))).status).toBe('NOT_FOUND_WITHIN_BOUNDS')

    const wrongContext = node(
      fx,
      neqToU,
      [[kRole, K2], [aRole, A], [bRole, B]],
      value(K2, A, B, fx.U),
      [inequality.occurrence],
    )
    expect((await certify(await request(fx, {
      theory: fx.theory,
      targetOccurrence: wrongContext.occurrence,
      nodes: [inequality.node, wrongContext.node],
    }))).status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })

  it('C7e selects IF only from explicit contextual L/U evidence, never host metadata or an impostor dot value', async () => {
    const fx = fixture()
    const K = fx.fresh()
    const Then = fx.fresh()
    const Else = fx.fresh()
    const alternate = fx.fresh()
    const dotTag = fx.fresh()
    const ifTag = fx.fresh()
    const kRole = fx.fresh()
    const thenRole = fx.fresh()
    const elseRole = fx.fresh()
    const dot = (k: LinkHandle, condition: LinkHandle) => fx.pair(dotTag, fx.pair(k, condition))
    const iff = (
      k: LinkHandle,
      condition: LinkHandle,
      thenValue: LinkHandle,
      elseValue: LinkHandle,
      result: LinkHandle,
    ) => fx.pair(
      ifTag,
      fx.pair(k, fx.pair(condition, fx.pair(thenValue, fx.pair(elseValue, result)))),
    )
    const ifL = pack(
      fx,
      [kRole, thenRole, elseRole],
      iff(kRole, fx.L, thenRole, elseRole, thenRole),
      [dot(kRole, fx.L)],
    )
    const ifU = pack(
      fx,
      [kRole, thenRole, elseRole],
      iff(kRole, fx.U, thenRole, elseRole, elseRole),
      [dot(kRole, fx.U)],
    )

    const dotL = fact(fx, dot(K, fx.L))
    const takeThen = node(
      fx,
      ifL,
      [[kRole, K], [thenRole, Then], [elseRole, Else]],
      iff(K, fx.L, Then, Else, Then),
      [dotL.occurrence],
    )
    expectFound(
      await certify(await request(fx, {
        theory: fx.theory,
        targetOccurrence: takeThen.occurrence,
        nodes: [dotL.node, takeThen.node],
      })),
      'C7e IF-L must select the then branch from explicit contextual L',
    )

    const dotU = fact(fx, dot(K, fx.U))
    const takeElse = node(
      fx,
      ifU,
      [[kRole, K], [thenRole, Then], [elseRole, Else]],
      iff(K, fx.U, Then, Else, Else),
      [dotU.occurrence],
    )
    expectFound(
      await certify(await request(fx, {
        theory: fx.theory,
        targetOccurrence: takeElse.occurrence,
        nodes: [dotU.node, takeElse.node],
      })),
      'C7e IF-U must select the else branch from explicit contextual U',
    )

    const noContextEvidence = node(
      fx,
      ifL,
      [[kRole, K], [thenRole, Then], [elseRole, Else]],
      iff(K, fx.L, Then, Else, Then),
      [],
    )
    expect((await certify(await request(fx, {
      theory: fx.theory,
      targetOccurrence: noContextEvidence.occurrence,
      nodes: [noContextEvidence.node],
    }))).status).toBe('NOT_FOUND_WITHIN_BOUNDS')

    const dotImpostor = fact(fx, dot(K, alternate))
    const forgedCondition = node(
      fx,
      ifL,
      [[kRole, K], [thenRole, Then], [elseRole, Else]],
      iff(K, alternate, Then, Else, Then),
      [dotImpostor.occurrence],
    )
    const forgedRequest = await request(fx, {
      theory: fx.theory,
      targetOccurrence: forgedCondition.occurrence,
      nodes: [dotImpostor.node, forgedCondition.node],
    })
    ;(forgedRequest as any).ruleKind = 'ifThen'
    expect((await certify(forgedRequest)).status).toBe('NOT_FOUND_WITHIN_BOUNDS')

    const wrongBranch = node(
      fx,
      ifL,
      [[kRole, K], [thenRole, Then], [elseRole, Else]],
      iff(K, fx.L, Then, Else, Else),
      [dotL.occurrence],
    )
    expect((await certify(await request(fx, {
      theory: fx.theory,
      targetOccurrence: wrongBranch.occurrence,
      nodes: [dotL.node, wrongBranch.node],
    }))).status).toBe('NOT_FOUND_WITHIN_BOUNDS')
  })
})
