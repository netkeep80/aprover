/**
 * String Anumbers parser for МТС (Meta-Theory of Links)
 *
 * String anumbers (.astr) represent data as left-associative chains of character links.
 *
 * A string "c₁c₂...cₙ" is interpreted as:
 *   (((∞ -> 'c₁') -> 'c₂') -> ... -> 'cₙ')
 *
 * Each character becomes a CharLit node linked to the previous chain.
 * The chain always starts from ∞ (infinity/akorern).
 *
 * Example:
 *   "связь" ≡ (((((∞ -> 'с') -> 'в') -> 'я') -> 'з') -> 'ь')
 */

import type {
  ASTNode,
  File,
  Statement,
  LinkExpr,
  InfinityExpr,
  CharLitExpr,
  SourceLocation,
} from './ast'

/** Error during string anumber parsing */
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

/** Options for string anumber parsing */
export interface StringAnumOptions {
  /** Whether to preserve line breaks as separate statements */
  lineAsStatement?: boolean
  /** Whether to skip empty lines */
  skipEmptyLines?: boolean
  /** Whether to skip lines starting with // (comments) */
  skipComments?: boolean
}

const defaultOptions: StringAnumOptions = {
  lineAsStatement: true,
  skipEmptyLines: true,
  skipComments: true,
}

/** Create infinity node */
function makeInfinity(loc?: SourceLocation): InfinityExpr {
  return { type: 'Infinity', loc }
}

/** Create character literal node */
function makeCharLit(char: string, loc?: SourceLocation): CharLitExpr {
  return { type: 'CharLit', char, loc }
}

/** Create link node */
function makeLink(left: ASTNode, right: ASTNode, loc?: SourceLocation): LinkExpr {
  return { type: 'Link', left, right, loc }
}

/** Create source location */
function makeLoc(
  startLine: number,
  startColumn: number,
  startOffset: number,
  endLine: number,
  endColumn: number,
  endOffset: number
): SourceLocation {
  return {
    start: { line: startLine, column: startColumn, offset: startOffset },
    end: { line: endLine, column: endColumn, offset: endOffset },
  }
}

/**
 * Convert a single line of string anumber to AST
 *
 * An empty string produces just ∞
 * A single character "c" produces (∞ -> 'c')
 * A string "abc" produces ((∞ -> 'a') -> 'b') -> 'c')
 */
export function parseStringAnumLine(
  line: string,
  lineNumber: number = 1,
  startOffset: number = 0
): ASTNode {
  // Empty line produces ∞
  if (line.length === 0) {
    const loc = makeLoc(lineNumber, 1, startOffset, lineNumber, 1, startOffset)
    return makeInfinity(loc)
  }

  // Start with ∞
  const infLoc = makeLoc(lineNumber, 1, startOffset, lineNumber, 1, startOffset)
  let result: ASTNode = makeInfinity(infLoc)

  // Build left-associative chain: (((∞ -> c₁) -> c₂) -> ... -> cₙ)
  let column = 1
  let offset = startOffset

  // Use Array.from to properly handle Unicode characters
  const chars = Array.from(line)

  for (const char of chars) {
    const charLoc = makeLoc(
      lineNumber,
      column,
      offset,
      lineNumber,
      column + 1,
      offset + char.length
    )
    const charNode = makeCharLit(char, charLoc)

    const linkLoc = makeLoc(
      result.loc?.start.line || lineNumber,
      result.loc?.start.column || 1,
      result.loc?.start.offset || startOffset,
      lineNumber,
      column + 1,
      offset + char.length
    )
    result = makeLink(result, charNode, linkLoc)

    column++
    offset += char.length
  }

  return result
}

/**
 * Parse string anumber file content to AST
 *
 * Each non-empty line becomes a statement containing the character chain.
 * Lines starting with // are treated as comments and skipped.
 */
export function parseStringAnum(content: string, options: StringAnumOptions = {}): File {
  const opts = { ...defaultOptions, ...options }
  const statements: Statement[] = []
  const lines = content.split('\n')

  let offset = 0
  let lineNumber = 1

  const startLoc = makeLoc(1, 1, 0, 1, 1, 0)

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments
    if (opts.skipComments && trimmed.startsWith('//')) {
      offset += line.length + 1 // +1 for newline
      lineNumber++
      continue
    }

    // Skip empty lines if configured
    if (opts.skipEmptyLines && trimmed.length === 0) {
      offset += line.length + 1
      lineNumber++
      continue
    }

    // Parse the line
    const expr = opts.lineAsStatement
      ? parseStringAnumLine(trimmed, lineNumber, offset)
      : parseStringAnumLine(line, lineNumber, offset)

    const stmtLoc = makeLoc(
      lineNumber,
      1,
      offset,
      lineNumber,
      (opts.lineAsStatement ? trimmed : line).length + 1,
      offset + (opts.lineAsStatement ? trimmed : line).length
    )

    statements.push({
      type: 'Statement',
      expr,
      loc: stmtLoc,
    })

    offset += line.length + 1
    lineNumber++
  }

  const endLoc = makeLoc(lineNumber, 1, offset, lineNumber, 1, offset)

  return {
    type: 'File',
    statements,
    loc: {
      start: startLoc.start,
      end: endLoc.end,
    },
  }
}

