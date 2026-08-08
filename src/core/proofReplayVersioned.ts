import {
  MTS_PROOF_SCHEMA,
  checkProof,
  parseProofObject,
  type MtsProofObjectV02,
} from './proofReplay'
import {
  MTS_PROOF_SCHEMA_V03,
  checkProofV03,
  parseProofObjectV03,
  type MtsProofObjectV03,
} from './proofReplayV03'

export type VersionedProofObject = MtsProofObjectV02 | MtsProofObjectV03

export type ProofReplayVersion = typeof MTS_PROOF_SCHEMA | typeof MTS_PROOF_SCHEMA_V03

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function detectProofVersion(value: unknown): ProofReplayVersion | null {
  const source = objectRecord(value)
  if (source === null) return null
  if (source.schema === MTS_PROOF_SCHEMA) return MTS_PROOF_SCHEMA
  if (source.proofVersion === MTS_PROOF_SCHEMA_V03) return MTS_PROOF_SCHEMA_V03
  return null
}

export function parseVersionedProofObject(value: unknown): VersionedProofObject {
  const version = detectProofVersion(value)
  if (version === MTS_PROOF_SCHEMA) return parseProofObject(value)
  if (version === MTS_PROOF_SCHEMA_V03) return parseProofObjectV03(value)
  throw new Error('unsupported MTS proof artifact version')
}

export function checkVersionedProof(value: unknown): boolean {
  try {
    const proof = parseVersionedProofObject(value)
    return 'schema' in proof ? checkProof(proof) : checkProofV03(proof)
  } catch {
    return false
  }
}
