import { describe, expect, it } from 'vitest'
import {
  Memory,
  computePortableStructuralTheoryRevision,
  createStructuralProofProducer,
  ensureRootBasis,
  exportPortableProofSubAnetProjection,
  exportPortableStructuralTheory,
  materializeHeterogeneousDerivedClosedRootedDischarge,
  materializeHeterogeneousDerivedOpenRootedExpansion,
  replayClosedProofOccurrence,
  replayPortableProofSubAnetProjection,
  replayProofSubAnetProjection,
  replayStructuralHeterogeneousDerivedClosedRootedInstance,
  replayStructuralHeterogeneousDerivedDerivationSchema,
  replayStructuralHeterogeneousDerivedOpenRootedInstance,
  type LinkHandle,
} from '@mts/core'
import { approvePortableProofSubAnetProjection } from '../../src/core/proofApproval'
import {
  createProofSubAnetProjectionTheoremRecord,
  THEOREM_PROJECTION_RECORD_SCHEMA,
  type TheoremProjectionRecordV02,
} from '../../src/core/theoremLibrary'
import { InMemoryTheoremRepository } from '../../src/core/theoremRepository'

function portableReload(record: TheoremProjectionRecordV02): TheoremProjectionRecordV02 {
  return JSON.parse(JSON.stringify(record)) as TheoremProjectionRecordV02
}

