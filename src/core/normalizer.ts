/**
 * Normalizer for the МТС AST consumed from anum_docs.
 *
 * The parser preserves explicit L2 containers for round-trip/visual identity.
 * Semantic normalization follows the upstream interpreter boundary:
 * parentheses are transparent grouping, while square forms, literals and
 * context pronouns remain first-class structures.
 */

import type { ASTNode, DefExpr, Statement, File } from './ast'
import {
  isLinkExpr,
  isNotLinkExpr,
  isDefExpr,
  isEqExpr,
  isNeqExpr,
  isMaleExpr,
  isFemaleExpr,
  isNotExpr,
  isPowerExpr,
  isSetExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isAbitLitExpr,
  isStringLitExpr,
  isLiteralExpr,
  isRoundExpr,
  isBracketExpr,
  isSquareExpr,
  isContextPronounExpr,
} from './ast'
import { makeLink, makeNot, makeMale, makeFemale } from './astHelpers'

class NormalizationCache {
  private cache: Map<string, ASTNode> = new Map()
  private maxSize: number
  private hits = 0
  private misses = 0
  private enabled = true

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  get(key: string): ASTNode | undefined {
    if (!this.enabled) return undefined
    const result = this.cache.get(key)
    if (result) this.hits++
    else this.misses++
    return result
  }

  set(key: string, value: ASTNode): void {
    if (!this.enabled) return
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    }
  }
}

const normalizationCache = new NormalizationCache()

export function getNormalizationCache(): NormalizationCache {
  return normalizationCache
}

export function clearNormalizationCache(): void {
  normalizationCache.clear()
}

export function setNormalizationCacheEnabled(enabled: boolean): void {
  normalizationCache.setEnabled(enabled)
}

export function getNormalizationCacheStats(): {
  size: number
  hits: number
  misses: number
  hitRate: number
} {
  return normalizationCache.getStats()
}

export class NormalizationError extends Error {
  constructor(
    message: string,
    public node: ASTNode
  ) {
    const loc = node.loc
    const locStr = loc ? ` at ${loc.start.line}:${loc.start.column}` : ''
    super(`Normalization error${locStr}: ${message}`)
    this.name = 'NormalizationError'
  }
}

export interface NormalizerOptions {
  desugarNotLink?: boolean
  expandPower?: boolean
  canonicalize?: boolean
  checkGuardedRecursion?: boolean
}

const defaultOptions: NormalizerOptions = {
  desugarNotLink: true,
  expandPower: true,
  canonicalize: true,
  checkGuardedRecursion: true,
}

function cloneNode<T extends ASTNode>(node: T): T {
  return JSON.parse(JSON.stringify(node))
}

function expandPower(base: ASTNode, exponent: number): ASTNode {
  if (exponent < 1) {
    throw new NormalizationError('Power exponent must be >= 1', base)
  }
  if (exponent === 1) return cloneNode(base)

  let result = makeLink(cloneNode(base), cloneNode(base))
  for (let i = 3; i <= exponent; i++) {
    result = makeLink(result, cloneNode(base))
  }
  return result
}

function containsIdent(node: ASTNode, name: string, guarded: boolean): boolean {
  if (isRoundExpr(node)) {
    return node.content === null ? false : containsIdent(node.content, name, guarded)
  }
  if (isSquareExpr(node)) {
    return node.content === null ? false : containsIdent(node.content, name, guarded)
  }
  if (isIdentExpr(node)) return node.name === name && !guarded
  if (isLinkExpr(node)) {
    return containsIdent(node.left, name, true) || containsIdent(node.right, name, true)
  }
  if (isNotLinkExpr(node)) {
    return containsIdent(node.left, name, guarded) || containsIdent(node.right, name, guarded)
  }
  if (isMaleExpr(node) || isFemaleExpr(node) || isNotExpr(node)) {
    return containsIdent(node.operand, name, guarded)
  }
  if (isPowerExpr(node)) return containsIdent(node.base, name, guarded)
  if (isSetExpr(node)) return node.elements.some(el => containsIdent(el, name, guarded))
  if (isDefExpr(node)) {
    return containsIdent(node.name, name, guarded) || containsIdent(node.form, name, guarded)
  }
  if (isEqExpr(node) || isNeqExpr(node)) {
    return containsIdent(node.left, name, guarded) || containsIdent(node.right, name, guarded)
  }
  return false
}

function checkGuardedRecursion(def: DefExpr): void {
  if (!isIdentExpr(def.name)) return
  const name = def.name.name
  if (containsIdent(def.form, name, false)) {
    throw new NormalizationError(
      `Unguarded recursion: '${name}' appears in its definition outside of '->' constructor`,
      def
    )
  }
}

