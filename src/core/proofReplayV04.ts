import type { ASTNode } from './ast'
import {
  canonicalExpression,
  type DefinitionId,
  type ScopePath,
} from './definitionEnvironment'
import {
  environmentAt,
  parseCanonicalExpression,
  parseOpeningTarget,
  verifyDefinitionOpeningPath,
  type DefinitionScopeSnapshot,
  type OpeningPathEdge,
} from './definitionOpeningPath'
import {
  MTS_PROOF_CONTRACT_VERSION_V03,
  MTS_PROOF_SCHEMA_V03,
  checkJudgmentV03,
  parseProofObjectV03,
  type MtsProofJudgmentV03,
} from './proofReplayV03'

export const MTS_PROOF_SCHEMA_V04 = 'mts-proof/v0.4' as const
export const MTS_PROOF_CONTRACT_VERSION_V04 = 'mts-contract/v0.4' as const

export interface DefinitionOpeningPathJudgmentV04 {
  readonly relation: 'DefinitionOpeningPath'
  readonly scopes: readonly DefinitionScopeSnapshot[]
  readonly lookupScope: ScopePath
  readonly startTarget: ASTNode
  readonly edges: readonly OpeningPathEdge[]
  readonly finalBody: ASTNode
}

export type MtsProofJudgmentV04 = MtsProofJudgmentV03 | DefinitionOpeningPathJudgmentV04

export interface MtsProofObjectV04 {
  readonly proofVersion: typeof MTS_PROOF_SCHEMA_V04
  readonly contractVersion: typeof MTS_PROOF_CONTRACT_VERSION_V04
  readonly judgments: readonly MtsProofJudgmentV04[]
}

export class ProofObjectV04ValidationError extends Error {
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'ProofObjectV04ValidationError'
    this.path = path
  }
}

type UnknownRecord = Record<string, unknown>

function fail(path: string, message: string): never {
  throw new ProofObjectV04ValidationError(path, message)
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'expected object')
  }
  return value as UnknownRecord
}

function exactKeys(source: UnknownRecord, expected: readonly string[], path: string): void {
  const actual = Object.keys(source).sort()
  const wanted = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(path, `expected exactly fields ${wanted.join(', ')}`)
  }
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'expected string')
  return value
}

function nonNegativeInt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(path, 'expected non-negative integer')
  }
  return value
}

function scopePath(value: unknown, path: string): ScopePath {
  if (!Array.isArray(value)) fail(path, 'expected integer path array')
  return value.map((part, index) => nonNegativeInt(part, `${path}[${index}]`))
}

function definitionId(value: unknown, path: string): DefinitionId {
  const source = record(value, path)
  exactKeys(source, ['scopePath', 'ordinal'], path)
  return {
    scopePath: scopePath(source.scopePath, `${path}.scopePath`),
    ordinal: nonNegativeInt(source.ordinal, `${path}.ordinal`),
  }
}

function scopes(value: unknown, path: string): readonly DefinitionScopeSnapshot[] {
  if (!Array.isArray(value)) fail(path, 'expected lexical scopes array')
  const result = value.map((entry, index) => {
    const itemPath = `${path}[${index}]`
    const source = record(entry, itemPath)
    exactKeys(source, ['path', 'parent', 'definitions'], itemPath)
    if (!Array.isArray(source.definitions)) fail(`${itemPath}.definitions`, 'expected string array')
    const definitions = source.definitions.map((item, definitionIndex) =>
      stringValue(item, `${itemPath}.definitions[${definitionIndex}]`)
    )
    return {
      path: scopePath(source.path, `${itemPath}.path`),
      parent: source.parent === null ? null : scopePath(source.parent, `${itemPath}.parent`),
      definitions,
    }
  })
  // environmentAt performs canonical ordering, parent and duplicate validation.
  environmentAt(result, result[0]?.path ?? [])
  return result
}

