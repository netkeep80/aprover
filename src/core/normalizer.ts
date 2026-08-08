/**
 * Структурный нормализатор канонического AST МТС из anum_docs.
 *
 * Parser сохраняет явные контейнеры. Нормализация следует только принятым
 * структурным правилам и не добавляет самостоятельную алгебру инверсии,
 * пучков или старые prover-era преобразования.
 */

import type { ASTNode, DefExpr, Statement, File } from './ast'
import {
  isLinkExpr,
  isDefExpr,
  isEqExpr,
  isNeqExpr,
  isMaleExpr,
  isFemaleExpr,
  isNotExpr,
  isSetExpr,
  isSequenceExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isAbitLitExpr,
  isStringLitExpr,
  isLiteralExpr,
  isRoundExpr,
  isSquareExpr,
  isContextPronounExpr,
} from './ast'

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
  checkGuardedRecursion?: boolean
}

const defaultOptions: NormalizerOptions = {
  checkGuardedRecursion: true,
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
  if (isMaleExpr(node) || isFemaleExpr(node) || isNotExpr(node)) {
    return containsIdent(node.operand, name, guarded)
  }
  if (isSetExpr(node)) return node.elements.some(el => containsIdent(el, name, guarded))
  if (isSequenceExpr(node)) return node.items.some(item => containsIdent(item, name, guarded))
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
      `Unguarded recursion: '${name}' appears in its definition outside of '⟼' constructor`,
      def
    )
  }
}

function normalizeNode(node: ASTNode, options: NormalizerOptions): ASTNode {
  if (isRoundExpr(node)) {
    return node.content === null ? node : normalizeNode(node.content, options)
  }
  if (isSquareExpr(node)) {
    return {
      ...node,
      content: node.content === null ? null : normalizeNode(node.content, options),
    }
  }
  if (isLinkExpr(node)) {
    return {
      ...node,
      left: normalizeNode(node.left, options),
      right: normalizeNode(node.right, options),
    }
  }
  if (isDefExpr(node)) {
    const normalized: DefExpr = {
      ...node,
      name: normalizeNode(node.name, options),
      form: normalizeNode(node.form, options),
    }
    if (options.checkGuardedRecursion) checkGuardedRecursion(normalized)
    return normalized
  }
  if (isEqExpr(node) || isNeqExpr(node)) {
    return {
      ...node,
      left: normalizeNode(node.left, options),
      right: normalizeNode(node.right, options),
    }
  }
  if (isMaleExpr(node) || isFemaleExpr(node) || isNotExpr(node)) {
    return {
      ...node,
      operand: normalizeNode(node.operand, options),
    }
  }
  if (isSetExpr(node)) {
    return { ...node, elements: node.elements.map(el => normalizeNode(el, options)) }
  }
  if (isSequenceExpr(node)) {
    return { ...node, items: node.items.map(item => normalizeNode(item, options)) }
  }
  return node
}

function generateCacheKey(node: ASTNode, opts: NormalizerOptions): string {
  const optsSig = opts.checkGuardedRecursion ? '' : 'G0:'
  return `${optsSig}${toCanonicalString(node)}`
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

/** Структурный ключ синтаксиса, а не дополнительное семантическое равенство. */
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
  if (isLinkExpr(node)) return `(${toCanonicalString(node.left)}⟼${toCanonicalString(node.right)})`
  if (isDefExpr(node)) return `(${toCanonicalString(node.name)}:${toCanonicalString(node.form)})`
  if (isEqExpr(node)) return `(${toCanonicalString(node.left)}=${toCanonicalString(node.right)})`
  if (isNeqExpr(node)) return `(${toCanonicalString(node.left)}!=${toCanonicalString(node.right)})`
  if (isMaleExpr(node)) return `${toCanonicalString(node.operand)}♂`
  if (isFemaleExpr(node)) return `♀${toCanonicalString(node.operand)}`
  if (isNotExpr(node)) return `¬${toCanonicalString(node.operand)}`
  if (isSetExpr(node)) return `{${node.elements.map(toCanonicalString).join(',')}}`
  if (isSequenceExpr(node)) return node.items.map(toCanonicalString).join('')
  if (isInfinityExpr(node)) return '∞'
  if (isNumExpr(node)) return String(node.value)
  if (isIdentExpr(node)) return node.name
  if (isAbitLitExpr(node)) return `'${node.value}'`
  if (isStringLitExpr(node)) return `"${node.value}"`
  return `<unknown:${node.type}>`
}

export function astEqual(a: ASTNode, b: ASTNode): boolean {
  return toCanonicalString(a) === toCanonicalString(b)
}
