import {
  approvePortableStructuralProof,
  type PortableProofApprovalDigest,
  type PortableProofApprovalRequest,
  type PortableProofExpectedTheory,
  type PortableProofTargetSelection,
} from './proofApproval'

export const THEOREM_RECORD_SCHEMA = 'aprover-theorem-record/v0.1' as const

export const THEOREM_RECORD_CONSUMER = Object.freeze({
  repository: 'netkeep80/anum_docs',
  upstreamCommit: 'ca4ecc7245c5a5562837881bef6d7e9da2fa1833',
  semanticBase: 'mts-contract/v0.11',
  packageName: '@mts/core',
  packageVersion: '0.10.0',
  artifactSha256: 'd4536964667711c6e59cf6b7d073dc09a4603a9dbbc76af05089dd4fa04b57e5',
})

export interface TheoremRecordConsumerV01 {
  readonly repository: string
  readonly upstreamCommit: string
  readonly semanticBase: string
  readonly packageName: string
  readonly packageVersion: string
  readonly artifactSha256: string
}

export type TheoremRecordProofV01 = PortableProofApprovalRequest

export interface TheoremRecordApprovalV01 {
  readonly semanticBase: string
  readonly occurrenceCount: number
  readonly provenanceDigest: PortableProofApprovalDigest
}

export interface TheoremRecordV01 {
  readonly schema: typeof THEOREM_RECORD_SCHEMA
  readonly consumer: TheoremRecordConsumerV01
  readonly proof: TheoremRecordProofV01
  readonly approval: TheoremRecordApprovalV01
}

export type TheoremRecordRejectionCode =
  | 'invalid-record'
  | 'consumer-mismatch'
  | 'proof-rejected'
  | 'approval-mismatch'

export type TheoremRecordReapproval =
  | { readonly verdict: 'ACCEPT'; readonly record: TheoremRecordV01 }
  | { readonly verdict: 'REJECT'; readonly code: TheoremRecordRejectionCode }

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined
}

