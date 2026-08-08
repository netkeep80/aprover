import { parseExpr } from './parser'
import { InterpretationSession } from './interpretationSession'
import type {
  ContextFrame,
  InterpretationAlias,
  InterpretationSubstitution,
  OccurrencePath,
} from './interpreter'
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

export class ProofObjectValidationError extends Error {
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'ProofObjectValidationError'
    this.path = path
  }
}

type UnknownRecord = Record<string, unknown>

function fail(path: string, message: string): never {
  throw new ProofObjectValidationError(path, message)
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'expected object')
  }
  return value as UnknownRecord
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'expected string')
  return value
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'expected boolean')
  return value
}

function linkRef(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    fail(path, 'expected integer LinkRef')
  }
  return value
}

function occurrencePath(value: unknown, path: string): OccurrencePath {
  if (!Array.isArray(value)) fail(path, 'expected occurrence path array')
  return value.map((part, index) => {
    if (typeof part !== 'number' || !Number.isSafeInteger(part) || part < 0) {
      fail(`${path}[${index}]`, 'expected non-negative integer path segment')
    }
    return part
  })
}

function contextFrame(value: unknown, path: string): ContextFrame {
  const source = record(value, path)
  const frame: ContextFrame = {
    start: linkRef(source.start, `${path}.start`),
    end: linkRef(source.end, `${path}.end`),
  }
  if (source.parent === undefined) return frame
  return { ...frame, parent: contextFrame(source.parent, `${path}.parent`) }
}

function symbols(value: unknown, path: string): Readonly<Record<string, number>> | undefined {
  if (value === undefined) return undefined
  const source = record(value, path)
  const result: Record<string, number> = {}
  for (const [name, reference] of Object.entries(source)) {
    result[name] = linkRef(reference, `${path}.${JSON.stringify(name)}`)
  }
  return result
}

function distinguishedMemory(
  value: unknown,
  path: string
): readonly DistinguishedLink[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) fail(path, 'expected distinguished memory array')
  return value.map((entry, index) => {
    const source = record(entry, `${path}[${index}]`)
    return {
      id: linkRef(source.id, `${path}[${index}].id`),
      start: linkRef(source.start, `${path}[${index}].start`),
      end: linkRef(source.end, `${path}[${index}].end`),
    }
  })
}

function substitutions(value: unknown, path: string): readonly InterpretationSubstitution[] {
  if (!Array.isArray(value)) fail(path, 'expected substitutions array')
  return value.map((entry, index) => {
    const source = record(entry, `${path}[${index}]`)
    return {
      path: occurrencePath(source.path, `${path}[${index}].path`),
      link: linkRef(source.link, `${path}[${index}].link`),
    }
  })
}

function aliases(value: unknown, path: string): readonly InterpretationAlias[] {
  if (!Array.isArray(value)) fail(path, 'expected aliases array')
  return value.map((entry, index) => {
    const source = record(entry, `${path}[${index}]`)
    return {
      path: occurrencePath(source.path, `${path}[${index}].path`),
      targetPath: occurrencePath(source.targetPath, `${path}[${index}].targetPath`),
    }
  })
}

function expectedResult(value: unknown, path: string): ProofExpectedResult {
  const source = record(value, path)
  return {
    success: booleanValue(source.success, `${path}.success`),
    substitutions: substitutions(source.substitutions, `${path}.substitutions`),
    aliases: aliases(source.aliases, `${path}.aliases`),
  }
}

function interpretStep(value: unknown, path: string): InterpretProofStep {
  const source = record(value, path)
  const rule = stringValue(source.rule, `${path}.rule`)
  if (rule !== MTS_TRUSTED_PROOF_RULE) {
    fail(`${path}.rule`, `unsupported trusted rule ${JSON.stringify(rule)}`)
  }

  const step: InterpretProofStep = {
    rule: MTS_TRUSTED_PROOF_RULE,
    expression: stringValue(source.expression, `${path}.expression`),
    context: contextFrame(source.context, `${path}.context`),
    expected: expectedResult(source.expected, `${path}.expected`),
  }

  const decodedSymbols = symbols(source.symbols, `${path}.symbols`)
  const decodedMemory = distinguishedMemory(source.distinguishedMemory, `${path}.distinguishedMemory`)
  return {
    ...step,
    ...(decodedSymbols === undefined ? {} : { symbols: decodedSymbols }),
    ...(decodedMemory === undefined ? {} : { distinguishedMemory: decodedMemory }),
  }
}

/** Decode an untrusted external value into the exact supported mts-proof/v0.2 surface. */
export function parseProofObject(value: unknown): MtsProofObjectV02 {
  const source = record(value, '$')
  const schema = stringValue(source.schema, '$.schema')
  if (schema !== MTS_PROOF_SCHEMA) {
    fail('$.schema', `expected ${MTS_PROOF_SCHEMA}, got ${JSON.stringify(schema)}`)
  }

  const contractVersion = stringValue(source.contractVersion, '$.contractVersion')
  if (contractVersion !== MTS_CONTRACT_VERSION) {
    fail(
      '$.contractVersion',
      `expected ${MTS_CONTRACT_VERSION}, got ${JSON.stringify(contractVersion)}`
    )
  }

  if (!Array.isArray(source.steps)) fail('$.steps', 'expected steps array')
  return {
    schema: MTS_PROOF_SCHEMA,
    contractVersion: MTS_CONTRACT_VERSION,
    steps: source.steps.map((step, index) => interpretStep(step, `$.steps[${index}]`)),
  }
}

/** Parse and validate an untrusted JSON proof artifact. */
export function parseProofJson(source: string): MtsProofObjectV02 {
  let value: unknown
  try {
    value = JSON.parse(source) as unknown
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'invalid JSON'
    fail('$', `invalid JSON: ${message}`)
  }
  return parseProofObject(value)
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

/** Independently validate and replay every trusted step in a proof object. */
export function checkProof(proof: MtsProofObjectV02): boolean {
  try {
    const decoded = parseProofObject(proof)
    return decoded.steps.every(checkInterpretProofStep)
  } catch {
    return false
  }
}