function openingPathJudgment(value: unknown, path: string): DefinitionOpeningPathJudgmentV04 {
  const source = record(value, path)
  exactKeys(source, ['relation', 'scopes', 'lookupScope', 'startTarget', 'edges', 'finalBody'], path)
  if (source.relation !== 'DefinitionOpeningPath') fail(`${path}.relation`, 'invalid relation')

  const parsedScopes = scopes(source.scopes, `${path}.scopes`)
  const lookupScope = scopePath(source.lookupScope, `${path}.lookupScope`)
  environmentAt(parsedScopes, lookupScope)

  if (!Array.isArray(source.edges) || source.edges.length === 0) {
    fail(`${path}.edges`, 'expected non-empty edge array')
  }
  const edges = source.edges.map((entry, index): OpeningPathEdge => {
    const itemPath = `${path}.edges[${index}]`
    const edge = record(entry, itemPath)
    exactKeys(edge, ['target', 'definitionId', 'body'], itemPath)
    return {
      target: parseOpeningTarget(stringValue(edge.target, `${itemPath}.target`)),
      definitionId: definitionId(edge.definitionId, `${itemPath}.definitionId`),
      body: parseCanonicalExpression(
        stringValue(edge.body, `${itemPath}.body`),
        `${itemPath}.body`
      ),
    }
  })

  return {
    relation: 'DefinitionOpeningPath',
    scopes: parsedScopes,
    lookupScope,
    startTarget: parseOpeningTarget(stringValue(source.startTarget, `${path}.startTarget`)),
    edges,
    finalBody: parseCanonicalExpression(
      stringValue(source.finalBody, `${path}.finalBody`),
      `${path}.finalBody`
    ),
  }
}

function baseJudgment(value: unknown, path: string): MtsProofJudgmentV03 {
  try {
    const proof = parseProofObjectV03({
      proofVersion: MTS_PROOF_SCHEMA_V03,
      contractVersion: MTS_PROOF_CONTRACT_VERSION_V03,
      judgments: [value],
    })
    return proof.judgments[0]
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'invalid base judgment'
    fail(path, message)
  }
}

function judgment(value: unknown, path: string): MtsProofJudgmentV04 {
  const source = record(value, path)
  return source.relation === 'DefinitionOpeningPath'
    ? openingPathJudgment(value, path)
    : baseJudgment(value, path)
}

export function parseProofObjectV04(value: unknown): MtsProofObjectV04 {
  const source = record(value, '$')
  exactKeys(source, ['proofVersion', 'contractVersion', 'judgments'], '$')
  if (source.proofVersion !== MTS_PROOF_SCHEMA_V04) {
    fail('$.proofVersion', `expected ${MTS_PROOF_SCHEMA_V04}`)
  }
  if (source.contractVersion !== MTS_PROOF_CONTRACT_VERSION_V04) {
    fail('$.contractVersion', `expected ${MTS_PROOF_CONTRACT_VERSION_V04}`)
  }
  if (!Array.isArray(source.judgments)) fail('$.judgments', 'expected array')
  return {
    proofVersion: MTS_PROOF_SCHEMA_V04,
    contractVersion: MTS_PROOF_CONTRACT_VERSION_V04,
    judgments: source.judgments.map((item, index) => judgment(item, `$.judgments[${index}]`)),
  }
}

export function parseProofJsonV04(source: string): MtsProofObjectV04 {
  try {
    return parseProofObjectV04(JSON.parse(source) as unknown)
  } catch (cause) {
    if (cause instanceof ProofObjectV04ValidationError) throw cause
    const message = cause instanceof Error ? cause.message : 'invalid JSON'
    fail('$', `invalid JSON: ${message}`)
  }
}

