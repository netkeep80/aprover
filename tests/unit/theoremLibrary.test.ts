import { describe, expect, it } from 'vitest'
import { createPortableStructuralDerivationProvenanceClaim } from '@mts/core'
import consumerLock from '../../contracts/mts-core-consumer-lock.json'
import {
  createTheoremRecord,
  reapproveTheoremRecord,
  THEOREM_RECORD_SCHEMA,
  THEOREM_RECORD_CONSUMER,
} from '../../src/core/theoremLibrary'

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

async function request() {
  const artifact = structuredClone(ARTIFACT)
  return {
    artifact,
    provenance: await createPortableStructuralDerivationProvenanceClaim(artifact, SOURCE, PRODUCER),
    target: TARGET,
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe('theorem library record v0.1', () => {
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
