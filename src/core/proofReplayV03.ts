import { parseExpr } from './parser'
import { InterpretationSession } from './interpretationSession'
import type {
  ContextFrame,
  InterpretationAlias,
  InterpretationSubstitution,
  OccurrencePath,
} from './interpreter'
import type { DistinguishedLink } from './memoryView'
import {
  DefinitionEnvironment,
  canonicalExpression,
  openDefinition,
  parseDefinition,
  parseDefinitionTarget,
  type ScopePath,
} from './definitionEnvironment'

export const MTS_PROOF_SCHEMA_V03 = 'mts-proof/v0.3' as const
export const MTS_PROOF_CONTRACT_VERSION_V03 = 'mts-contract/v0.3' as const

export type MtsProofRelationV03 =
  | 'ContextuallySatisfies'
  | 'Opens'
  | 'NoVisibleDefinition'
  | 'DefinitionConflict'
  | 'NonAddressableDefinitionTarget'

export interface DefinitionScopeSnapshotV03 {
  readonly path: ScopePath
  readonly parent: ScopePath | null
  readonly definitions: readonly string[]
}

export interface ExpectedDefinitionIdV03 {
  readonly scopePath: ScopePath
  readonly ordinal: number
}

export interface ContextuallySatisfiesJudgmentV03 {
  readonly relation: 'ContextuallySatisfies'
  readonly expression: string
  readonly context: ContextFrame
  readonly symbols: readonly (readonly [string, number])[]
  readonly memory: readonly DistinguishedLink[]
  readonly expected: {
    readonly substitutions: readonly InterpretationSubstitution[]
    readonly aliases: readonly InterpretationAlias[]
  }
}

export interface OpensJudgmentV03 {
  readonly relation: 'Opens'
  readonly scopes: readonly DefinitionScopeSnapshotV03[]
  readonly lookupScope: ScopePath
  readonly target: string
  readonly expected: {
    readonly definitionId: ExpectedDefinitionIdV03
    readonly body: string
  }
}

export interface NoVisibleDefinitionJudgmentV03 {
  readonly relation: 'NoVisibleDefinition'
  readonly scopes: readonly DefinitionScopeSnapshotV03[]
  readonly lookupScope: ScopePath
  readonly target: string
}

export interface DefinitionConflictJudgmentV03 {
  readonly relation: 'DefinitionConflict'
  readonly scopes: readonly DefinitionScopeSnapshotV03[]
  readonly lookupScope: ScopePath
  readonly target: string
}

export interface NonAddressableDefinitionTargetJudgmentV03 {
  readonly relation: 'NonAddressableDefinitionTarget'
  readonly target: string
}

export type MtsProofJudgmentV03 =
  | ContextuallySatisfiesJudgmentV03
  | OpensJudgmentV03
  | NoVisibleDefinitionJudgmentV03
  | DefinitionConflictJudgmentV03
  | NonAddressableDefinitionTargetJudgmentV03

export interface MtsProofObjectV03 {
  readonly proofVersion: typeof MTS_PROOF_SCHEMA_V03
  readonly contractVersion: typeof MTS_PROOF_CONTRACT_VERSION_V03
  readonly judgments: readonly MtsProofJudgmentV03[]
}

export class ProofObjectV03ValidationError extends Error {
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'ProofObjectV03ValidationError'
    this.path = path
  }
}

type UnknownRecord = Record<string, unknown>