async function buildAcceptedT4Projection() {
  const memory = new Memory()
  const { R, O, C, L, U } = ensureRootBasis(memory)
  const producer = createStructuralProofProducer(memory)
  const theory = memory.ensure(C, U)

  const sequence = (values: readonly LinkHandle[]) => producer.definePremiseOccurrenceSequence(values)
  const identityProof = (
    left: LinkHandle,
    right: LinkHandle,
    children: readonly LinkHandle[],
  ) => memory.ensure(memory.ensure(left, right), sequence(children))
  const morphism = (
    sourceDictionary: LinkHandle,
    targetDictionary: LinkHandle,
    bindings: readonly (readonly [LinkHandle, LinkHandle])[],
  ) => sequence([
    theory,
    sourceDictionary,
    targetDictionary,
    sequence(bindings.map(([sourceRole, targetRole]) => memory.ensure(sourceRole, targetRole))),
  ])
  const genericNode = (
    claim: LinkHandle,
    localDR: LinkHandle,
    mu: LinkHandle,
    dependencies: readonly LinkHandle[],
  ) => memory.ensure(claim, memory.ensure(localDR, memory.ensure(mu, sequence(dependencies))))

  let roleCursor = memory.ensure(L, R)
  const freshRole = (): LinkHandle => (roleCursor = memory.ensure(roleCursor, R))

  const rootProof = identityProof(R, R, [])
  const oProof = identityProof(O, O, [rootProof])
  const cProof = identityProof(C, C, [rootProof])
  const lProof = identityProof(L, L, [oProof, cProof])
  const uProof = identityProof(U, U, [cProof, oProof])
  const a = memory.ensure(O, U)
  const aProof = identityProof(a, a, [oProof, uProof])
  const aClaim = memory.ensure(a, a)
  const successor = memory.ensure(a, L)
  const successorProof = identityProof(successor, successor, [aProof, lProof])
  const successorClaim = memory.ensure(successor, successor)
  replayClosedProofOccurrence(memory, theory, successorProof)

  // Accepted T5 two-symbolic-slot package. Both concrete slots contract to the
  // same successor Claim, while the proof topology still retains both positions.
  const P1 = freshRole()
  const P2 = freshRole()
  const packageDictionary = producer.defineRoleDictionary([P1, P2])
  const packageConclusion = memory.ensure(P1, P2)
  const packageRule = producer.defineRule(packageDictionary, packageConclusion)
  const packageDR = producer.defineDerivationRule(packageRule, [P1, P2])
  const packageIdentity = memory.ensure(packageDR, theory)
  expect(memory.find(theory, packageRule)).toBeUndefined()
  expect(memory.find(theory, packageDR)).toBeUndefined()

  const localP1 = freshRole()
  const localP2 = freshRole()
  const localDictionary = producer.defineRoleDictionary([localP1, localP2])
  const localConclusion = memory.ensure(localP1, localP2)
  const localRule = producer.defineRule(localDictionary, localConclusion)
  const localDR = producer.defineDerivationRule(localRule, [localP1, localP2])
  producer.admitRule(theory, localRule)
  producer.admitDerivationRule(theory, localDR)
  const packageMu = morphism(
    localDictionary,
    packageDictionary,
    [[localP1, P1], [localP2, P2]],
  )
  const genericAssumption1 = memory.ensure(P1, packageIdentity)
  const genericAssumption2 = memory.ensure(P2, packageIdentity)
  const packageTarget = genericNode(
    packageConclusion,
    localDR,
    packageMu,
    [genericAssumption1, genericAssumption2],
  )
  const packageGeneric = Object.freeze({ identity: packageIdentity, targetOccurrence: packageTarget })
  const genericReplay = replayStructuralHeterogeneousDerivedDerivationSchema(memory, packageGeneric)
  expect(genericReplay.declaredAssumptionCount).toBe(2)
  expect(genericReplay.usedAssumptionCount).toBe(2)

  const openPackageRoot = materializeHeterogeneousDerivedOpenRootedExpansion(
    memory,
    packageGeneric,
    [{ role: P1, value: successorClaim }, { role: P2, value: successorClaim }],
  ).concreteRoot
  const openPackage = replayStructuralHeterogeneousDerivedOpenRootedInstance(memory, {
    generic: packageGeneric,
    concreteRoot: openPackageRoot,
  })
  expect(openPackage.pairedOccurrenceCount).toBe(3)

  const openPackageIdentity = memory.poles(openPackageRoot).start
  const sharedAssumption = memory.ensure(successorClaim, openPackageIdentity)
  const closedPackageRoot = materializeHeterogeneousDerivedClosedRootedDischarge(
    memory,
    { generic: packageGeneric, concreteRoot: openPackageRoot },
    [{ assumptionOccurrence: sharedAssumption, proofOccurrence: successorProof }],
  ).closedRoot
  const closedPackage = replayStructuralHeterogeneousDerivedClosedRootedInstance(memory, {
    open: { generic: packageGeneric, concreteRoot: openPackageRoot },
    closedRoot: closedPackageRoot,
  })
  expect(closedPackage.dischargedAssumptionCount).toBe(1)
  expect(closedPackage.pairedStructuralOccurrenceCount).toBe(1)
  const closedPackageTarget = memory.poles(closedPackageRoot).end
  replayClosedProofOccurrence(memory, theory, closedPackageTarget)

  // T5 bridge selects the exact successor equality proof without admitting a
  // theorem-specific primitive.
  const A = freshRole()
  const B = freshRole()
  const N = freshRole()
  const bridgeDictionary = producer.defineRoleDictionary([A, B, N])
  const successorA = memory.ensure(A, L)
  const successorB = memory.ensure(B, L)
  const predecessorPremiseA = memory.ensure(successorA, N)
  const predecessorPremiseB = memory.ensure(successorB, N)
  const combinedPremise = memory.ensure(predecessorPremiseA, predecessorPremiseB)
  const t4PremiseTemplate = memory.ensure(successorA, successorB)
  const bridgeRule = producer.defineRule(bridgeDictionary, t4PremiseTemplate)
  const bridgeDR = producer.defineDerivationRule(bridgeRule, [combinedPremise])
  expect(memory.find(theory, bridgeRule)).toBeUndefined()
  expect(memory.find(theory, bridgeDR)).toBeUndefined()
  const bridge = replayProofSubAnetProjection(memory, {
    theory,
    schemaDerivationRule: bridgeDR,
    premiseProofOccurrence: closedPackageTarget,
  })
  expect(bridge.projectedOccurrence).toBe(successorProof)
  expect(bridge.projectedClaim).toBe(successorClaim)

  // Accepted generic T4 successor-injectivity projection, still unadmitted.
  const T4A = freshRole()
  const T4B = freshRole()
  const t4Dictionary = producer.defineRoleDictionary([T4A, T4B])
  const t4Premise = memory.ensure(memory.ensure(T4A, L), memory.ensure(T4B, L))
  const t4Conclusion = memory.ensure(T4A, T4B)
  const t4Rule = producer.defineRule(t4Dictionary, t4Conclusion)
  const t4DR = producer.defineDerivationRule(t4Rule, [t4Premise])
  expect(memory.find(theory, t4Rule)).toBeUndefined()
  expect(memory.find(theory, t4DR)).toBeUndefined()
  const t4 = replayProofSubAnetProjection(memory, {
    theory,
    schemaDerivationRule: t4DR,
    premiseProofOccurrence: bridge.projectedOccurrence,
  })
  expect(t4.projectedOccurrence).toBe(aProof)
  expect(t4.projectedClaim).toBe(aClaim)

  const artifact = exportPortableProofSubAnetProjection(memory, {
    theory,
    schemaDerivationRule: t4DR,
    premiseProofOccurrence: bridge.projectedOccurrence,
  })
  const theoryArtifact = exportPortableStructuralTheory(memory, theory)
  return {
    artifact,
    expectedTheory: {
      artifact: theoryArtifact,
      revision: await computePortableStructuralTheoryRevision(theoryArtifact),
    },
  }
}

