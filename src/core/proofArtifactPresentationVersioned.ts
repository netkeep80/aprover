import { canonicalExpression } from './definitionEnvironment'
import { formatOccurrencePath } from './interpretationPresentation'
import type { ContextFrame } from './interpreter'
import {
  MTS_PROOF_SCHEMA_V04,
  ProofObjectV04ValidationError,
  checkJudgmentV04,
  parseProofObjectV04,
  type MtsProofJudgmentV04,
} from './proofReplayV04'

export interface VersionedEmptyProofArtifactView {
  readonly status: 'empty'
}

export interface VersionedInvalidProofArtifactView {
  readonly status: 'invalid'
  readonly error: string
  readonly errorPath?: string
}

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

export interface ProofJudgmentReplayView {
  readonly index: number
  readonly relation: string
  readonly accepted: boolean
  readonly primary: string
  readonly context: readonly ProofContextView[]
  readonly substitutions: readonly ProofSubstitutionView[]
  readonly aliases: readonly ProofAliasView[]
  readonly meta: readonly string[]
  readonly details: readonly string[]
}

export interface ReplayedVersionedProofArtifactView {
  readonly status: 'accepted' | 'rejected'
  readonly version: 'v0.4'
  readonly schema: string
  readonly contractVersion: string
  readonly accepted: boolean
  readonly judgments: readonly ProofJudgmentReplayView[]
}

export type VersionedProofArtifactView =
  | VersionedEmptyProofArtifactView
  | VersionedInvalidProofArtifactView
  | ReplayedVersionedProofArtifactView

function contextView(frame: ContextFrame): ProofContextView[] {
  const result: ProofContextView[] = []
  let current: ContextFrame | undefined = frame
  let depth = 0
  while (current !== undefined) {
    result.push({ depth, start: current.start, end: current.end })
    current = current.parent
    depth += 1
  }
  return result
}

function pathText(path: readonly number[]): string {
  return path.length === 0 ? 'root' : `[${path.join(',')}]`
}

function judgmentView(value: MtsProofJudgmentV04, index: number): ProofJudgmentReplayView {
  const accepted = checkJudgmentV04(value)

  if (value.relation === 'ContextuallySatisfies') {
    return {
      index: index + 1,
      relation: value.relation,
      accepted,
      primary: value.expression,
      context: contextView(value.context),
      substitutions: value.expected.substitutions.map(item => ({
        occurrence: formatOccurrencePath(item.path),
        link: item.link,
      })),
      aliases: value.expected.aliases.map(item => ({
        occurrence: formatOccurrencePath(item.path),
        target: formatOccurrencePath(item.targetPath),
      })),
      meta: [`symbols: ${value.symbols.length}`, `distinguished links: ${value.memory.length}`],
      details: [],
    }
  }

  if (value.relation === 'Opens') {
    return {
      index: index + 1,
      relation: value.relation,
      accepted,
      primary: value.target,
      context: [],
      substitutions: [],
      aliases: [],
      meta: [`lookup scope: ${pathText(value.lookupScope)}`, `scopes: ${value.scopes.length}`],
      details: [
        `DefinitionId: ${pathText(value.expected.definitionId.scopePath)} / ${value.expected.definitionId.ordinal}`,
        `RHS: ${value.expected.body}`,
      ],
    }
  }

  if (value.relation === 'NoVisibleDefinition' || value.relation === 'DefinitionConflict') {
    return {
      index: index + 1,
      relation: value.relation,
      accepted,
      primary: value.target,
      context: [],
      substitutions: [],
      aliases: [],
      meta: [`lookup scope: ${pathText(value.lookupScope)}`, `scopes: ${value.scopes.length}`],
      details: [value.relation === 'NoVisibleDefinition' ? 'expected: no-match' : 'expected: conflict'],
    }
  }

  if (value.relation === 'NonAddressableDefinitionTarget') {
    return {
      index: index + 1,
      relation: value.relation,
      accepted,
      primary: value.target,
      context: [],
      substitutions: [],
      aliases: [],
      meta: [],
      details: ['expected: non-addressable'],
    }
  }

  return {
    index: index + 1,
    relation: value.relation,
    accepted,
    primary: canonicalExpression(value.startTarget),
    context: [],
    substitutions: [],
    aliases: [],
    meta: [`lookup scope: ${pathText(value.lookupScope)}`, `scopes: ${value.scopes.length}`],
    details: [
      ...value.edges.map(
        (edge, edgeIndex) =>
          `edge ${edgeIndex + 1}: ${canonicalExpression(edge.target)} -> ${canonicalExpression(edge.body)} @ ${pathText(edge.definitionId.scopePath)}/${edge.definitionId.ordinal}`
      ),
      `final: ${canonicalExpression(value.finalBody)}`,
    ],
  }
}

function invalid(cause: unknown): VersionedInvalidProofArtifactView {
  if (cause instanceof ProofObjectV04ValidationError) {
    return { status: 'invalid', error: cause.message, errorPath: cause.path }
  }
  return {
    status: 'invalid',
    error: cause instanceof Error ? cause.message : 'Unknown proof artifact error',
  }
}

/** Presentation for the single current public proof format. */
export function presentVersionedProofArtifactJson(source: string): VersionedProofArtifactView {
  if (!source.trim()) return { status: 'empty' }

  let raw: unknown
  try {
    raw = JSON.parse(source) as unknown
  } catch (cause) {
    return invalid(cause)
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { status: 'invalid', error: 'Proof artifact must be a JSON object' }
  }

  const record = raw as Record<string, unknown>
  if (record.proofVersion !== MTS_PROOF_SCHEMA_V04) {
    return {
      status: 'invalid',
      error: `Unsupported proof artifact version; expected ${MTS_PROOF_SCHEMA_V04}`,
      errorPath: '$.proofVersion',
    }
  }

  try {
    const proof = parseProofObjectV04(raw)
    const judgments = proof.judgments.map(judgmentView)
    const accepted = judgments.every(item => item.accepted)
    return {
      status: accepted ? 'accepted' : 'rejected',
      version: 'v0.4',
      schema: proof.proofVersion,
      contractVersion: proof.contractVersion,
      accepted,
      judgments,
    }
  } catch (cause) {
    return invalid(cause)
  }
}
