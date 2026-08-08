import type { ContextFrame, InterpretationAlias, InterpretationSubstitution, LinkRef } from './interpreter'
import { InterpretationSession } from './interpretationSession'
import type { DistinguishedLink } from './memoryView'
import { parseExpr } from './parser'
import {
  MTS_CONTRACT_VERSION,
  MTS_PROOF_SCHEMA,
  MTS_TRUSTED_PROOF_RULE,
  type InterpretProofStep,
  type MtsProofObjectV02,
} from './proofReplay'
import { toMtsSource } from './mtsSource'

export interface InterpretProofSearchInput {
  readonly expression: string
  readonly context: ContextFrame
  readonly symbols?: Readonly<Record<string, LinkRef>>
  readonly distinguishedMemory?: readonly DistinguishedLink[]
}

export interface ProvenSearchResult {
  readonly status: 'proven'
  readonly proof: MtsProofObjectV02
}

export interface NotProvenSearchResult {
  readonly status: 'not-proven'
  readonly reason: 'not-matched'
}

export interface ProofSearchErrorResult {
  readonly status: 'error'
  readonly stage: 'parse' | 'interpret'
  readonly message: string
}

export type InterpretProofSearchResult =
  | ProvenSearchResult
  | NotProvenSearchResult
  | ProofSearchErrorResult

function cloneContext(frame: ContextFrame): ContextFrame {
  return Object.freeze({
    start: frame.start,
    end: frame.end,
    ...(frame.parent === undefined ? {} : { parent: cloneContext(frame.parent) }),
  })
}

function cloneSymbols(
  source: Readonly<Record<string, LinkRef>> | undefined
): Readonly<Record<string, LinkRef>> | undefined {
  return source === undefined ? undefined : Object.freeze({ ...source })
}

function cloneMemory(
  source: readonly DistinguishedLink[] | undefined
): readonly DistinguishedLink[] | undefined {
  if (source === undefined) return undefined
  return Object.freeze(
    source.map(link => Object.freeze({ id: link.id, start: link.start, end: link.end }))
  )
}

function cloneSubstitutions(
  source: readonly InterpretationSubstitution[]
): readonly InterpretationSubstitution[] {
  return Object.freeze(
    source.map(item => Object.freeze({ path: Object.freeze([...item.path]), link: item.link }))
  )
}

function cloneAliases(source: readonly InterpretationAlias[]): readonly InterpretationAlias[] {
  return Object.freeze(
    source.map(item =>
      Object.freeze({
        path: Object.freeze([...item.path]),
        targetPath: Object.freeze([...item.targetPath]),
      })
    )
  )
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unknown proof search error'
}

/**
 * Untrusted single-step proof search for the current mts-proof/v0.2 contract.
 *
 * This function does not check its own output and does not define trusted
 * semantics. It only asks the canonical interpreter for a successful match and
 * packages that witness as an mts-proof/v0.2 artifact. Trust is established by
 * independently replaying the returned artifact with checkProof().
 */
export function searchInterpretProof(input: InterpretProofSearchInput): InterpretProofSearchResult {
  let expression
  try {
    expression = parseExpr(input.expression)
  } catch (cause) {
    return { status: 'error', stage: 'parse', message: message(cause) }
  }

  const context = cloneContext(input.context)
  const symbols = cloneSymbols(input.symbols)
  const distinguishedMemory = cloneMemory(input.distinguishedMemory)

  try {
    const session = new InterpretationSession({
      context,
      symbols,
      links: distinguishedMemory ?? [],
    })
    const result = session.interpret(expression)

    if (!result.success) {
      return { status: 'not-proven', reason: 'not-matched' }
    }

    const step: InterpretProofStep = Object.freeze({
      rule: MTS_TRUSTED_PROOF_RULE,
      expression: toMtsSource(expression),
      context,
      ...(symbols === undefined ? {} : { symbols }),
      ...(distinguishedMemory === undefined ? {} : { distinguishedMemory }),
      expected: Object.freeze({
        success: true,
        substitutions: cloneSubstitutions(result.substitutions),
        aliases: cloneAliases(result.aliases),
      }),
    })

    const proof: MtsProofObjectV02 = Object.freeze({
      schema: MTS_PROOF_SCHEMA,
      contractVersion: MTS_CONTRACT_VERSION,
      steps: Object.freeze([step]),
    })

    return { status: 'proven', proof }
  } catch (cause) {
    return { status: 'error', stage: 'interpret', message: message(cause) }
  }
}
