/**
 * `.anum` raw-carrier adapter for aprover.
 *
 * Normative semantics live in the vendored anum_docs contracts. This module
 * implements only the accepted `anum-raw-carrier/v0.2` transport description.
 * It deliberately does NOT assign L2 denotation to individual abits and does
 * not implement recursive denotation locally.
 */

import { fileToMtl } from './utils'

export const ANUM_RAW_CARRIER_SCHEMA = 'anum-raw-carrier/v0.2' as const
export const VALID_ABITS = ['0', '1', '[', ']'] as const
export type AbitChar = (typeof VALID_ABITS)[number]

export const ABIT_ROLES: Record<AbitChar, `abit:${AbitChar}`> = {
  '[': 'abit:[',
  ']': 'abit:]',
  '1': 'abit:1',
  '0': 'abit:0',
}

export class QuatAnumError extends Error {
  constructor(
    message: string,
    public offset: number,
    public char?: string
  ) {
    super(`Anum raw-carrier error at position ${offset}: ${message}`)
    this.name = 'QuatAnumError'
  }
}

export interface QuatAnumOptions {
  lineAsStatement?: boolean
  skipEmptyLines?: boolean
  skipComments?: boolean
}

const defaultOptions: QuatAnumOptions = {
  lineAsStatement: true,
  skipEmptyLines: true,
  skipComments: true,
}

export interface ValidationResult {
  valid: boolean
  error?: string
  errorOffset?: number
}

export type RawCarrierRole = 'root' | `abit:${AbitChar}`
export type RawCarrierRef = { role: RawCarrierRole } | { node: number }

export interface RawCarrierNode {
  id: number
  start: RawCarrierRef
  end: RawCarrierRef
}

export interface RawCarrierDescription {
  kind: 'raw-carrier'
  raw: string
  nodes: RawCarrierNode[]
  root: RawCarrierRef
}

export interface QuatConversionStep {
  abit: string
  index: number
  definition: string
  formal: string
  description: string
}

export interface QuatAnumStats {
  abitCount: number
  zeroCount: number
  oneCount: number
  openCount: number
  closeCount: number
}

export function isValidAbit(char: string): char is AbitChar {
  return VALID_ABITS.includes(char as AbitChar)
}

function stripLineComment(line: string): string {
  const comment = line.indexOf('//')
  return comment >= 0 ? line.slice(0, comment) : line
}

/**
 * Raw carrier validation is intentionally syntax-light: bracket balance is
 * NOT a carrier invariant. Inputs such as `][` are valid raw carriers and are
 * interpreted only by a later, separately contracted denotation layer.
 */
export function validateQuatAnum(content: string): ValidationResult {
  for (let index = 0; index < content.length; index++) {
    const char = content[index]

    if (/\s/.test(char)) continue
    if (char === '/' && content[index + 1] === '/') {
      while (index < content.length && content[index] !== '\n') index++
      continue
    }
    if (!isValidAbit(char)) {
      return {
        valid: false,
        error: `Invalid raw abit '${char}'. Only 0, 1, [, ] are allowed.`,
        errorOffset: index,
      }
    }
  }

  return { valid: true }
}

export function cleanQuatAnum(content: string): string {
  return content
    .split('\n')
    .map(stripLineComment)
    .join('')
    .replace(/\s/g, '')
}

export function describeRawCarrier(content: string): RawCarrierDescription {
  const validation = validateQuatAnum(content)
  if (!validation.valid) {
    throw new QuatAnumError(validation.error ?? 'Invalid raw carrier', validation.errorOffset ?? 0)
  }

  const raw = cleanQuatAnum(content)
  const nodes: RawCarrierNode[] = []
  let current: RawCarrierRef = { role: 'root' }

  for (let id = 0; id < raw.length; id++) {
    const char = raw[id]
    if (!isValidAbit(char)) throw new QuatAnumError(`Invalid raw abit '${char}'`, id, char)
    const node: RawCarrierNode = {
      id,
      start: current,
      end: { role: ABIT_ROLES[char] },
    }
    nodes.push(node)
    current = { node: id }
  }

  return {
    kind: 'raw-carrier',
    raw,
    nodes,
    root: current,
  }
}

export function quatAnumToStringAnum(content: string): string {
  const validation = validateQuatAnum(content)
  if (!validation.valid) {
    throw new QuatAnumError(validation.error ?? 'Invalid raw carrier', validation.errorOffset ?? 0)
  }
  return cleanQuatAnum(content)
}

/**
 * Lossless presentation bridge for the existing editor.
 *
 * The single-quoted value is an AbitLit transport literal. It is not the
 * denotation of the raw carrier and does not expand protocol roles into MTS
 * formulas. Recursive denotation remains solely defined by the pinned L3
 * contracts.
 */
export function quatAnumFileToMtl(content: string, options: QuatAnumOptions = {}): string {
  const opts = { ...defaultOptions, ...options }

  return fileToMtl(
    content,
    {
      skipEmptyLines: opts.skipEmptyLines,
      headerLines: [
        '// Generated from .anum raw carrier',
        `// Contract: ${ANUM_RAW_CARRIER_SCHEMA}`,
        '// AbitLit below is lossless transport presentation; no L2 denotation is implied.',
      ],
    },
    line => cleanQuatAnum(line).length === 0,
    line => {
      const raw = cleanQuatAnum(opts.lineAsStatement ? line.trim() : line)
      const validation = validateQuatAnum(raw)
      if (!validation.valid) {
        throw new QuatAnumError(validation.error ?? 'Invalid raw carrier', validation.errorOffset ?? 0)
      }
      return `'${raw}'`
    }
  )
}

export function visualizeQuatConversion(content: string): QuatConversionStep[] {
  const carrier = describeRawCarrier(content)
  if (carrier.nodes.length === 0) {
    return [
      {
        abit: '',
        index: -1,
        definition: 'role:root',
        formal: "''",
        description: 'Empty anum raw carrier; no denotation performed',
      },
    ]
  }

  return carrier.nodes.map(node => {
    const abit = carrier.raw[node.id] as AbitChar
    return {
      abit,
      index: node.id,
      definition: ABIT_ROLES[abit],
      formal: `'${carrier.raw.slice(0, node.id + 1)}'`,
      description: `raw-carrier node ${node.id}: append protocol role ${ABIT_ROLES[abit]}`,
    }
  })
}

export function getQuatAnumStats(content: string): QuatAnumStats {
  const raw = quatAnumToStringAnum(content)
  return {
    abitCount: raw.length,
    zeroCount: [...raw].filter(char => char === '0').length,
    oneCount: [...raw].filter(char => char === '1').length,
    openCount: [...raw].filter(char => char === '[').length,
    closeCount: [...raw].filter(char => char === ']').length,
  }
}

export function isQuatAnumContent(content: string): boolean {
  return validateQuatAnum(content).valid
}