function consumeFreshT4Replay(record: TheoremProjectionRecordV02) {
  const t4 = replayPortableProofSubAnetProjection(record.proof.artifact)
  const memory = t4.memory
  const theory = t4.evidence.theory
  const { R, C, L, U } = ensureRootBasis(memory)
  const producer = createStructuralProofProducer(memory)
  const sequence = (values: readonly LinkHandle[]) => producer.definePremiseOccurrenceSequence(values)
  const morphism = (
    sourceDictionary: LinkHandle,
    targetDictionary: LinkHandle,
    bindings: readonly (readonly [LinkHandle, LinkHandle])[],
  ) => sequence([
    theory,
    sourceDictionary,
    targetDictionary,
    sequence(bindings.map(([sourceRole, targetRole]) => memory.ensure(sourceRole, targetRole))),
  ])
  const genericNode = (
    claim: LinkHandle,
    localDR: LinkHandle,
    mu: LinkHandle,
    dependencies: readonly LinkHandle[],
  ) => memory.ensure(claim, memory.ensure(localDR, memory.ensure(mu, sequence(dependencies))))

  // Fresh replay, not storage, is the only source of the reusable occurrence.
  const projectedOccurrence = t4.replay.projectedOccurrence
  const projectedClaim = t4.replay.projectedClaim
  replayClosedProofOccurrence(memory, theory, projectedOccurrence)
  expect(memory.find(theory, t4.evidence.schemaDerivationRule)).toBeUndefined()

  // A later generic proof consumes exactly that freshly reconstructed T4
  // occurrence through K1d4 discharge, matching the accepted upstream witness.
  let roleCursor = memory.ensure(L, R)
  const freshRole = (): LinkHandle => (roleCursor = memory.ensure(roleCursor, R))
  const CP = freshRole()
  const CQ = freshRole()
  const consumerDictionary = producer.defineRoleDictionary([CP, CQ])
  const consumerRule = producer.defineRule(consumerDictionary, CQ)
  const consumerDR = producer.defineDerivationRule(consumerRule, [CP])
  const consumerIdentity = memory.ensure(consumerDR, theory)
  expect(memory.find(theory, consumerRule)).toBeUndefined()
  expect(memory.find(theory, consumerDR)).toBeUndefined()

  const localCP = freshRole()
  const localCQ = freshRole()
  const localDictionary = producer.defineRoleDictionary([localCP, localCQ])
  const localRule = producer.defineRule(localDictionary, localCQ)
  const localDR = producer.defineDerivationRule(localRule, [localCP])
  producer.admitRule(theory, localRule)
  producer.admitDerivationRule(theory, localDR)
  const mu = morphism(
    localDictionary,
    consumerDictionary,
    [[localCP, CP], [localCQ, CQ]],
  )
  const genericAssumption = memory.ensure(CP, consumerIdentity)
  const consumerTarget = genericNode(CQ, localDR, mu, [genericAssumption])
  const consumerGeneric = Object.freeze({
    identity: consumerIdentity,
    targetOccurrence: consumerTarget,
  })
  replayStructuralHeterogeneousDerivedDerivationSchema(memory, consumerGeneric)

  const consumerValue = memory.ensure(U, C)
  const openRoot = materializeHeterogeneousDerivedOpenRootedExpansion(
    memory,
    consumerGeneric,
    [{ role: CP, value: projectedClaim }, { role: CQ, value: consumerValue }],
  ).concreteRoot
  replayStructuralHeterogeneousDerivedOpenRootedInstance(memory, {
    generic: consumerGeneric,
    concreteRoot: openRoot,
  })
  const openIdentity = memory.poles(openRoot).start
  const concreteAssumption = memory.ensure(projectedClaim, openIdentity)
  const closedRoot = materializeHeterogeneousDerivedClosedRootedDischarge(
    memory,
    { generic: consumerGeneric, concreteRoot: openRoot },
    [{ assumptionOccurrence: concreteAssumption, proofOccurrence: projectedOccurrence }],
  ).closedRoot
  const closed = replayStructuralHeterogeneousDerivedClosedRootedInstance(memory, {
    open: { generic: consumerGeneric, concreteRoot: openRoot },
    closedRoot,
  })
  expect(closed.dischargedAssumptionCount).toBe(1)
  const finalOccurrence = memory.poles(closedRoot).end
  const finalReplay = replayClosedProofOccurrence(memory, theory, finalOccurrence)

  return { projectedOccurrence, projectedClaim, finalOccurrence, finalReplay }
}

