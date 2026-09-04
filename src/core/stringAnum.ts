/**
 * String data adapter for aprover.
 *
 * `.astr` is an application input format, not an alternative MTS grammar.
 * Its projection into MTS source emits only the canonical v0.2 link glyph `⟼`.
 * The adapter stays source-oriented and does not expose a completed AST product.
 */

import { fileToMtl } from './utils'

export class StringAnumError extends Error {
  constructor(
    message: string,
    public offset: number,
    public char?: string
  ) {
    super(`StringAnum error at position ${offset}: ${message}`)
    this.name = 'StringAnumError'
  }
}

export interface StringAnumOptions {
  lineAsStatement?: boolean
  skipEmptyLines?: boolean
  skipComments?: boolean
}

const defaultOptions: StringAnumOptions = {
  lineAsStatement: true,
  skipEmptyLines: true,
  skipComments: true,
}

export function stringAnumToFormal(str: string): string {
  if (str.length === 0) return '∞'
  const escapedStr = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `(∞ ⟼ "${escapedStr}")`
}

export function stringAnumFileToMtl(content: string, options: StringAnumOptions = {}): string {
  const opts = { ...defaultOptions, ...options }

  return fileToMtl(
    content,
    {
      skipEmptyLines: opts.skipEmptyLines,
      headerLines: [
        '// Generated from .astr application data',
        '// Projection uses canonical MTS v0.2 syntax; .astr is not a second grammar.',
      ],
    },
    (_line, trimmed) => trimmed.length === 0,
    line => stringAnumToFormal(opts.lineAsStatement ? line.trim() : line)
  )
}

export interface ConversionStep {
  value: string
  formal: string
  description: string
}

export function visualizeConversion(str: string): ConversionStep[] {
  if (str.length === 0) {
    return [
      {
        value: '',
        formal: '∞',
        description: 'Empty string projects to akorern (∞)',
      },
    ]
  }

  return [
    {
      value: '',
      formal: '∞',
      description: 'Start from akorern (∞)',
    },
    {
      value: str,
      formal: stringAnumToFormal(str),
      description: `Project string "${str}" as one StringLit endpoint`,
    },
  ]
}

export interface StringAnumStats {
  charCount: number
  uniqueChars: number
  linkCount: number
  byteLength: number
  charFrequency: Map<string, number>
}

export function getStringAnumStats(str: string): StringAnumStats {
  const chars = Array.from(str)
  const frequency = new Map<string, number>()

  for (const char of chars) frequency.set(char, (frequency.get(char) || 0) + 1)

  return {
    charCount: chars.length,
    uniqueChars: frequency.size,
    linkCount: chars.length,
    byteLength: new TextEncoder().encode(str).length,
    charFrequency: frequency,
  }
}