/**
 * Parse a single string anumber expression (without treating lines as statements)
 *
 * The entire content is treated as one string to convert.
 */
export function parseStringAnumExpr(content: string): ASTNode {
  return parseStringAnumLine(content, 1, 0)
}

/**
 * Convert AST back to string anumber format
 *
 * This extracts characters from left-associative chains of CharLit nodes.
 * Returns null if the AST doesn't represent a valid string anumber.
 */
export function toStringAnum(node: ASTNode): string | null {
  const chars: string[] = []

  function traverse(n: ASTNode): boolean {
    if (n.type === 'Infinity') {
      return true
    }

    if (n.type === 'Link') {
      const link = n as LinkExpr
      if (!traverse(link.left)) return false
      if (link.right.type === 'CharLit') {
        chars.push((link.right as CharLitExpr).char)
        return true
      }
      return false
    }

    // Single CharLit at the end (edge case)
    if (n.type === 'CharLit') {
      chars.push((n as CharLitExpr).char)
      return true
    }

    return false
  }

  if (traverse(node)) {
    return chars.join('')
  }
  return null
}

/**
 * Check if an AST node represents a valid string anumber
 *
 * A valid string anumber is a left-associative chain of links
 * starting from ∞ with CharLit nodes on the right side.
 */
export function isStringAnumExpr(node: ASTNode): boolean {
  return toStringAnum(node) !== null
}

/**
 * Convert string anumber to formal notation string
 *
 * Example: "ab" → "(∞ -> 'a') -> 'b'"
 */
export function stringAnumToFormal(str: string): string {
  if (str.length === 0) {
    return '∞'
  }

  const chars = Array.from(str)
  let result = '∞'

  for (const char of chars) {
    // Escape single quote if needed
    const escapedChar = char === "'" ? "\\'" : char
    result = `(${result} -> '${escapedChar}')`
  }

  return result
}

/**
 * Generate .mtl content from .astr content
 *
 * Each line in .astr becomes a statement in .mtl
 */
export function stringAnumFileToMtl(content: string, options: StringAnumOptions = {}): string {
  const opts = { ...defaultOptions, ...options }
  const lines = content.split('\n')
  const mtlLines: string[] = []

  mtlLines.push('// Generated from .astr file')
  mtlLines.push('// Each line represents a string anumber (left-associative chain)')
  mtlLines.push('')

  for (const line of lines) {
    const trimmed = line.trim()

    // Preserve comments
    if (trimmed.startsWith('//')) {
      mtlLines.push(trimmed)
      continue
    }

    // Skip empty lines
    if (opts.skipEmptyLines && trimmed.length === 0) {
      continue
    }

    // Convert to formal notation
    const formal = stringAnumToFormal(opts.lineAsStatement ? trimmed : line)
    mtlLines.push(`${formal}.`)
  }

  return mtlLines.join('\n')
}

/**
 * Visualization of string anumber conversion process
 *
 * Returns an array of intermediate steps showing how
 * the string is converted to a chain of links.
 */
export interface ConversionStep {
  /** Current character being processed */
  char: string
  /** Index of the character (0-based) */
  index: number
  /** Current chain in formal notation */
  formal: string
  /** Description of this step */
  description: string
}

export function visualizeConversion(str: string): ConversionStep[] {
  if (str.length === 0) {
    return [
      {
        char: '',
        index: -1,
        formal: '∞',
        description: 'Empty string equals akorern (∞)',
      },
    ]
  }

  const steps: ConversionStep[] = []
  const chars = Array.from(str)
  let currentFormal = '∞'

  steps.push({
    char: '',
    index: -1,
    formal: currentFormal,
    description: 'Start from akorern (∞)',
  })

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    const escapedChar = char === "'" ? "\\'" : char
    currentFormal = `(${currentFormal} -> '${escapedChar}')`

    steps.push({
      char,
      index: i,
      formal: currentFormal,
      description: `Link character '${char}' (index ${i})`,
    })
  }

  return steps
}

/**
 * Get statistics about a string anumber
 */
export interface StringAnumStats {
  /** Total number of characters */
  charCount: number
  /** Number of unique characters */
  uniqueChars: number
  /** Number of links in the chain */
  linkCount: number
  /** Byte length in UTF-8 */
  byteLength: number
  /** Character frequency map */
  charFrequency: Map<string, number>
}

export function getStringAnumStats(str: string): StringAnumStats {
  const chars = Array.from(str)
  const frequency = new Map<string, number>()

  for (const char of chars) {
    frequency.set(char, (frequency.get(char) || 0) + 1)
  }

  return {
    charCount: chars.length,
    uniqueChars: frequency.size,
    linkCount: chars.length, // Each char creates one link
    byteLength: new TextEncoder().encode(str).length,
    charFrequency: frequency,
  }
}
