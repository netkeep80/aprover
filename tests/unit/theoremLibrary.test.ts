import { readFile } from 'node:fs/promises'

import { createPortableStructuralDerivationProvenanceClaim } from '@mts/core'
import { describe, expect, it } from 'vitest'

import {
  CURRENT_THEOREM_CONSUMER,
  THEOREM_RECORD_SCHEMA,
  createTheoremRecord,
  reapproveTheoremRecord,
} from '../../src/core/theoremLibrary'

const VALID_ARTIFACT = {
  schema: 'mts-portable-structural-derivation/v0.2',
  mtsSemanticBase: 'mts-contract/v0.11',
  topology: {
    schema: 'mts-storage-topology/v0.1',
    root: 0,
    links: [
      [0, 0], [1, 0], [0, 2], [2, 1], [3, 0], [4, 0], [5, 0], [5, 6],
      [6, 0], [4, 7], [8, 0], [8, 10], [10, 0], [13, 11], [0, 12], [12, 0],
      [16, 14], [12, 15], [18, 16], [18, 12], [18, 13], [6, 19], [9, 20], [19, 0],
      [24, 22], [6, 23], [15, 24], [24, 17],
    ],
  },
  theoryCoordinate: 6,
  targetOccurrenceCoordinate: 26,
  nodes: [{
    occurrence: 26,
    judgment: {
      application: {
        act: 24,
        rule: 19,
        ruleAdmission: 21,
        claimedBody: 15,
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

const SOURCE = {
  locator: 'https://github.com/leanprover-community/mathlib4',
  revision: '0123456789abcdef0123456789abcdef01234567',
  subject: 'Mathlib.Example.theorem',
} as const

const PRODUCER = { id: 'mts-proof-importer', version: '0.1.0' } as const
const TARGET = { theoryCoordinate: 6, targetOccurrenceCoordinate: 26, claimCoordinate: 15 }

async function provenanceFor(artifact: unknown = VALID_ARTIFACT) {
  return createPortableStructuralDerivationProvenanceClaim(artifact, SOURCE, PRODUCER)
}

async function acceptedRecord() {
  const created = await createTheoremRecord({
    artifact: VALID_ARTIFACT,
    provenance: await provenanceFor(),
    target: TARGET,
  })
  expect(created.verdict).toBe('ACCEPT')
  if (created.verdict !== 'ACCEPT') throw new Error(`unexpected ${created.code}`)
  return created.record
}

describe('R3.1 replayable theorem record', () => {
  it('pins v0.1 record identity to the canonical accepted consumer lock', async () => {
    const lock = JSON.parse(
      await readFile(new URL('../../contracts/mts-core-consumer-lock.json', import.meta.url), 'utf8'),
    ) as {
      repository: string
      commit: string
      accepted: { contract: { schema: string } }
      package: { name: string; version: string; sha256: string }
    }

    expect(THEOREM_RECORD_SCHEMA).toBe('aprover-theorem-record/v0.1')
    expect(CURRENT_THEOREM_CONSUMER).toEqual({
      repository: lock.repository,
      upstreamCommit: lock.commit,
      semanticBase: lock.accepted.contract.schema,
      packageName: lock.package.name,
      packageVersion: lock.package.version,
      artifactSha256: lock.package.sha256,
    })
  })

  it('creates a record only from accepted proof evidence and snapshots caller state', async () => {
    const artifact = structuredClone(VALID_ARTIFACT) as unknown as { theoryCoordinate: number }
    const provenance = await provenanceFor(artifact)
    const target = { ...TARGET }
    const created = await createTheoremRecord({ artifact, provenance, target })

    expect(created.verdict).toBe('ACCEPT')
    if (created.verdict !== 'ACCEPT') return
    expect(created.record).toMatchObject({
      schema: THEOREM_RECORD_SCHEMA,
      consumer: CURRENT_THEOREM_CONSUMER,
      proof: { target: TARGET },
      approval: { semanticBase: 'mts-contract/v0.11', occurrenceCount: 1 },
    })
    expect(created.record.approval.provenanceDigest.value).toMatch(/^[0-9a-f]{64}$/)

    artifact.theoryCoordinate = 0
    target.claimCoordinate = 0
    const storedArtifact = created.record.proof.artifact as { theoryCoordinate?: number }
    expect(storedArtifact.theoryCoordinate).toBe(6)
    expect(created.record.proof.target).toEqual(TARGET)
    expect(Object.isFrozen(created.record)).toBe(true)
    expect(Object.isFrozen(created.record.consumer)).toBe(true)
    expect(Object.isFrozen(created.record.proof)).toBe(true)
    expect(Object.isFrozen(created.record.proof.artifact as object)).toBe(true)
    expect(Object.isFrozen(created.record.proof.target)).toBe(true)
    expect(Object.isFrozen(created.record.approval)).toBe(true)
  })

  it('reapproves every stored record and reproduces the recorded audit deterministically', async () => {
    const record = await acceptedRecord()
    const first = await reapproveTheoremRecord(record)
    const second = await reapproveTheoremRecord(record)

    expect(first.verdict).toBe('ACCEPT')
    expect(second.verdict).toBe('ACCEPT')
    if (first.verdict === 'ACCEPT' && second.verdict === 'ACCEPT') {
      expect(first.approval).toEqual(record.approval)
      expect(second.approval).toEqual(first.approval)
      expect(first.record).toEqual(record)
    }
  })

  it('does not create a theorem record for rejected proof evidence', async () => {
    const forged = { ...VALID_ARTIFACT, theoryCoordinate: 0 }
    const created = await createTheoremRecord({
      artifact: forged,
      provenance: await provenanceFor(forged),
      target: TARGET,
    })
    expect(created).toEqual({ verdict: 'REJECT', code: 'proof-rejected' })
  })

  it.each([
    ['upstream commit', { upstreamCommit: '0'.repeat(40) }],
    ['semantic base', { semanticBase: 'mts-contract/v999' }],
    ['artifact digest', { artifactSha256: '0'.repeat(64) }],
  ])('rejects a stored record with mismatched consumer %s', async (_label, mutation) => {
    const record = structuredClone(await acceptedRecord())
    Object.assign(record.consumer, mutation)
    expect(await reapproveTheoremRecord(record)).toEqual({
      verdict: 'REJECT',
      code: 'consumer-lock-mismatch',
    })
  })

  it.each([
    ['approval semantic base', { semanticBase: 'mts-contract/v999' }],
    ['occurrence count', { occurrenceCount: 999 }],
  ])('rejects changed stored %s even when the proof itself remains valid', async (_label, mutation) => {
    const record = structuredClone(await acceptedRecord())
    Object.assign(record.approval, mutation)
    expect(await reapproveTheoremRecord(record)).toEqual({
      verdict: 'REJECT',
      code: 'approval-mismatch',
    })
  })

  it('rejects a changed stored provenance digest instead of treating it as truth', async () => {
    const record = structuredClone(await acceptedRecord())
    record.approval.provenanceDigest.value = '0'.repeat(64)
    expect(await reapproveTheoremRecord(record)).toEqual({
      verdict: 'REJECT',
      code: 'approval-mismatch',
    })
  })

  it.each([
    ['target', (record: Record<string, unknown>) => {
      const proof = record.proof as { target: { claimCoordinate: number } }
      proof.target.claimCoordinate = 14
    }, 'target-mismatch'],
    ['artifact', (record: Record<string, unknown>) => {
      const proof = record.proof as { artifact: { theoryCoordinate: number } }
      proof.artifact.theoryCoordinate = 0
    }, 'proof-rejected'],
    ['provenance', (record: Record<string, unknown>) => {
      const proof = record.proof as { provenance: { contentDigest: { value: string } } }
      proof.provenance.contentDigest.value = '0'.repeat(64)
    }, 'provenance-rejected'],
  ] as const)('replays and rejects forged stored %s evidence', async (_label, mutate, code) => {
    const record = structuredClone(await acceptedRecord()) as unknown as Record<string, unknown>
    mutate(record)
    expect(await reapproveTheoremRecord(record)).toEqual({ verdict: 'REJECT', code })
  })

  it.each(['approved', 'trusted', 'callback', 'opcode', 'tactic']) (
    'rejects extra host authority field %s',
    async field => {
      const record = structuredClone(await acceptedRecord()) as unknown as Record<string, unknown>
      record[field] = true
      expect(await reapproveTheoremRecord(record)).toEqual({
        verdict: 'REJECT',
        code: 'invalid-record',
      })
    },
  )

  it('rejects unknown schema and nested consumer authority fail closed', async () => {
    const wrongSchema = structuredClone(await acceptedRecord())
    wrongSchema.schema = 'aprover-theorem-record/v999' as typeof wrongSchema.schema
    expect(await reapproveTheoremRecord(wrongSchema)).toEqual({
      verdict: 'REJECT',
      code: 'invalid-record',
    })

    const nested = structuredClone(await acceptedRecord()) as unknown as Record<string, unknown>
    const consumer = nested.consumer as Record<string, unknown>
    consumer.trusted = true
    expect(await reapproveTheoremRecord(nested)).toEqual({
      verdict: 'REJECT',
      code: 'invalid-record',
    })
  })
})
