import { describe, expect, it } from 'vitest'
import {
  computePortableStructuralTheoryRevision,
  createPortableStructuralDerivationProvenanceClaim,
  exportPortableStructuralTheory,
  replayPortableStructuralProof,
} from '@mts/core'
import consumerLock from '../../contracts/mts-core-consumer-lock.json'
import {
  createTheoremRecord,
  reapproveTheoremRecord,
  THEOREM_RECORD_SCHEMA,
  THEOREM_RECORD_CONSUMER,
} from '../../src/core/theoremLibrary'

const ACCEPTED_A_SYNC1_UPSTREAM = 'd3714a3f209567109412cea5687e2d6d011d9ebc' as const
const ACCEPTED_A_SYNC1_ARTIFACT_SHA256 =
  '638abe4247a300686f37018378985208dd88a59b0608be41177138899199187d' as const

const ARTIFACT = {
  schema: 'mts-portable-structural-derivation/v0.2',
  mtsSemanticBase: 'mts-contract/v0.11',
  topology: {
    schema: 'mts-storage-topology/v0.1',
    root: 0,
    links: [[0,0],[1,0],[0,2],[2,1],[3,0],[4,0],[5,0],[5,6],[6,0],[4,7],[8,0],[8,10],[10,0],[13,11],[0,12],[12,0],[16,14],[12,15],[18,16],[18,12],[18,13],[6,19],[9,20],[19,0],[24,22],[6,23],[15,24],[24,17]],
  },
  theoryCoordinate: 6,
  targetOccurrenceCoordinate: 26,
  nodes: [{
    occurrence: 26,
    judgment: {
      application: {
        act: 24, rule: 19, ruleAdmission: 21, claimedBody: 15,
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

const TARGET = { theoryCoordinate: 6, targetOccurrenceCoordinate: 26, claimCoordinate: 15 } as const
const SOURCE = {
  locator: 'https://github.com/leanprover-community/mathlib4',
  revision: '0123456789abcdef0123456789abcdef01234567',
  subject: 'Mathlib.Example.theorem',
} as const
const PRODUCER = { id: 'mts-proof-importer', version: '0.1.0' } as const

async function expectedTheoryFor(artifact: unknown = ARTIFACT) {
  const replayed = replayPortableStructuralProof(artifact)
  const theory =
    'theory' in replayed.evidence ? replayed.evidence.theory : replayed.evidence.derivation.theory
  const theoryArtifact = exportPortableStructuralTheory(replayed.memory, theory)
  return Object.freeze({
    artifact: theoryArtifact,
    revision: await computePortableStructuralTheoryRevision(theoryArtifact),
  })
}

async function request() {
  const artifact = structuredClone(ARTIFACT)
  return {
    artifact,
    provenance: await createPortableStructuralDerivationProvenanceClaim(artifact, SOURCE, PRODUCER),
    target: TARGET,
    expectedTheory: await expectedTheoryFor(artifact),
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe('theorem library record v0.1', () => {
  it('requires the exact accepted A-SYNC1 upstream source and artifact identity', () => {
    expect(consumerLock.commit).toBe(ACCEPTED_A_SYNC1_UPSTREAM)
    expect(consumerLock.package.version).toBe('0.10.0')
    expect(consumerLock.package.sha256).toBe(ACCEPTED_A_SYNC1_ARTIFACT_SHA256)
    expect(consumerLock.package.producer).toEqual({ node: '24.20.0', npm: '11.19.0' })
  })

  it('binds its audit identity to the exact canonical consumer lock', () => {
    expect(THEOREM_RECORD_SCHEMA).toBe('aprover-theorem-record/v0.1')
    expect(THEOREM_RECORD_CONSUMER).toEqual({
      repository: consumerLock.repository,
      upstreamCommit: consumerLock.commit,
      semanticBase: consumerLock.accepted.contract.schema,
      packageName: consumerLock.package.name,
      packageVersion: consumerLock.package.version,
      artifactSha256: consumerLock.package.sha256,
    })
  })

  it('creates only from accepted proof evidence and snapshots caller-owned data', async () => {
    const input = await request()
    const record = await createTheoremRecord(input)
    expect(record.schema).toBe(THEOREM_RECORD_SCHEMA)
    expect(record.consumer).toEqual(THEOREM_RECORD_CONSUMER)
    expect(record.proof.target).toEqual(TARGET)
    expect(record.proof.expectedTheory).toEqual(input.expectedTheory)
    expect(record.approval).toMatchObject({ semanticBase: 'mts-contract/v0.11', occurrenceCount: 1 })
    expect(record.approval.provenanceDigest.value).toMatch(/^[0-9a-f]{64}$/)

    ;(input.artifact as { theoryCoordinate: number }).theoryCoordinate = 0
    expect((record.proof.artifact as { theoryCoordinate: number }).theoryCoordinate).toBe(6)
    expect(Object.isFrozen(record)).toBe(true)
  })

  it('reapproves stored proof every time and reproduces stored audit evidence', async () => {
    const record = await createTheoremRecord(await request())
    expect(await reapproveTheoremRecord(record)).toEqual({ verdict: 'ACCEPT', record })
    expect(await reapproveTheoremRecord(record)).toEqual({ verdict: 'ACCEPT', record })
  })

  it('rejects theorem reuse under another exact @mts/core consumer lock', async () => {
    const record = await createTheoremRecord(await request())
    expect((await reapproveTheoremRecord(record)).verdict).toBe('ACCEPT')

    const underAnotherConsumerLock: any = clone(record)
    underAnotherConsumerLock.consumer = {
      ...underAnotherConsumerLock.consumer,
      upstreamCommit: '1'.repeat(40),
      packageVersion: '0.10.1',
      artifactSha256: '2'.repeat(64),
    }

    expect(await reapproveTheoremRecord(underAnotherConsumerLock))
      .toEqual({ verdict: 'REJECT', code: 'consumer-mismatch' })
  })

  it('does not create a record from rejected proof evidence', async () => {
    const input = await request()
    await expect(createTheoremRecord({ ...input, target: { ...TARGET, claimCoordinate: 14 } }))
      .rejects.toThrow('proof approval rejected')
  })

  it.each([
    ['unknown schema', (r: any) => ({ ...r, schema: 'aprover-theorem-record/v999' })],
    ['top-level authority', (r: any) => ({ ...r, approved: true })],
    ['consumer commit', (r: any) => ({ ...r, consumer: { ...r.consumer, upstreamCommit: '0'.repeat(40) } })],
    ['consumer semantic base', (r: any) => ({ ...r, consumer: { ...r.consumer, semanticBase: 'mts-contract/v999' } })],
    ['consumer artifact digest', (r: any) => ({ ...r, consumer: { ...r.consumer, artifactSha256: '0'.repeat(64) } })],
    ['stored occurrence count', (r: any) => ({ ...r, approval: { ...r.approval, occurrenceCount: 2 } })],
    ['stored semantic base', (r: any) => ({ ...r, approval: { ...r.approval, semanticBase: 'mts-contract/v999' } })],
    ['stored approval digest', (r: any) => ({ ...r, approval: { ...r.approval, provenanceDigest: { ...r.approval.provenanceDigest, value: '0'.repeat(64) } } })],
    ['nested trust field', (r: any) => ({ ...r, approval: { ...r.approval, trusted: true } })],
    ['forged target', (r: any) => ({ ...r, proof: { ...r.proof, target: { ...r.proof.target, claimCoordinate: 14 } } })],
    ['missing expected Theory', (r: any) => {
      const proof = { ...r.proof }
      delete proof.expectedTheory
      return { ...r, proof }
    }],
    ['forged expected Theory revision', (r: any) => ({
      ...r,
      proof: {
        ...r.proof,
        expectedTheory: {
          ...r.proof.expectedTheory,
          revision: { ...r.proof.expectedTheory.revision, value: '0'.repeat(64) },
        },
      },
    })],
  ])('fails closed for %s', async (_name, mutate) => {
    const record = await createTheoremRecord(await request())
    expect((await reapproveTheoremRecord(mutate(clone(record)))).verdict).toBe('REJECT')
  })

  it('rejects forged proof/provenance even if stored approval metadata still looks accepted', async () => {
    const record = await createTheoremRecord(await request())
    const forged: any = clone(record)
    forged.proof.artifact.theoryCoordinate = 0
    expect(await reapproveTheoremRecord(forged)).toEqual({ verdict: 'REJECT', code: 'proof-rejected' })
  })
})

async function projectionRecordRequest() {
  const core = await import('@mts/core')
  const memory = new core.Memory()
  const { R, O, C, L, U } = core.ensureRootBasis(memory)
  const producer = core.createStructuralProofProducer(memory)
  const theory = memory.ensure(C, U)
  const sequence = (values: readonly number[]) => producer.definePremiseOccurrenceSequence(values)
  const identityProof = (left: number, right: number, children: readonly number[]) =>
    memory.ensure(memory.ensure(left, right), sequence(children))

  const rootProof = identityProof(R, R, [])
  const oProof = identityProof(O, O, [rootProof])
  const cProof = identityProof(C, C, [rootProof])
  const lProof = identityProof(L, L, [oProof, cProof])
  const uProof = identityProof(U, U, [cProof, oProof])
  const left = memory.ensure(O, U)
  const right = memory.ensure(C, L)
  const leftProof = identityProof(left, left, [oProof, uProof])
  const rightProof = identityProof(right, right, [cProof, lProof])
  const relation = memory.ensure(left, right)
  const relationProof = identityProof(relation, relation, [leftProof, rightProof])

  let roleCursor = memory.ensure(L, R)
  const freshRole = () => (roleCursor = memory.ensure(roleCursor, R))
  const A = freshRole()
  const B = freshRole()
  const dictionary = producer.defineRoleDictionary([A, B])
  const relationTemplate = memory.ensure(A, B)
  const premiseTemplate = memory.ensure(relationTemplate, relationTemplate)
  const conclusionTemplate = memory.ensure(A, A)
  const rule = producer.defineRule(dictionary, conclusionTemplate)
  const schemaDerivationRule = producer.defineDerivationRule(rule, [premiseTemplate])
  const artifact = structuredClone(core.exportPortableProofSubAnetProjection(memory, {
    theory,
    schemaDerivationRule,
    premiseProofOccurrence: relationProof,
  }))
  const theoryArtifact = core.exportPortableStructuralTheory(memory, theory)

  return {
    artifact,
    expectedTheory: {
      artifact: theoryArtifact,
      revision: await core.computePortableStructuralTheoryRevision(theoryArtifact),
    },
  }
}

describe('theorem library portable projection record v0.2', () => {
  it('stores only replayable K1e evidence plus audit identity and snapshots caller data', async () => {
    const library: any = await import('../../src/core/theoremLibrary')
    const input = await projectionRecordRequest()
    const record = await library.createProofSubAnetProjectionTheoremRecord(input)

    expect(record.schema).toBe('aprover-theorem-record/v0.2')
    expect(record.consumer).toEqual(THEOREM_RECORD_CONSUMER)
    expect(record.proof).toEqual(input)
    expect(record.approval).toMatchObject({ semanticBase: 'mts-contract/v0.11' })
    expect(record.approval.contentDigest.value).toMatch(/^[0-9a-f]{64}$/)
    expect(record.proof).not.toHaveProperty('target')
    expect(record.approval).not.toHaveProperty('projectedOccurrence')
    expect(record.approval).not.toHaveProperty('projectedClaim')
    expect(record.approval).not.toHaveProperty('proved')

    ;(input.artifact as { theoryCoordinate: number }).theoryCoordinate = 0
    expect(record.proof.artifact.theoryCoordinate).not.toBe(0)
    expect(Object.isFrozen(record)).toBe(true)
  })

  it('fresh-reapproves stored K1e evidence every time instead of trusting storage metadata', async () => {
    const library: any = await import('../../src/core/theoremLibrary')
    const record = await library.createProofSubAnetProjectionTheoremRecord(
      await projectionRecordRequest(),
    )
    expect(await library.reapproveTheoremRecord(record)).toEqual({ verdict: 'ACCEPT', record })
    expect(await library.reapproveTheoremRecord(record)).toEqual({ verdict: 'ACCEPT', record })
  })

  it.each([
    ['top-level authority', (r: any) => ({ ...r, approved: true })],
    ['consumer identity', (r: any) => ({ ...r, consumer: { ...r.consumer, upstreamCommit: '0'.repeat(40) } })],
    ['stored digest', (r: any) => ({ ...r, approval: { ...r.approval, contentDigest: { ...r.approval.contentDigest, value: '0'.repeat(64) } } })],
    ['nested authority', (r: any) => ({ ...r, approval: { ...r.approval, projectedOccurrence: 1 } })],
    ['forged revision', (r: any) => ({
      ...r,
      proof: {
        ...r.proof,
        expectedTheory: {
          ...r.proof.expectedTheory,
          revision: { ...r.proof.expectedTheory.revision, value: '0'.repeat(64) },
        },
      },
    })],
    ['mutated artifact', (r: any) => ({
      ...r,
      proof: { ...r.proof, artifact: { ...r.proof.artifact, theoryCoordinate: 0 } },
    })],
  ])('fails closed for %s', async (_name, mutate) => {
    const library: any = await import('../../src/core/theoremLibrary')
    const record = await library.createProofSubAnetProjectionTheoremRecord(
      await projectionRecordRequest(),
    )
    expect((await library.reapproveTheoremRecord(mutate(clone(record)))).verdict).toBe('REJECT')
  })
})
