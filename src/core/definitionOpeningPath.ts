import type { ASTNode } from './ast'
import {
  DefinitionEnvironment,
  canonicalExpression,
  openDefinition,
  parseDefinition,
  parseDefinitionTarget,
  type DefinitionId,
  type ScopePath,
} from './definitionEnvironment'
import { parseExpr } from './parser'

export interface DefinitionScopeSnapshot {
  readonly path: ScopePath
  readonly parent: ScopePath | null
  readonly definitions: readonly string[]
}

export interface OpeningPathEdge {
  readonly target: ASTNode
  readonly definitionId: DefinitionId
  readonly body: ASTNode
}

export interface OpeningPathWitness {
  readonly startTarget: ASTNode
  readonly edges: readonly OpeningPathEdge[]
  readonly finalBody: ASTNode
}

export type OpeningPathFailureCode =
  | 'empty-path'
  | 'start-target-mismatch'
  | 'previous-body-not-form'
  | 'adjacency-mismatch'
  | 'opening-not-match'
  | 'definition-id-mismatch'
  | 'repeated-definition-id'
  | 'body-mismatch'
  | 'final-body-mismatch'

export type OpeningPathVerification =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly failure: OpeningPathFailureCode }

function samePath(left: ScopePath, right: ScopePath): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function comparePath(left: ScopePath, right: ScopePath): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return left.length - right.length
}

function assertPath(path: ScopePath, label: string): void {
  for (const value of path) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label} must contain only non-negative integers`)
    }
  }
}

/** Build exactly the explicit lexical snapshot used by portable proof artifacts. */
export function buildDefinitionEnvironments(
  scopes: readonly DefinitionScopeSnapshot[]
): Map<string, DefinitionEnvironment> {
  if (scopes.length === 0) throw new Error('explicit root scope is required')

  const sorted = [...scopes].sort(
    (left, right) => left.path.length - right.path.length || comparePath(left.path, right.path)
  )
  if (JSON.stringify(sorted) !== JSON.stringify(scopes)) {
    throw new Error('definition scopes must use canonical order')
  }

  const result = new Map<string, DefinitionEnvironment>()
  for (const [index, scope] of scopes.entries()) {
    assertPath(scope.path, 'scope.path')
    if (scope.parent !== null) assertPath(scope.parent, 'scope.parent')
    const key = JSON.stringify(scope.path)
    if (result.has(key)) throw new Error('duplicate definition scope path')

    let environment: DefinitionEnvironment
    if (scope.parent === null) {
      if (index !== 0 || scope.path.length !== 0) throw new Error('root scope must be first')
      environment = new DefinitionEnvironment()
    } else {
      if (scope.path.length === 0 || !samePath(scope.path.slice(0, -1), scope.parent)) {
        throw new Error('scope path must extend parent by one index')
      }
      const parent = result.get(JSON.stringify(scope.parent))
      if (parent === undefined) throw new Error('parent scope must precede child')
      environment = parent.child(scope.path[scope.path.length - 1])
    }

    result.set(key, environment)
    for (const source of scope.definitions) environment.register(parseDefinition(source))
  }

  if (!result.has('[]')) throw new Error('explicit root scope is required')
  return result
}

export function environmentAt(
  scopes: readonly DefinitionScopeSnapshot[],
  lookupScope: ScopePath
): DefinitionEnvironment {
  assertPath(lookupScope, 'lookupScope')
  const environment = buildDefinitionEnvironments(scopes).get(JSON.stringify(lookupScope))
  if (environment === undefined) throw new Error('lookupScope is not serialized')
  return environment
}

function isForm(node: ASTNode): boolean {
  return node.type !== 'Definition' && node.type !== 'Equality' && node.type !== 'Inequality'
}

function structurallySame(left: ASTNode, right: ASTNode): boolean {
  return canonicalExpression(left) === canonicalExpression(right)
}

function sameDefinitionId(left: DefinitionId, right: DefinitionId): boolean {
  return samePath(left.scopePath, right.scopePath) && left.ordinal === right.ordinal
}

function definitionIdKey(value: DefinitionId): string {
  return `${JSON.stringify(value.scopePath)}:${value.ordinal}`
}

/** Replay exactly the serialized finite operational certificate; never auto-continue. */
export function verifyDefinitionOpeningPath(
  witness: OpeningPathWitness,
  environment: DefinitionEnvironment
): OpeningPathVerification {
  if (witness.edges.length === 0) return { accepted: false, failure: 'empty-path' }
  if (!structurallySame(witness.startTarget, witness.edges[0].target)) {
    return { accepted: false, failure: 'start-target-mismatch' }
  }

  const seen = new Set<string>()
  let replayBody: ASTNode | null = null

  for (const [index, edge] of witness.edges.entries()) {
    if (index > 0) {
      if (replayBody === null || !isForm(replayBody)) {
        return { accepted: false, failure: 'previous-body-not-form' }
      }
      if (!structurallySame(replayBody, edge.target)) {
        return { accepted: false, failure: 'adjacency-mismatch' }
      }
    }

    const opening = openDefinition(edge.target, environment)
    if (opening.kind !== 'match' || opening.definitionId === undefined || opening.body === undefined) {
      return { accepted: false, failure: 'opening-not-match' }
    }
    if (!sameDefinitionId(opening.definitionId, edge.definitionId)) {
      return { accepted: false, failure: 'definition-id-mismatch' }
    }

    const idKey = definitionIdKey(opening.definitionId)
    if (seen.has(idKey)) return { accepted: false, failure: 'repeated-definition-id' }
    seen.add(idKey)

    if (!structurallySame(opening.body, edge.body)) {
      return { accepted: false, failure: 'body-mismatch' }
    }
    replayBody = opening.body
  }

  if (replayBody === null || !structurallySame(replayBody, witness.finalBody)) {
    return { accepted: false, failure: 'final-body-mismatch' }
  }
  return { accepted: true }
}

export function parseCanonicalExpression(source: string, label: string): ASTNode {
  const expression = parseExpr(source)
  if (canonicalExpression(expression) !== source) {
    throw new Error(`${label} must use canonical expression transport`)
  }
  return expression
}

export function parseOpeningTarget(source: string): ASTNode {
  return parseDefinitionTarget(source)
}

export function isOpeningPathForm(node: ASTNode): boolean {
  return isForm(node)
}
