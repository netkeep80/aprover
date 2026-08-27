import {
  PORTABLE_MTS_SEMANTIC_BASE,
  PORTABLE_STRUCTURAL_DERIVATION_PROVENANCE_SCHEMA,
  PORTABLE_STRUCTURAL_DERIVATION_WITH_ASSUMPTIONS_PROVENANCE_SCHEMA,
  PORTABLE_STRUCTURAL_DERIVATION_WITH_THEOREMS_PROVENANCE_SCHEMA,
  computePortableStructuralDerivationProvenanceDigest,
  computePortableStructuralDerivationWithAssumptionsProvenanceDigest,
  computePortableStructuralDerivationWithTheoremsProvenanceDigest,
  replayPortableStructuralProof,
  verifyPortableStructuralDerivationProvenanceClaim,
  verifyPortableStructuralDerivationWithAssumptionsProvenanceClaim,
  verifyPortableStructuralDerivationWithTheoremsProvenanceClaim,
  verifyPortableStructuralProofTheoryRevision,
} from '@mts/core'

export interface PortableProofTargetSelection {
  readonly theoryCoordinate: number
  readonly targetOccurrenceCoordinate: number
  readonly claimCoordinate: number
}

export interface PortableProofExpectedTheory {
  readonly artifact: unknown
  readonly revision: unknown
}

export interface PortableProofApprovalRequest {
  readonly artifact: unknown
  readonly provenance: unknown
  readonly target: PortableProofTargetSelection
  readonly expectedTheory: PortableProofExpectedTheory
}

export type PortableProofApprovalRejectCode =
  | 'invalid-request'
  | 'theory-rejected'
  | 'proof-rejected'
  | 'provenance-rejected'
  | 'target-mismatch'

export interface PortableProofApprovalDigest {
  readonly scheme: string
  readonly value: string
}

export interface PortableProofAcceptance {
  readonly verdict: 'ACCEPT'
  readonly semanticBase: typeof PORTABLE_MTS_SEMANTIC_BASE
  readonly target: PortableProofTargetSelection
  readonly occurrenceCount: number
  readonly provenanceDigest: PortableProofApprovalDigest
}

export interface PortableProofRejection {
  readonly verdict: 'REJECT'
  readonly code: PortableProofApprovalRejectCode
}

export type PortableProofApprovalResult = PortableProofAcceptance | PortableProofRejection

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
  if (actual.length !== expected.length) return undefined
  return actual.every((key, index) => key === expected[index]) ? candidate : undefined
}

function coordinate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

function parseTarget(value: unknown): PortableProofTargetSelection | undefined {
  const target = exactRecord(value, [
    'theoryCoordinate',
    'targetOccurrenceCoordinate',
    'claimCoordinate',
  ])
  if (target === undefined) return undefined

  const theoryCoordinate = coordinate(target.theoryCoordinate)
  const targetOccurrenceCoordinate = coordinate(target.targetOccurrenceCoordinate)
  const claimCoordinate = coordinate(target.claimCoordinate)
  if (
    theoryCoordinate === undefined ||
    targetOccurrenceCoordinate === undefined ||
    claimCoordinate === undefined
  ) {
    return undefined
  }

  return Object.freeze({ theoryCoordinate, targetOccurrenceCoordinate, claimCoordinate })
}

function parseExpectedTheory(value: unknown): PortableProofExpectedTheory | undefined {
  const expectedTheory = exactRecord(value, ['artifact', 'revision'])
  if (expectedTheory === undefined) return undefined

  return Object.freeze({
    artifact: expectedTheory.artifact,
    revision: expectedTheory.revision,
  })
}

function parseRequest(value: unknown): PortableProofApprovalRequest | undefined {
  const request = exactRecord(value, ['artifact', 'provenance', 'target', 'expectedTheory'])
  if (request === undefined) return undefined
  const target = parseTarget(request.target)
  const expectedTheory = parseExpectedTheory(request.expectedTheory)
  if (target === undefined || expectedTheory === undefined) return undefined

  return Object.freeze({
    artifact: request.artifact,
    provenance: request.provenance,
    target,
    expectedTheory,
  })
}

