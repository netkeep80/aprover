import type { ASTNode } from './ast'
import type { ContextFrame, InterpretationAlias, InterpretationSubstitution, LinkRef } from './interpreter'
import { InterpretationSession } from './interpretationSession'
import type { DistinguishedLink } from './memoryView'
import { parseExpr } from './parser'
import {
  MTS_PROOF_CONTRACT_VERSION_V04,
  MTS_PROOF_SCHEMA_V04,
  type MtsProofObjectV04,
} from './proofReplayV04'
import { toMtsSource } from './mtsSource'

export interface InterpretProofSearchInput {
  readonly expression: string
  readonly context: ContextFrame
  readonly symbols?: Readonly<Record<string, LinkRef>>
  readonly distinguishedMemory?: readonly DistinguishedLink[]
}

export interface ProvenSearchResult {
  readonly status: 'proven'
  readonly proof: MtsProofObjectV04
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
): readonly (readonly [string, LinkRef])[] {
  return Object.freeze(
    Object.entries(source ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, link]) => Object.freeze([name, link] as const))
  )
}

function cloneMemory(source: readonly DistinguishedLink[] | undefined): readonly DistinguishedLink[] {
  return Object.freeze(
    (source ?? []).map(link => Object.freeze({ id: link.id, start: link.start, end: link.end }))
  )
}

function comparePath(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return left.length - right.length
}

function cloneSubstitutions(
  source: readonly InterpretationSubstitution[]
): readonly InterpretationSubstitution[] {
  return Object.freeze(
    source
      .map(item => Object.freeze({ path: Object.freeze([...item.path]), link: item.link }))
      .sort((left, right) => comparePath(left.path, right.path) || left.link - right.link)
  )
}

function cloneAliases(source: readonly InterpretationAlias[]): readonly InterpretationAlias[] {
  return Object.freeze(
    source
      .map(item =>
        Object.freeze({
          path: Object.freeze([...item.path]),
          targetPath: Object.freeze([...item.targetPath]),
        })
      )
      .sort(
        (left, right) =>
          comparePath(left.path, right.path) || comparePath(left.targetPath, right.targetPath)
      )
  )
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unknown proof search error'
}

/**
 * Untrusted single-judgment proof search for the current mts-proof/v0.4 surface.
 *
 * The search asks the canonical interpreter for one successful contextual
 * satisfaction witness and packages it as a ContextuallySatisfies judgment.
 * Trust is established only by a fresh independent mts-proof/v0.4 replay.
 */
export function searchInterpretProof(input: InterpretProofSearchInput): InterpretProofSearchResult {
  let expression: ASTNode
  try {
    expression = parseExpr(input.expression)
  } catch (cause) {
    return { status: 'error', stage: 'parse', message: message(cause) }
  }

  const context = cloneContext(input.context)
  const symbols = cloneSymbols(input.symbols)
  const memory = cloneMemory(input.distinguishedMemory)

  try {
    const session = new InterpretationSession({
      context,
      symbols: input.symbols,
      links: memory,
    })
    const result = session.interpret(expression)

    if (!result.success) {
      return { status: 'not-proven', reason: 'not-matched' }
    }

    const proof: MtsProofObjectV04 = Object.freeze({
      proofVersion: MTS_PROOF_SCHEMA_V04,
      contractVersion: MTS_PROOF_CONTRACT_VERSION_V04,
      judgments: Object.freeze([
        Object.freeze({
          relation: 'ContextuallySatisfies' as const,
          expression: toMtsSource(expression),
          context,
          symbols,
          memory,
          expected: Object.freeze({
            substitutions: cloneSubstitutions(result.substitutions),
            aliases: cloneAliases(result.aliases),
          }),
        }),
      ]),
    })

    return { status: 'proven', proof }
  } catch (cause) {
    return { status: 'error', stage: 'interpret', message: message(cause) }
  }
}