function normalizeNode(node: ASTNode, options: NormalizerOptions): ASTNode {
  let normalized: ASTNode

  if (isRoundExpr(node)) {
    if (node.content === null) {
      // Empty () is a genuine formal atom, not grouping that can be erased.
      normalized = node
    } else {
      // Upstream mtc_interpreter._unwrap_round(): explicit parentheses are
      // retained by parser but transparent to semantic matching.
      normalized = normalizeNode(node.content, options)
    }
  } else if (isSquareExpr(node)) {
    normalized = {
      ...node,
      content: node.content === null ? null : normalizeNode(node.content, options),
    }
  } else if (isLinkExpr(node)) {
    normalized = {
      ...node,
      left: normalizeNode(node.left, options),
      right: normalizeNode(node.right, options),
    }
  } else if (isNotLinkExpr(node)) {
    if (options.desugarNotLink) {
      normalized = makeNot(
        makeLink(normalizeNode(node.left, options), normalizeNode(node.right, options))
      )
    } else {
      normalized = {
        ...node,
        left: normalizeNode(node.left, options),
        right: normalizeNode(node.right, options),
      }
    }
  } else if (isDefExpr(node)) {
    normalized = {
      ...node,
      name: normalizeNode(node.name, options),
      form: normalizeNode(node.form, options),
    }
    if (options.checkGuardedRecursion) checkGuardedRecursion(normalized as DefExpr)
  } else if (isEqExpr(node)) {
    normalized = {
      ...node,
      left: normalizeNode(node.left, options),
      right: normalizeNode(node.right, options),
    }
  } else if (isNeqExpr(node)) {
    normalized = {
      ...node,
      left: normalizeNode(node.left, options),
      right: normalizeNode(node.right, options),
    }
  } else if (isMaleExpr(node) || isFemaleExpr(node) || isNotExpr(node)) {
    normalized = {
      ...node,
      operand: normalizeNode(node.operand, options),
    }
  } else if (isPowerExpr(node)) {
    if (options.expandPower) {
      normalized = expandPower(normalizeNode(node.base, options), node.exponent)
    } else {
      normalized = { ...node, base: normalizeNode(node.base, options) }
    }
  } else if (isSetExpr(node)) {
    normalized = { ...node, elements: node.elements.map(el => normalizeNode(el, options)) }
  } else {
    normalized = node
  }

  return options.canonicalize ? canonicalize(normalized) : normalized
}

function canonicalize(node: ASTNode): ASTNode {
  if (!isNotExpr(node)) return node
  const operand = node.operand
  if (isNotExpr(operand)) return operand.operand

  // Keep the historical duality transformation only while old prover
  // consumers are being migrated. The glyph orientation here follows the
  // canonical AST: Female=♀ prefix/start, Male=♂ postfix/end.
  if (isMaleExpr(operand)) return makeFemale(operand.operand)
  if (isFemaleExpr(operand)) return makeMale(operand.operand)
  return node
}

function generateCacheKey(node: ASTNode, opts: NormalizerOptions): string {
  const optsSig = [
    opts.desugarNotLink ? '' : 'D0',
    opts.expandPower ? '' : 'P0',
    opts.canonicalize ? '' : 'C0',
    opts.checkGuardedRecursion ? '' : 'G0',
  ]
    .filter(Boolean)
    .join('')
  const nodeKey = toCanonicalString(node)
  return optsSig ? `${optsSig}:${nodeKey}` : nodeKey
}

export function normalize(node: ASTNode, options: Partial<NormalizerOptions> = {}): ASTNode {
  const opts = { ...defaultOptions, ...options }
  if (normalizationCache.isEnabled()) {
    const cacheKey = generateCacheKey(node, opts)
    const cached = normalizationCache.get(cacheKey)
    if (cached) return cached
    const result = normalizeNode(node, opts)
    normalizationCache.set(cacheKey, result)
    return result
  }
  return normalizeNode(node, opts)
}

export function normalizeFile(file: File, options: Partial<NormalizerOptions> = {}): File {
  return {
    type: 'File',
    statements: file.statements.map(
      stmt =>
        ({
          type: 'Statement',
          expr: normalize(stmt.expr, options),
          loc: stmt.loc,
        }) as Statement
    ),
    loc: file.loc,
  }
}

export function toCanonicalString(node: ASTNode): string {
  if (isRoundExpr(node)) {
    return node.content === null ? '()' : `(${toCanonicalString(node.content)})`
  }
  if (isSquareExpr(node)) {
    return `[${node.content === null ? '' : toCanonicalString(node.content)}]`
  }
  if (isContextPronounExpr(node)) {
    return `${'↑'.repeat(node.up)}${node.pole === 'start' ? '◁' : '▷'}`
  }
  if (isLiteralExpr(node)) return node.value
  if (isLinkExpr(node)) return `(${toCanonicalString(node.left)}->${toCanonicalString(node.right)})`
  if (isNotLinkExpr(node)) {
    return `(${toCanonicalString(node.left)}!->${toCanonicalString(node.right)})`
  }
  if (isDefExpr(node)) return `(${toCanonicalString(node.name)}:${toCanonicalString(node.form)})`
  if (isEqExpr(node)) return `(${toCanonicalString(node.left)}=${toCanonicalString(node.right)})`
  if (isNeqExpr(node)) return `(${toCanonicalString(node.left)}!=${toCanonicalString(node.right)})`
  if (isMaleExpr(node)) return `${toCanonicalString(node.operand)}♂`
  if (isFemaleExpr(node)) return `♀${toCanonicalString(node.operand)}`
  if (isNotExpr(node)) return `¬${toCanonicalString(node.operand)}`
  if (isPowerExpr(node)) return `${toCanonicalString(node.base)}^${node.exponent}`
  if (isSetExpr(node)) {
    const sorted = [...node.elements].map(toCanonicalString).sort()
    return `{${sorted.join(',')}}`
  }
  if (isInfinityExpr(node)) return '∞'
  if (isNumExpr(node)) return String(node.value)
  if (isIdentExpr(node)) return node.name
  if (isAbitLitExpr(node)) return `'${node.value}'`
  if (isStringLitExpr(node)) return `"${node.value}"`
  if (isBracketExpr(node)) return node.side === 'left' ? '[' : ']'
  return `<unknown:${node.type}>`
}

export function astEqual(a: ASTNode, b: ASTNode): boolean {
  return toCanonicalString(a) === toCanonicalString(b)
}