function fail(path: string, message: string): never {
  throw new ProofObjectV03ValidationError(path, message)
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

function occurrencePath(value: unknown, path: string): OccurrencePath {
  if (!Array.isArray(value)) fail(path, 'expected integer path array')
  return value.map((part, index) => nonNegativeInt(part, `${path}[${index}]`))
}

function samePath(left: ScopePath, right: ScopePath): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function comparePath(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return left.length - right.length
}

function contextFrame(value: unknown, path: string): ContextFrame {
  const source = record(value, path)
  exactKeys(source, ['start', 'end', 'parent'], path)
  return {
    start: nonNegativeInt(source.start, `${path}.start`),
    end: nonNegativeInt(source.end, `${path}.end`),
    ...(source.parent === null ? {} : { parent: contextFrame(source.parent, `${path}.parent`) }),
  }
}

function memory(value: unknown, path: string): readonly DistinguishedLink[] {
  if (!Array.isArray(value)) fail(path, 'expected memory array')
  const ids = new Set<number>()
  const poles = new Set<string>()
  return value.map((entry, index) => {
    const itemPath = `${path}[${index}]`
    const source = record(entry, itemPath)
    exactKeys(source, ['id', 'start', 'end'], itemPath)
    const result = {
      id: nonNegativeInt(source.id, `${itemPath}.id`),
      start: nonNegativeInt(source.start, `${itemPath}.start`),
      end: nonNegativeInt(source.end, `${itemPath}.end`),
    }
    if (ids.has(result.id)) fail(`${itemPath}.id`, 'duplicate LinkRef')
    const poleKey = `${result.start}:${result.end}`
    if (poles.has(poleKey)) fail(itemPath, 'ambiguous duplicate poles')
    ids.add(result.id)
    poles.add(poleKey)
    return result
  })
}

function symbolBindings(value: unknown, path: string): readonly (readonly [string, number])[] {
  if (!Array.isArray(value)) fail(path, 'expected symbol binding array')
  const seen = new Set<string>()
  const result = value.map((entry, index) => {
    const itemPath = `${path}[${index}]`
    if (!Array.isArray(entry) || entry.length !== 2) fail(itemPath, 'expected [name, LinkRef]')
    const name = stringValue(entry[0], `${itemPath}[0]`)
    if (name.length === 0) fail(`${itemPath}[0]`, 'symbol name must be non-empty')
    if (seen.has(name)) fail(`${itemPath}[0]`, 'duplicate symbol binding')
    seen.add(name)
    return [name, nonNegativeInt(entry[1], `${itemPath}[1]`)] as const
  })
  const sorted = [...result].sort(([left], [right]) => left.localeCompare(right))
  if (JSON.stringify(result) !== JSON.stringify(sorted)) fail(path, 'symbol bindings must be sorted')
  return result
}

function substitutions(value: unknown, path: string): readonly InterpretationSubstitution[] {
  if (!Array.isArray(value)) fail(path, 'expected substitutions array')
  const seen = new Set<string>()
  const result = value.map((entry, index) => {
    const itemPath = `${path}[${index}]`
    const source = record(entry, itemPath)
    exactKeys(source, ['path', 'link'], itemPath)
    const item = {
      path: occurrencePath(source.path, `${itemPath}.path`),
      link: nonNegativeInt(source.link, `${itemPath}.link`),
    }
    const key = JSON.stringify(item.path)
    if (seen.has(key)) fail(`${itemPath}.path`, 'duplicate substitution path')
    seen.add(key)
    return item
  })
  const sorted = [...result].sort((left, right) => comparePath(left.path, right.path) || left.link - right.link)
  if (JSON.stringify(result) !== JSON.stringify(sorted)) fail(path, 'substitutions must be sorted')
  return result
}

function aliases(value: unknown, path: string): readonly InterpretationAlias[] {
  if (!Array.isArray(value)) fail(path, 'expected aliases array')
  const seen = new Set<string>()
  const result = value.map((entry, index) => {
    const itemPath = `${path}[${index}]`
    const source = record(entry, itemPath)
    exactKeys(source, ['path', 'targetPath'], itemPath)
    const item = {
      path: occurrencePath(source.path, `${itemPath}.path`),
      targetPath: occurrencePath(source.targetPath, `${itemPath}.targetPath`),
    }
    const key = JSON.stringify(item.path)
    if (seen.has(key)) fail(`${itemPath}.path`, 'duplicate alias path')
    seen.add(key)
    return item
  })
  const sorted = [...result].sort(
    (left, right) => comparePath(left.path, right.path) || comparePath(left.targetPath, right.targetPath)
  )
  if (JSON.stringify(result) !== JSON.stringify(sorted)) fail(path, 'aliases must be sorted')
  return result
}

function definitionScope(value: unknown, path: string): DefinitionScopeSnapshotV03 {
  const source = record(value, path)
  exactKeys(source, ['path', 'parent', 'definitions'], path)
  const scopePath = occurrencePath(source.path, `${path}.path`)
  const parent = source.parent === null ? null : occurrencePath(source.parent, `${path}.parent`)
  if (!Array.isArray(source.definitions)) fail(`${path}.definitions`, 'expected definition string array')
  const definitions = source.definitions.map((item, index) =>
    stringValue(item, `${path}.definitions[${index}]`)
  )
  return { path: scopePath, parent, definitions }
}

function compareScope(left: DefinitionScopeSnapshotV03, right: DefinitionScopeSnapshotV03): number {
  return left.path.length - right.path.length || comparePath(left.path, right.path)
}

function definitionScopes(value: unknown, path: string): readonly DefinitionScopeSnapshotV03[] {
  if (!Array.isArray(value)) fail(path, 'expected lexical scopes array')
  if (value.length === 0) fail(path, 'explicit root scope is required')
  const result = value.map((item, index) => definitionScope(item, `${path}[${index}]`))
  const sorted = [...result].sort(compareScope)
  if (JSON.stringify(result) !== JSON.stringify(sorted)) fail(path, 'scopes must use canonical order')

  const seen = new Set<string>()
  for (const [index, scope] of result.entries()) {
    const key = JSON.stringify(scope.path)
    if (seen.has(key)) fail(`${path}[${index}].path`, 'duplicate scope path')
    seen.add(key)
    if (scope.parent === null) {
      if (index !== 0 || scope.path.length !== 0) fail(`${path}[${index}]`, 'root scope must be first')
    } else {
      if (scope.path.length === 0 || !samePath(scope.path.slice(0, -1), scope.parent)) {
        fail(`${path}[${index}].parent`, 'scope must extend parent by one index')
      }
      if (!seen.has(JSON.stringify(scope.parent))) {
        fail(`${path}[${index}].parent`, 'parent scope must precede child')
      }
    }
  }
  if (!samePath(result[0].path, []) || result[0].parent !== null) fail(path, 'root scope is required')
  return result
}

function expectedDefinitionId(value: unknown, path: string): ExpectedDefinitionIdV03 {
  const source = record(value, path)
  exactKeys(source, ['scopePath', 'ordinal'], path)
  return {
    scopePath: occurrencePath(source.scopePath, `${path}.scopePath`),
    ordinal: nonNegativeInt(source.ordinal, `${path}.ordinal`),
  }
}

function commonDefinitionJudgment(
  source: UnknownRecord,
  path: string
): { scopes: readonly DefinitionScopeSnapshotV03[]; lookupScope: ScopePath; target: string } {
  return {
    scopes: definitionScopes(source.scopes, `${path}.scopes`),
    lookupScope: occurrencePath(source.lookupScope, `${path}.lookupScope`),
    target: stringValue(source.target, `${path}.target`),
  }
}

function judgment(value: unknown, path: string): MtsProofJudgmentV03 {
  const source = record(value, path)
  const relation = stringValue(source.relation, `${path}.relation`)

  if (relation === 'ContextuallySatisfies') {
    exactKeys(source, ['relation', 'expression', 'context', 'symbols', 'memory', 'expected'], path)
    const expected = record(source.expected, `${path}.expected`)
    exactKeys(expected, ['substitutions', 'aliases'], `${path}.expected`)
    return {
      relation,
      expression: stringValue(source.expression, `${path}.expression`),
      context: contextFrame(source.context, `${path}.context`),
      symbols: symbolBindings(source.symbols, `${path}.symbols`),
      memory: memory(source.memory, `${path}.memory`),
      expected: {
        substitutions: substitutions(expected.substitutions, `${path}.expected.substitutions`),
        aliases: aliases(expected.aliases, `${path}.expected.aliases`),
      },
    }
  }

  if (relation === 'Opens') {
    exactKeys(source, ['relation', 'scopes', 'lookupScope', 'target', 'expected'], path)
    const expected = record(source.expected, `${path}.expected`)
    exactKeys(expected, ['definitionId', 'body'], `${path}.expected`)
    return {
      relation,
      ...commonDefinitionJudgment(source, path),
      expected: {
        definitionId: expectedDefinitionId(expected.definitionId, `${path}.expected.definitionId`),
        body: stringValue(expected.body, `${path}.expected.body`),
      },
    }
  }

  if (relation === 'NoVisibleDefinition' || relation === 'DefinitionConflict') {
    exactKeys(source, ['relation', 'scopes', 'lookupScope', 'target'], path)
    return { relation, ...commonDefinitionJudgment(source, path) }
  }

  if (relation === 'NonAddressableDefinitionTarget') {
    exactKeys(source, ['relation', 'target'], path)
    return { relation, target: stringValue(source.target, `${path}.target`) }
  }

  fail(`${path}.relation`, `unsupported relation ${JSON.stringify(relation)}`)
}

export function parseProofObjectV03(value: unknown): MtsProofObjectV03 {
  const source = record(value, '$')
  exactKeys(source, ['proofVersion', 'contractVersion', 'judgments'], '$')
  const proofVersion = stringValue(source.proofVersion, '$.proofVersion')
  if (proofVersion !== MTS_PROOF_SCHEMA_V03) {
    fail('$.proofVersion', `expected ${MTS_PROOF_SCHEMA_V03}, got ${JSON.stringify(proofVersion)}`)
  }
  const contractVersion = stringValue(source.contractVersion, '$.contractVersion')
  if (contractVersion !== MTS_PROOF_CONTRACT_VERSION_V03) {
    fail(
      '$.contractVersion',
      `expected ${MTS_PROOF_CONTRACT_VERSION_V03}, got ${JSON.stringify(contractVersion)}`
    )
  }
  if (!Array.isArray(source.judgments)) fail('$.judgments', 'expected judgments array')
  return {
    proofVersion: MTS_PROOF_SCHEMA_V03,
    contractVersion: MTS_PROOF_CONTRACT_VERSION_V03,
    judgments: source.judgments.map((item, index) => judgment(item, `$.judgments[${index}]`)),
  }
}

export function parseProofJsonV03(source: string): MtsProofObjectV03 {
  try {
    return parseProofObjectV03(JSON.parse(source) as unknown)
  } catch (cause) {
    if (cause instanceof ProofObjectV03ValidationError) throw cause
    const message = cause instanceof Error ? cause.message : 'invalid JSON'
    fail('$', `invalid JSON: ${message}`)
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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

function buildEnvironments(
  scopes: readonly DefinitionScopeSnapshotV03[]
): Map<string, DefinitionEnvironment> {
  const environments = new Map<string, DefinitionEnvironment>()
  for (const scope of scopes) {
    let environment: DefinitionEnvironment
    if (scope.parent === null) {
      environment = new DefinitionEnvironment()
    } else {
      const parent = environments.get(JSON.stringify(scope.parent))
      if (parent === undefined) throw new Error('missing parent definition scope')
      environment = parent.child(scope.path[scope.path.length - 1])
    }
    environments.set(JSON.stringify(scope.path), environment)
    for (const source of scope.definitions) environment.register(parseDefinition(source))
  }
  return environments
}

function replayDefinition(
  scopes: readonly DefinitionScopeSnapshotV03[],
  lookupScope: ScopePath,
  target: string
) {
  const environments = buildEnvironments(scopes)
  const environment = environments.get(JSON.stringify(lookupScope))
  if (environment === undefined) throw new Error('lookupScope is not serialized')
  return openDefinition(parseDefinitionTarget(target), environment)
}

export function checkJudgmentV03(value: MtsProofJudgmentV03): boolean {
  try {
    if (value.relation === 'ContextuallySatisfies') {
      const session = new InterpretationSession({
        context: value.context,
        symbols: Object.fromEntries(value.symbols),
        links: value.memory,
      })
      const before = session.memorySnapshot()
      const result = session.interpret(parseExpr(value.expression))
      const after = session.memorySnapshot()
      return (
        sameJson(before, after) &&
        result.success === true &&
        sameJson(normalizedSubstitutions(result.substitutions), value.expected.substitutions) &&
        sameJson(normalizedAliases(result.aliases), value.expected.aliases)
      )
    }

    if (value.relation === 'NonAddressableDefinitionTarget') {
      const result = openDefinition(parseDefinitionTarget(value.target), new DefinitionEnvironment())
      return result.kind === 'non-addressable'
    }

    const result = replayDefinition(value.scopes, value.lookupScope, value.target)
    if (value.relation === 'NoVisibleDefinition') return result.kind === 'no-match'
    if (value.relation === 'DefinitionConflict') return result.kind === 'conflict'
    if (result.kind !== 'match' || result.definitionId === undefined || result.body === undefined) {
      return false
    }
    return (
      samePath(result.definitionId.scopePath, value.expected.definitionId.scopePath) &&
      result.definitionId.ordinal === value.expected.definitionId.ordinal &&
      canonicalExpression(result.body) === value.expected.body
    )
  } catch {
    return false
  }
}

/** Independently replay every base judgment; array order has no inference meaning. */
export function checkProofV03(proof: MtsProofObjectV03): boolean {
  try {
    const decoded = parseProofObjectV03(proof)
    return decoded.judgments.every(checkJudgmentV03)
  } catch {
    return false
  }
}
