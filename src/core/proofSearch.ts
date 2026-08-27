import {
  approvePortableStructuralProof,
  type PortableProofAcceptance,
  type PortableProofApprovalRequest,
} from './proofApproval'

export interface PortableProofSearchBounds {
  readonly maxCandidates: number
  readonly maxDepth: number
}

export interface PortableProofSearchMetrics {
  readonly strategy: 'fifo-bfs'
  readonly exploredCandidates: number
  readonly rejectedCandidates: number
  readonly maxDepthReached: number
  readonly candidateFound: boolean
}

export type PortableProofSearchExpand = (
  candidate: PortableProofApprovalRequest,
  depth: number,
) =>
  | readonly PortableProofApprovalRequest[]
  | Promise<readonly PortableProofApprovalRequest[]>

export interface PortableProofSearchRequest {
  readonly seeds: readonly PortableProofApprovalRequest[]
  readonly expand: PortableProofSearchExpand
  readonly bounds: PortableProofSearchBounds
}

export interface PortableProofSearchFound {
  readonly status: 'FOUND'
  readonly candidate: PortableProofApprovalRequest
  readonly approval: PortableProofAcceptance
  readonly metrics: PortableProofSearchMetrics
}

export interface PortableProofSearchNotFound {
  readonly status: 'NOT_FOUND_WITHIN_BOUNDS'
  readonly reason: 'exhausted' | 'candidate-budget'
  readonly metrics: PortableProofSearchMetrics
}

export type PortableProofSearchResult = PortableProofSearchFound | PortableProofSearchNotFound

interface QueuedCandidate {
  readonly candidate: PortableProofApprovalRequest
  readonly depth: number
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
}

function nonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`)
}

function metrics(
  exploredCandidates: number,
  rejectedCandidates: number,
  maxDepthReached: number,
  candidateFound: boolean,
): PortableProofSearchMetrics {
  return Object.freeze({
    strategy: 'fifo-bfs' as const,
    exploredCandidates,
    rejectedCandidates,
    maxDepthReached,
    candidateFound,
  })
}

/**
 * Deterministic consumer-side search orchestration only.
 *
 * Candidate generation and ordering are intentionally untrusted. A search hit
 * exists only when the existing trusted approval boundary freshly accepts the
 * complete portable candidate evidence. Exhaustion therefore reports only an
 * operational bounded miss, never mathematical falsehood.
 */
export async function searchPortableStructuralProof(
  input: PortableProofSearchRequest,
): Promise<PortableProofSearchResult> {
  positiveInteger(input.bounds.maxCandidates, 'maxCandidates')
  nonNegativeInteger(input.bounds.maxDepth, 'maxDepth')

  const queue: QueuedCandidate[] = input.seeds.map(candidate => ({ candidate, depth: 0 }))
  let cursor = 0
  let exploredCandidates = 0
  let rejectedCandidates = 0
  let maxDepthReached = 0

  while (cursor < queue.length) {
    if (exploredCandidates >= input.bounds.maxCandidates) {
      return Object.freeze({
        status: 'NOT_FOUND_WITHIN_BOUNDS' as const,
        reason: 'candidate-budget' as const,
        metrics: metrics(exploredCandidates, rejectedCandidates, maxDepthReached, false),
      })
    }

    const current = queue[cursor++]
    exploredCandidates += 1
    maxDepthReached = Math.max(maxDepthReached, current.depth)

    const approval = await approvePortableStructuralProof(current.candidate)
    if (approval.verdict === 'ACCEPT') {
      return Object.freeze({
        status: 'FOUND' as const,
        candidate: current.candidate,
        approval,
        metrics: metrics(exploredCandidates, rejectedCandidates, maxDepthReached, true),
      })
    }

    rejectedCandidates += 1
    if (current.depth >= input.bounds.maxDepth) continue

    const children = await input.expand(current.candidate, current.depth)
    for (const candidate of children) {
      queue.push({ candidate, depth: current.depth + 1 })
    }
  }

  return Object.freeze({
    status: 'NOT_FOUND_WITHIN_BOUNDS' as const,
    reason: 'exhausted' as const,
    metrics: metrics(exploredCandidates, rejectedCandidates, maxDepthReached, false),
  })
}
