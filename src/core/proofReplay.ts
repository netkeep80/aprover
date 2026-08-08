import { parseExpr } from './parser'
import { InterpretationSession } from './interpretationSession'
import type { ContextFrame, InterpretationAlias, InterpretationSubstitution } from './interpreter'
import type { DistinguishedLink } from './memoryView'

export const MTS_PROOF_SCHEMA = 'mts-proof/v0.2' as const
export const MTS_CONTRACT_VERSION = 'mts-contract/v0.2' as const
export const MTS_TRUSTED_PROOF_RULE = 'interpret' as const

export interface ProofExpectedResult {
  readonly success: boolean
  readonly substitutions: readonly InterpretationSubstitution[]
  readonly aliases: readonly InterpretationAlias[]
}

export interface InterpretProofStep {
  readonly rule: typeof MTS_TRUSTED_PROOF_RULE
  readonly expression: string
  readonly context: ContextFrame
  readonly symbols?: Readonly<Record<string, number>>
  readonly distinguishedMemory?: readonly DistinguishedLink[]
  readonly expected: ProofExpectedResult
}

export interface MtsProofObjectV02 {
  readonly schema: typeof MTS_PROOF_SCHEMA
  readonly contractVersion: typeof MTS_CONTRACT_VERSION
  readonly steps: readonly InterpretProofStep[]
}

function comparePath(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return left.length - right.length
}

function normalizedSubstitutions(
  values: readonly InterpretationSubstitution[]
): InterpretationSubstitution[] {
  return [...values]
    .map(item => ({ path: [...item.path], link: item.link }))
    .sort((left, right) => comparePath(left.path, right.path) || left.link - right.link)
}

function normalizedAliases(values: readonly InterpretationAlias[]): InterpretationAlias[] {
  return [...values]
    .map(item => ({ path: [...item.path], targetPath: [...item.targetPath] }))
    .sort(
      (left, right) =>
        comparePath(left.path, right.path) || comparePath(left.targetPath, right.targetPath)
    )
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Replay one trusted mts-proof/v0.2 step against the canonical parser,
 * InterpretationSession and immutable ExplicitMemoryView.
 *
 * No proof search and no additional inference rules live here.
 */
export function checkInterpretProofStep(step: InterpretProofStep): boolean {
  if (step.rule !== MTS_TRUSTED_PROOF_RULE) return false

  try {
    const expression = parseExpr(step.expression)
    const session = new InterpretationSession({
      context: step.context,
      symbols: step.symbols,
      links: step.distinguishedMemory ?? [],
    })
    const before = session.memorySnapshot()
    const result = session.interpret(expression)
    const after = session.memorySnapshot()

    if (!sameJson(before, after)) return false

    return (
      result.success === step.expected.success &&
      sameJson(
        normalizedSubstitutions(result.substitutions),
        normalizedSubstitutions(step.expected.substitutions)
      ) &&
      sameJson(normalizedAliases(result.aliases), normalizedAliases(step.expected.aliases))
    )
  } catch {
    return false
  }
}

/** Independently replay every trusted step in a proof object. */
export function checkProof(proof: MtsProofObjectV02): boolean {
  if (proof.schema !== MTS_PROOF_SCHEMA) return false
  if (proof.contractVersion !== MTS_CONTRACT_VERSION) return false
  return proof.steps.every(checkInterpretProofStep)
}
