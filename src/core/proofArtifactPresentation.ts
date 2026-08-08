import {
  ProofObjectValidationError,
  checkInterpretProofStep,
  checkProof,
  parseProofJson,
  type MtsProofObjectV02,
} from './proofReplay'
import { formatOccurrencePath } from './interpretationPresentation'
import type { ContextFrame } from './interpreter'

export interface ProofContextView {
  readonly depth: number
  readonly start: number
  readonly end: number
}

export interface ProofSubstitutionView {
  readonly occurrence: string
  readonly link: number
}

export interface ProofAliasView {
  readonly occurrence: string
  readonly target: string
}

export interface ProofStepReplayView {
  readonly index: number
  readonly rule: 'interpret'
  readonly expression: string
  readonly accepted: boolean
  readonly context: readonly ProofContextView[]
  readonly substitutions: readonly ProofSubstitutionView[]
  readonly aliases: readonly ProofAliasView[]
  readonly symbolCount: number
  readonly distinguishedLinkCount: number
}

export interface EmptyProofArtifactView {
  readonly status: 'empty'
}

export interface InvalidProofArtifactView {
  readonly status: 'invalid'
  readonly error: string
  readonly errorPath?: string
}

export interface ReplayedProofArtifactView {
  readonly status: 'accepted' | 'rejected'
  readonly schema: string
  readonly contractVersion: string
  readonly accepted: boolean
  readonly steps: readonly ProofStepReplayView[]
}

export type ProofArtifactView =
  | EmptyProofArtifactView
  | InvalidProofArtifactView
  | ReplayedProofArtifactView

function contextView(frame: ContextFrame): ProofContextView[] {
  const result: ProofContextView[] = []
  let current: ContextFrame | undefined = frame
  let depth = 0
  while (current) {
    result.push({ depth, start: current.start, end: current.end })
    current = current.parent
    depth += 1
  }
  return result
}

function replaySteps(proof: MtsProofObjectV02): ProofStepReplayView[] {
  return proof.steps.map((step, index) => ({
    index: index + 1,
    rule: step.rule,
    expression: step.expression,
    accepted: checkInterpretProofStep(step),
    context: contextView(step.context),
    substitutions: step.expected.substitutions.map(item => ({
      occurrence: formatOccurrencePath(item.path),
      link: item.link,
    })),
    aliases: step.expected.aliases.map(item => ({
      occurrence: formatOccurrencePath(item.path),
      target: formatOccurrencePath(item.targetPath),
    })),
    symbolCount: Object.keys(step.symbols ?? {}).length,
    distinguishedLinkCount: step.distinguishedMemory?.length ?? 0,
  }))
}

/**
 * Build a presentation-only view from an untrusted proof JSON artifact.
 *
 * Validation and replay remain delegated to proofReplay.ts. This function only
 * shapes already validated/replayed data for application presentation.
 */
export function presentProofArtifactJson(source: string): ProofArtifactView {
  if (!source.trim()) return { status: 'empty' }

  try {
    const proof = parseProofJson(source)
    const steps = replaySteps(proof)
    const accepted = checkProof(proof)
    return {
      status: accepted ? 'accepted' : 'rejected',
      schema: proof.schema,
      contractVersion: proof.contractVersion,
      accepted,
      steps,
    }
  } catch (cause) {
    if (cause instanceof ProofObjectValidationError) {
      return { status: 'invalid', error: cause.message, errorPath: cause.path }
    }
    return {
      status: 'invalid',
      error: cause instanceof Error ? cause.message : 'Unknown proof artifact error',
    }
  }
}
