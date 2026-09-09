import {
  approvePortableProofSubAnetProjection,
  approvePortableStructuralProof,
  type PortableProofApprovalDigest,
  type PortableProofApprovalRequest,
  type PortableProofExpectedTheory,
  type PortableProofSubAnetProjectionApprovalRequest,
  type PortableProofTargetSelection,
} from './proofApproval'

export const THEOREM_RECORD_SCHEMA = 'aprover-theorem-record/v0.1' as const
export const THEOREM_PROJECTION_RECORD_SCHEMA = 'aprover-theorem-record/v0.2' as const

export const THEOREM_RECORD_CONSUMER = Object.freeze({
  repository: 'netkeep80/anum_docs',
  upstreamCommit: 'd3714a3f209567109412cea5687e2d6d011d9ebc',
  semanticBase: 'mts-contract/v0.11',
  packageName: '@mts/core',
  packageVersion: '0.10.0',
  artifactSha256: '638abe4247a300686f37018378985208dd88a59b0608be41177138899199187d',
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

export type TheoremProjectionRecordProofV02 = PortableProofSubAnetProjectionApprovalRequest

export interface TheoremProjectionRecordApprovalV02 {
  readonly semanticBase: string
  readonly contentDigest: PortableProofApprovalDigest
}

export interface TheoremProjectionRecordV02 {
  readonly schema: typeof THEOREM_PROJECTION_RECORD_SCHEMA
  readonly consumer: TheoremRecordConsumerV01
  readonly proof: TheoremProjectionRecordProofV02
  readonly approval: TheoremProjectionRecordApprovalV02
}

export type TheoremRecord = TheoremRecordV01 | TheoremProjectionRecordV02

export type TheoremRecordRejectionCode =
  | 'invalid-record'
  | 'consumer-mismatch'
  | 'proof-rejected'
  | 'approval-mismatch'

export type TheoremRecordReapproval =
  | { readonly verdict: 'ACCEPT'; readonly record: TheoremRecord }
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

function parseRecordV01(value: unknown): TheoremRecordV01 | undefined {
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

function parseProjectionRecordV02(value: unknown): TheoremProjectionRecordV02 | undefined {
  const root = exactRecord(value, ['schema', 'consumer', 'proof', 'approval'])
  if (root === undefined || root.schema !== THEOREM_PROJECTION_RECORD_SCHEMA) return undefined
  const consumer = parseConsumer(root.consumer)
  const proof = exactRecord(root.proof, ['artifact', 'expectedTheory'])
  const approval = exactRecord(root.approval, ['semanticBase', 'contentDigest'])
  if (consumer === undefined || proof === undefined || approval === undefined) return undefined
  const expectedTheory = parseExpectedTheory(proof.expectedTheory)
  const semanticBase = exactString(approval.semanticBase)
  const contentDigest = parseDigest(approval.contentDigest)
  if (expectedTheory === undefined || semanticBase === undefined || contentDigest === undefined) {
    return undefined
  }
  return {
    schema: THEOREM_PROJECTION_RECORD_SCHEMA,
    consumer,
    proof: { artifact: proof.artifact, expectedTheory },
    approval: { semanticBase, contentDigest },
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

function sameProjectionApproval(
  stored: TheoremProjectionRecordApprovalV02,
  fresh: { semanticBase: string; contentDigest: PortableProofApprovalDigest },
): boolean {
  return stored.semanticBase === fresh.semanticBase
    && stored.contentDigest.scheme === fresh.contentDigest.scheme
    && stored.contentDigest.value === fresh.contentDigest.value
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

export async function createProofSubAnetProjectionTheoremRecord(
  input: PortableProofSubAnetProjectionApprovalRequest,
): Promise<TheoremProjectionRecordV02> {
  const accepted = await approvePortableProofSubAnetProjection(input)
  if (accepted.verdict !== 'ACCEPT') throw new Error(`projection approval rejected: ${accepted.code}`)
  return snapshot({
    schema: THEOREM_PROJECTION_RECORD_SCHEMA,
    consumer: THEOREM_RECORD_CONSUMER,
    proof: input,
    approval: {
      semanticBase: accepted.semanticBase,
      contentDigest: accepted.contentDigest,
    },
  })
}

export async function reapproveTheoremRecord(input: unknown): Promise<TheoremRecordReapproval> {
  const root = record(input)
  if (root === undefined) return { verdict: 'REJECT', code: 'invalid-record' }

  if (root.schema === THEOREM_RECORD_SCHEMA) {
    const parsed = parseRecordV01(input)
    if (parsed === undefined) return { verdict: 'REJECT', code: 'invalid-record' }
    if (!sameConsumer(parsed.consumer)) return { verdict: 'REJECT', code: 'consumer-mismatch' }

    const fresh = await approvePortableStructuralProof(parsed.proof)
    if (fresh.verdict !== 'ACCEPT') return { verdict: 'REJECT', code: 'proof-rejected' }
    if (!sameApproval(parsed.approval, fresh)) return { verdict: 'REJECT', code: 'approval-mismatch' }
    return { verdict: 'ACCEPT', record: snapshot(parsed) }
  }

  if (root.schema === THEOREM_PROJECTION_RECORD_SCHEMA) {
    const parsed = parseProjectionRecordV02(input)
    if (parsed === undefined) return { verdict: 'REJECT', code: 'invalid-record' }
    if (!sameConsumer(parsed.consumer)) return { verdict: 'REJECT', code: 'consumer-mismatch' }

    const fresh = await approvePortableProofSubAnetProjection(parsed.proof)
    if (fresh.verdict !== 'ACCEPT') return { verdict: 'REJECT', code: 'proof-rejected' }
    if (!sameProjectionApproval(parsed.approval, fresh)) {
      return { verdict: 'REJECT', code: 'approval-mismatch' }
    }
    return { verdict: 'ACCEPT', record: snapshot(parsed) }
  }

  return { verdict: 'REJECT', code: 'invalid-record' }
}