describe('A-SYNC1 T4 storage -> fresh replay -> reuse', () => {
  it('keeps storage non-authoritative and reuses only a freshly replayed T4 occurrence', async () => {
    const request = await buildAcceptedT4Projection()
    expect(await approvePortableProofSubAnetProjection(request)).toMatchObject({
      verdict: 'ACCEPT',
      semanticBase: 'mts-contract/v0.11',
    })

    const record = await createProofSubAnetProjectionTheoremRecord(request)
    expect(record.schema).toBe(THEOREM_PROJECTION_RECORD_SCHEMA)
    expect(record.proof).not.toHaveProperty('target')
    expect(record.proof).not.toHaveProperty('projectedOccurrence')
    expect(record.proof).not.toHaveProperty('projectedClaim')

    const firstRepository = new InMemoryTheoremRepository()
    firstRepository.put({ id: 'T4', record })
    expect(firstRepository.findByClaimCoordinate(0)).toEqual([])

    // Simulate a storage/process boundary: only JSON-safe record evidence crosses it.
    const loadedRecord = portableReload(firstRepository.get('T4')!.record as TheoremProjectionRecordV02)
    const reloadedRepository = new InMemoryTheoremRepository()
    reloadedRepository.put({ id: 'T4', record: loadedRecord })
    expect(await reloadedRepository.use('T4')).toMatchObject({ verdict: 'ACCEPT' })

    const reused = consumeFreshT4Replay(
      reloadedRepository.get('T4')!.record as TheoremProjectionRecordV02,
    )
    expect(reused.projectedOccurrence).not.toBeUndefined()
    expect(reused.projectedClaim).not.toBeUndefined()
    expect(reused.finalOccurrence).not.toBe(reused.projectedOccurrence)
    expect(reused.finalReplay).toBeDefined()
  })
})