function artifactTarget(artifact: unknown): PortableProofTargetSelection | undefined {
  const envelope = record(artifact)
  if (envelope === undefined) return undefined

  const theoryCoordinate = coordinate(envelope.theoryCoordinate)
  const targetOccurrenceCoordinate = coordinate(envelope.targetOccurrenceCoordinate)
  if (theoryCoordinate === undefined || targetOccurrenceCoordinate === undefined) return undefined
  if (!Array.isArray(envelope.nodes)) return undefined

  for (const candidate of envelope.nodes) {
    const node = record(candidate)
    if (node === undefined || coordinate(node.occurrence) !== targetOccurrenceCoordinate) continue
    const judgmentEvidence = record(node.judgment)
    const judgment = judgmentEvidence === undefined ? undefined : record(judgmentEvidence.judgment)
    const claimCoordinate = judgment === undefined ? undefined : coordinate(judgment.claim)
    if (claimCoordinate === undefined) return undefined
    return Object.freeze({ theoryCoordinate, targetOccurrenceCoordinate, claimCoordinate })
  }

  return undefined
}

function sameTarget(
  left: PortableProofTargetSelection,
  right: PortableProofTargetSelection,
): boolean {
  return (
    left.theoryCoordinate === right.theoryCoordinate &&
    left.targetOccurrenceCoordinate === right.targetOccurrenceCoordinate &&
    left.claimCoordinate === right.claimCoordinate
  )
}

function occurrenceCount(replay: ReturnType<typeof replayPortableStructuralProof>): number {
  return 'derivation' in replay.replay
    ? replay.replay.derivation.occurrenceCount
    : replay.replay.occurrenceCount
}

async function verifyProvenance(
  artifact: unknown,
  provenance: unknown,
): Promise<PortableProofApprovalDigest | undefined> {
  const envelope = record(provenance)
  if (envelope === undefined) return undefined

  try {
    if (envelope.schema === PORTABLE_STRUCTURAL_DERIVATION_PROVENANCE_SCHEMA) {
      const claim = await verifyPortableStructuralDerivationProvenanceClaim(artifact, provenance)
      return Object.freeze(await computePortableStructuralDerivationProvenanceDigest(claim))
    }
    if (envelope.schema === PORTABLE_STRUCTURAL_DERIVATION_WITH_ASSUMPTIONS_PROVENANCE_SCHEMA) {
      const claim = await verifyPortableStructuralDerivationWithAssumptionsProvenanceClaim(
        artifact,
        provenance,
      )
      return Object.freeze(
        await computePortableStructuralDerivationWithAssumptionsProvenanceDigest(claim),
      )
    }
    if (envelope.schema === PORTABLE_STRUCTURAL_DERIVATION_WITH_THEOREMS_PROVENANCE_SCHEMA) {
      const claim = await verifyPortableStructuralDerivationWithTheoremsProvenanceClaim(
        artifact,
        provenance,
      )
      return Object.freeze(
        await computePortableStructuralDerivationWithTheoremsProvenanceDigest(claim),
      )
    }
  } catch {
    return undefined
  }

  return undefined
}

function reject(code: PortableProofApprovalRejectCode): PortableProofRejection {
  return Object.freeze({ verdict: 'REJECT', code })
}

/**
 * Consumer-owned trusted boundary only. Proof truth stays in the exact accepted
 * @mts/core portable replay kernel; provenance can bind origin but cannot make
 * invalid proof evidence true. Portable coordinates select the exact proved
 * target only after successful replay and provenance verification.
 */
export async function approvePortableStructuralProof(
  input: unknown,
): Promise<PortableProofApprovalResult> {
  const request = parseRequest(input)
  if (request === undefined) return reject('invalid-request')

  try {
    await verifyPortableStructuralProofTheoryRevision(
      request.artifact,
      request.expectedTheory.artifact,
      request.expectedTheory.revision,
    )
  } catch {
    return reject('theory-rejected')
  }

  let replay: ReturnType<typeof replayPortableStructuralProof>
  try {
    replay = replayPortableStructuralProof(request.artifact)
  } catch {
    return reject('proof-rejected')
  }

  const provenanceDigest = await verifyProvenance(request.artifact, request.provenance)
  if (provenanceDigest === undefined) return reject('provenance-rejected')

  const provedTarget = artifactTarget(request.artifact)
  if (provedTarget === undefined) return reject('proof-rejected')
  if (!sameTarget(provedTarget, request.target)) return reject('target-mismatch')

  return Object.freeze({
    verdict: 'ACCEPT',
    semanticBase: PORTABLE_MTS_SEMANTIC_BASE,
    target: request.target,
    occurrenceCount: occurrenceCount(replay),
    provenanceDigest,
  })
}