export function checkJudgmentV04(value: MtsProofJudgmentV04): boolean {
  if (value.relation !== 'DefinitionOpeningPath') return checkJudgmentV03(value)
  try {
    const environment = environmentAt(value.scopes, value.lookupScope)
    return verifyDefinitionOpeningPath(
      {
        startTarget: value.startTarget,
        edges: value.edges,
        finalBody: value.finalBody,
      },
      environment
    ).accepted
  } catch {
    return false
  }
}

export function checkProofV04(proof: MtsProofObjectV04): boolean {
  if (
    proof.proofVersion !== MTS_PROOF_SCHEMA_V04 ||
    proof.contractVersion !== MTS_PROOF_CONTRACT_VERSION_V04
  ) {
    return false
  }
  return proof.judgments.every(checkJudgmentV04)
}

export function checkProofV04Data(value: unknown): boolean {
  try {
    return checkProofV04(parseProofObjectV04(value))
  } catch {
    return false
  }
}

function contextToData(value: { readonly start: number; readonly end: number; readonly parent?: unknown }): unknown {
  return {
    start: value.start,
    end: value.end,
    parent:
      value.parent === undefined
        ? null
        : contextToData(value.parent as { readonly start: number; readonly end: number; readonly parent?: unknown }),
  }
}

function scopeToData(value: { readonly path: ScopePath; readonly parent: ScopePath | null; readonly definitions: readonly string[] }): unknown {
  return {
    path: [...value.path],
    parent: value.parent === null ? null : [...value.parent],
    definitions: [...value.definitions],
  }
}

function baseJudgmentToData(value: MtsProofJudgmentV03): unknown {
  if (value.relation === 'ContextuallySatisfies') {
    return {
      relation: value.relation,
      expression: value.expression,
      context: contextToData(value.context),
      symbols: value.symbols.map(([name, link]) => [name, link]),
      memory: value.memory.map(item => ({ ...item })),
      expected: {
        substitutions: value.expected.substitutions.map(item => ({ path: [...item.path], link: item.link })),
        aliases: value.expected.aliases.map(item => ({ path: [...item.path], targetPath: [...item.targetPath] })),
      },
    }
  }
  if (value.relation === 'Opens') {
    return {
      relation: value.relation,
      scopes: value.scopes.map(scopeToData),
      lookupScope: [...value.lookupScope],
      target: value.target,
      expected: {
        definitionId: {
          scopePath: [...value.expected.definitionId.scopePath],
          ordinal: value.expected.definitionId.ordinal,
        },
        body: value.expected.body,
      },
    }
  }
  if (value.relation === 'NoVisibleDefinition' || value.relation === 'DefinitionConflict') {
    return {
      relation: value.relation,
      scopes: value.scopes.map(scopeToData),
      lookupScope: [...value.lookupScope],
      target: value.target,
    }
  }
  return { relation: value.relation, target: value.target }
}

function openingPathToData(value: DefinitionOpeningPathJudgmentV04): unknown {
  return {
    relation: value.relation,
    scopes: value.scopes.map(scopeToData),
    lookupScope: [...value.lookupScope],
    startTarget: canonicalExpression(value.startTarget),
    edges: value.edges.map(edge => ({
      target: canonicalExpression(edge.target),
      definitionId: {
        scopePath: [...edge.definitionId.scopePath],
        ordinal: edge.definitionId.ordinal,
      },
      body: canonicalExpression(edge.body),
    })),
    finalBody: canonicalExpression(value.finalBody),
  }
}

export function proofObjectV04ToData(proof: MtsProofObjectV04): unknown {
  if (!checkProofV04(proof)) throw new Error('cannot serialize invalid mts-proof/v0.4')
  return {
    proofVersion: proof.proofVersion,
    contractVersion: proof.contractVersion,
    judgments: proof.judgments.map(item =>
      item.relation === 'DefinitionOpeningPath' ? openingPathToData(item) : baseJudgmentToData(item)
    ),
  }
}

export function canonicalProofV04Json(proof: MtsProofObjectV04): string {
  return JSON.stringify(proofObjectV04ToData(proof))
}