function exactRecord(value: unknown, keys: readonly string[]): UnknownRecord | undefined {
  const candidate = record(value)
  if (candidate === undefined) return undefined
  const actual = Object.keys(candidate).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? candidate
    : undefined
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

function exactString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseTarget(value: unknown): PortableProofTargetSelection | undefined {
  const target = exactRecord(value, ['theoryCoordinate', 'targetOccurrenceCoordinate', 'claimCoordinate'])
  if (target === undefined) return undefined
  const theoryCoordinate = nonNegativeInteger(target.theoryCoordinate)
  const targetOccurrenceCoordinate = nonNegativeInteger(target.targetOccurrenceCoordinate)
  const claimCoordinate = nonNegativeInteger(target.claimCoordinate)
  if (theoryCoordinate === undefined || targetOccurrenceCoordinate === undefined || claimCoordinate === undefined) {
    return undefined
  }
  return { theoryCoordinate, targetOccurrenceCoordinate, claimCoordinate }
}

function parseExpectedTheory(value: unknown): PortableProofExpectedTheory | undefined {
  const expectedTheory = exactRecord(value, ['artifact', 'revision'])
  if (expectedTheory === undefined) return undefined
  return { artifact: expectedTheory.artifact, revision: expectedTheory.revision }
}

function parseConsumer(value: unknown): TheoremRecordConsumerV01 | undefined {
  const consumer = exactRecord(value, [
    'repository', 'upstreamCommit', 'semanticBase', 'packageName', 'packageVersion', 'artifactSha256',
  ])
  if (consumer === undefined) return undefined
  const parsed = {
    repository: exactString(consumer.repository),
    upstreamCommit: exactString(consumer.upstreamCommit),
    semanticBase: exactString(consumer.semanticBase),
    packageName: exactString(consumer.packageName),
    packageVersion: exactString(consumer.packageVersion),
    artifactSha256: exactString(consumer.artifactSha256),
  }
  return Object.values(parsed).every(value => value !== undefined)
    ? (parsed as TheoremRecordConsumerV01)
    : undefined
}

function parseDigest(value: unknown): PortableProofApprovalDigest | undefined {
  const digest = exactRecord(value, ['scheme', 'value'])
  if (digest === undefined) return undefined
  const scheme = exactString(digest.scheme)
  const digestValue = exactString(digest.value)
  return scheme !== undefined && digestValue !== undefined ? { scheme, value: digestValue } : undefined
}

function parseRecord(value: unknown): TheoremRecordV01 | undefined {
  const root = exactRecord(value, ['schema', 'consumer', 'proof', 'approval'])
  if (root === undefined || root.schema !== THEOREM_RECORD_SCHEMA) return undefined
  const consumer = parseConsumer(root.consumer)
  const proof = exactRecord(root.proof, ['artifact', 'provenance', 'target', 'expectedTheory'])
  const approval = exactRecord(root.approval, ['semanticBase', 'occurrenceCount', 'provenanceDigest'])
  if (consumer === undefined || proof === undefined || approval === undefined) return undefined
  const target = parseTarget(proof.target)
  const expectedTheory = parseExpectedTheory(proof.expectedTheory)
  const semanticBase = exactString(approval.semanticBase)
  const occurrenceCount = nonNegativeInteger(approval.occurrenceCount)
  const provenanceDigest = parseDigest(approval.provenanceDigest)
  if (
    target === undefined ||
    expectedTheory === undefined ||
    semanticBase === undefined ||
    occurrenceCount === undefined ||
    provenanceDigest === undefined
  ) {
    return undefined
  }
  return {
    schema: THEOREM_RECORD_SCHEMA,
    consumer,
    proof: { artifact: proof.artifact, provenance: proof.provenance, target, expectedTheory },
    approval: { semanticBase, occurrenceCount, provenanceDigest },
  }
}

function sameConsumer(value: TheoremRecordConsumerV01): boolean {
  return Object.entries(THEOREM_RECORD_CONSUMER).every(
    ([key, expected]) => value[key as keyof TheoremRecordConsumerV01] === expected,
  )
}

function sameApproval(
  stored: TheoremRecordApprovalV01,
  fresh: { semanticBase: string; occurrenceCount: number; provenanceDigest: PortableProofApprovalDigest },
): boolean {
  return stored.semanticBase === fresh.semanticBase
    && stored.occurrenceCount === fresh.occurrenceCount
    && stored.provenanceDigest.scheme === fresh.provenanceDigest.scheme
    && stored.provenanceDigest.value === fresh.provenanceDigest.value
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return value
}

function snapshot<T>(value: T): T {
  return deepFreeze(structuredClone(value))
}

export async function createTheoremRecord(input: PortableProofApprovalRequest): Promise<TheoremRecordV01> {
  const accepted = await approvePortableStructuralProof(input)
  if (accepted.verdict !== 'ACCEPT') throw new Error(`proof approval rejected: ${accepted.code}`)
  return snapshot({
    schema: THEOREM_RECORD_SCHEMA,
    consumer: THEOREM_RECORD_CONSUMER,
    proof: input,
    approval: {
      semanticBase: accepted.semanticBase,
      occurrenceCount: accepted.occurrenceCount,
      provenanceDigest: accepted.provenanceDigest,
    },
  })
}

export async function reapproveTheoremRecord(input: unknown): Promise<TheoremRecordReapproval> {
  const parsed = parseRecord(input)
  if (parsed === undefined) return { verdict: 'REJECT', code: 'invalid-record' }
  if (!sameConsumer(parsed.consumer)) return { verdict: 'REJECT', code: 'consumer-mismatch' }

  const fresh = await approvePortableStructuralProof(parsed.proof)
  if (fresh.verdict !== 'ACCEPT') return { verdict: 'REJECT', code: 'proof-rejected' }
  if (!sameApproval(parsed.approval, fresh)) return { verdict: 'REJECT', code: 'approval-mismatch' }

  return { verdict: 'ACCEPT', record: snapshot(parsed) }
}
