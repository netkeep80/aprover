/**
 * Структурный нормализатор канонического AST МТС из anum_docs.
 *
 * Parser сохраняет явные контейнеры. Нормализация следует только принятым
 * структурным правилам и не добавляет самостоятельную алгебру инверсии,
 * пучков или старые prover-era преобразования.
 */

import type { LinkHandle } from '@mts/core'
import type { ASTNode, DefExpr, Statement, File, SourceLocation } from './ast'
import type { SyntaxAsetParseResult } from './syntaxAsetDirectEmitter'
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

export class SyntaxAsetNormalizationError extends Error {
  constructor(
    message: string,
    public occurrence: LinkHandle,
    public loc?: SourceLocation
  ) {
    const locStr = loc ? ` at ${loc.start.line}:${loc.start.column}` : ''
    super(`SyntaxAset normalization error${locStr}: ${message}`)
    this.name = 'SyntaxAsetNormalizationError'
  }
}

export interface SyntaxAsetNormalizationResult {
  readonly canonical: string
  readonly provenance: ReadonlyMap<LinkHandle, SourceLocation>
}

type SyntaxAsetOccurrence = SyntaxAsetParseResult['read']['occurrences'][number]

interface SyntaxAsetView {
  readonly input: SyntaxAsetParseResult
  readonly byHandle: ReadonlyMap<LinkHandle, SyntaxAsetOccurrence>
  readonly carrierScope: LinkHandle
  readonly zero: LinkHandle
  readonly one: LinkHandle
  readonly textScope: LinkHandle
}

function asetError(view: SyntaxAsetView, occurrence: LinkHandle, message: string): never {
  throw new SyntaxAsetNormalizationError(message, occurrence, view.input.provenance.get(occurrence))
}

function findEndSelfClosed(input: SyntaxAsetParseResult, start: LinkHandle): LinkHandle {
  for (const candidate of input.memory.outgoing(start)) {
    if (input.memory.poles(candidate).end === candidate) return candidate
  }
  throw new Error('SyntaxAset carrier vocabulary is incomplete')
}

function findStartSelfClosed(input: SyntaxAsetParseResult, end: LinkHandle): LinkHandle {
  for (const candidate of input.memory.incoming(end)) {
    if (input.memory.poles(candidate).start === candidate) return candidate
  }
  throw new Error('SyntaxAset carrier vocabulary is incomplete')
}

function buildSyntaxAsetView(input: SyntaxAsetParseResult): SyntaxAsetView {
  const carrierScope = findEndSelfClosed(input, input.vocabulary.tag)
  const zero = findStartSelfClosed(input, carrierScope)
  const one = findEndSelfClosed(input, carrierScope)
  const textScope = input.memory.find(carrierScope, one)
  if (textScope === undefined) throw new Error('SyntaxAset text carrier scope is missing')
  return {
    input,
    byHandle: new Map(input.read.occurrences.map(node => [node.occurrence, node])),
    carrierScope,
    zero,
    one,
    textScope,
  }
}

function requireOccurrence(view: SyntaxAsetView, handle: LinkHandle): SyntaxAsetOccurrence {
  const occurrence = view.byHandle.get(handle)
  if (occurrence === undefined) asetError(view, handle, 'Referenced syntax occurrence is missing')
  return occurrence
}

function fieldValues(view: SyntaxAsetView, node: SyntaxAsetOccurrence, role: LinkHandle): LinkHandle[] {
  return node.fields.filter(field => field.role === role).map(field => field.value)
}

function requireField(
  view: SyntaxAsetView,
  node: SyntaxAsetOccurrence,
  role: LinkHandle
): LinkHandle {
  const values = fieldValues(view, node, role)
  if (values.length !== 1) {
    asetError(view, node.occurrence, `Expected exactly one field, got ${values.length}`)
  }
  return values[0]
}

function decodeTextCarrier(view: SyntaxAsetView, carrier: LinkHandle): string {
  const carrierPoles = view.input.memory.poles(carrier)
  if (carrierPoles.start !== carrier) {
    asetError(view, carrier, 'Literal carrier is not start-self-closed')
  }

  let cursor = carrierPoles.end
  const reversedBytes: number[] = []
  while (cursor !== view.textScope) {
    const cursorPoles = view.input.memory.poles(cursor)
    const byteNode = cursorPoles.end
    cursor = cursorPoles.start

    let bitCursor = byteNode
    const reversedBits: number[] = []
    for (let index = 0; index < 8; index += 1) {
      const poles = view.input.memory.poles(bitCursor)
      if (poles.end === view.zero) reversedBits.push(0)
      else if (poles.end === view.one) reversedBits.push(1)
      else asetError(view, carrier, 'Literal carrier contains an invalid bit')
      bitCursor = poles.start
    }
    if (bitCursor !== view.carrierScope) {
      asetError(view, carrier, 'Literal carrier byte does not terminate at carrier scope')
    }

    let byte = 0
    for (const bit of reversedBits.reverse()) byte = (byte << 1) | bit
    reversedBytes.push(byte)
  }

  return new TextDecoder().decode(Uint8Array.from(reversedBytes.reverse()))
}

function decodeTaggedLiteral(view: SyntaxAsetView, handle: LinkHandle): [string, string] {
  const node = requireOccurrence(view, handle)
  if (node.kind !== view.input.vocabulary.kinds.Literal) {
    asetError(view, node.occurrence, 'Expected literal occurrence')
  }
  const encoded = decodeTextCarrier(
    view,
    requireField(view, node, view.input.vocabulary.roles.value)
  )
  const separator = encoded.indexOf('\u0000')
  if (separator < 0) asetError(view, node.occurrence, 'Literal carrier has no type tag')
  return [encoded.slice(0, separator), encoded.slice(separator + 1)]
}

function literalCanonical(view: SyntaxAsetView, node: SyntaxAsetOccurrence): string {
  const [tag, value] = decodeTaggedLiteral(view, node.occurrence)
  if (tag === 'Infinity') return '∞'
  if (tag === 'Num' || tag === 'Identifier') return value
  if (tag === 'AbitLit') return `'${value}'`
  if (tag === 'StringLit') return `"${value}"`
  if (tag === 'Literal') return value
  asetError(view, node.occurrence, `Unsupported literal tag '${tag}'`)
}

function identifierName(view: SyntaxAsetView, handle: LinkHandle): string | null {
  const node = requireOccurrence(view, handle)
  if (node.kind !== view.input.vocabulary.kinds.Literal) return null
  const [tag, value] = decodeTaggedLiteral(view, handle)
  return tag === 'Identifier' ? value : null
}

function containsAsetIdent(
  view: SyntaxAsetView,
  handle: LinkHandle,
  name: string,
  guarded: boolean
): boolean {
  const node = requireOccurrence(view, handle)
  const kinds = view.input.vocabulary.kinds
  const roles = view.input.vocabulary.roles

  if (node.kind === kinds.Literal) return identifierName(view, handle) === name && !guarded
  if (node.kind === kinds.Link) {
    return (
      containsAsetIdent(view, requireField(view, node, roles.start), name, true) ||
      containsAsetIdent(view, requireField(view, node, roles.end), name, true)
    )
  }
  if (node.kind === kinds.Round || node.kind === kinds.Square) {
    const content = fieldValues(view, node, roles.expression)
    return content.length === 0 ? false : containsAsetIdent(view, content[0], name, guarded)
  }
  if (node.kind === kinds.Not || node.kind === kinds.Female || node.kind === kinds.Male) {
    return containsAsetIdent(view, requireField(view, node, roles.operand), name, guarded)
  }
  if (node.kind === kinds.Set || node.kind === kinds.Sequence || node.kind === kinds.File) {
    return fieldValues(view, node, roles.item).some(item =>
      containsAsetIdent(view, item, name, guarded)
    )
  }
  if (node.kind === kinds.Statement) {
    return containsAsetIdent(view, requireField(view, node, roles.expression), name, guarded)
  }
  if (node.kind === kinds.Definition) {
    return (
      containsAsetIdent(view, requireField(view, node, roles.name), name, guarded) ||
      containsAsetIdent(view, requireField(view, node, roles.body), name, guarded)
    )
  }
  if (node.kind === kinds.Equality || node.kind === kinds.Inequality) {
    return (
      containsAsetIdent(view, requireField(view, node, roles.left), name, guarded) ||
      containsAsetIdent(view, requireField(view, node, roles.right), name, guarded)
    )
  }
  return false
}

function checkAsetGuardedRecursion(view: SyntaxAsetView, node: SyntaxAsetOccurrence): void {
  const roles = view.input.vocabulary.roles
  const name = identifierName(view, requireField(view, node, roles.name))
  if (name === null) return
  if (containsAsetIdent(view, requireField(view, node, roles.body), name, false)) {
    asetError(
      view,
      node.occurrence,
      `Unguarded recursion: '${name}' appears in its definition outside of '⟼' constructor`
    )
  }
}

function asetCanonical(
  view: SyntaxAsetView,
  handle: LinkHandle,
  options: NormalizerOptions
): string {
  const node = requireOccurrence(view, handle)
  const kinds = view.input.vocabulary.kinds
  const roles = view.input.vocabulary.roles

  if (node.kind === kinds.File) {
    return fieldValues(view, node, roles.item)
      .map(item => asetCanonical(view, item, options))
      .join('\n')
  }
  if (node.kind === kinds.Statement) {
    return asetCanonical(view, requireField(view, node, roles.expression), options)
  }
  if (node.kind === kinds.Round) {
    const content = fieldValues(view, node, roles.expression)
    return content.length === 0 ? '()' : asetCanonical(view, content[0], options)
  }
  if (node.kind === kinds.Square) {
    const content = fieldValues(view, node, roles.expression)
    return `[${content.length === 0 ? '' : asetCanonical(view, content[0], options)}]`
  }
  if (node.kind === kinds.Link) {
    return `(${asetCanonical(view, requireField(view, node, roles.start), options)}⟼${asetCanonical(view, requireField(view, node, roles.end), options)})`
  }
  if (node.kind === kinds.Definition) {
    if (options.checkGuardedRecursion) checkAsetGuardedRecursion(view, node)
    return `(${asetCanonical(view, requireField(view, node, roles.name), options)}:${asetCanonical(view, requireField(view, node, roles.body), options)})`
  }
  if (node.kind === kinds.Equality) {
    return `(${asetCanonical(view, requireField(view, node, roles.left), options)}=${asetCanonical(view, requireField(view, node, roles.right), options)})`
  }
  if (node.kind === kinds.Inequality) {
    return `(${asetCanonical(view, requireField(view, node, roles.left), options)}!=${asetCanonical(view, requireField(view, node, roles.right), options)})`
  }
  if (node.kind === kinds.Not) {
    return `¬${asetCanonical(view, requireField(view, node, roles.operand), options)}`
  }
  if (node.kind === kinds.Female) {
    return `♀${asetCanonical(view, requireField(view, node, roles.operand), options)}`
  }
  if (node.kind === kinds.Male) {
    return `${asetCanonical(view, requireField(view, node, roles.operand), options)}♂`
  }
  if (node.kind === kinds.Set) {
    return `{${fieldValues(view, node, roles.item)
      .map(item => asetCanonical(view, item, options))
      .join(',')}}`
  }
  if (node.kind === kinds.Sequence) {
    return fieldValues(view, node, roles.item)
      .map(item => asetCanonical(view, item, options))
      .join('')
  }
  if (node.kind === kinds.ContextPronoun) {
    const encoded = decodeTextCarrier(view, requireField(view, node, roles.value))
    const [tag, pole, upText] = encoded.split('\u0000')
    const up = Number(upText)
    if (
      tag !== 'ContextPronoun' ||
      (pole !== 'start' && pole !== 'end') ||
      !Number.isInteger(up) ||
      up < 0
    ) {
      asetError(view, node.occurrence, 'Malformed context-pronoun carrier')
    }
    return `${'↑'.repeat(up)}${pole === 'start' ? '◁' : '▷'}`
  }
  if (node.kind === kinds.Literal) return literalCanonical(view, node)

  asetError(view, node.occurrence, 'Unsupported syntax occurrence kind')
}

/**
 * A3 migration path: structural normalization is read directly from the
 * canonical SyntaxAset occurrence graph. The graph and external provenance
 * remain untouched; the AST normalizer above is only the differential oracle.
 */
export function normalizeSyntaxAset(
  input: SyntaxAsetParseResult,
  options: Partial<NormalizerOptions> = {}
): SyntaxAsetNormalizationResult {
  const opts = { ...defaultOptions, ...options }
  const view = buildSyntaxAsetView(input)
  return Object.freeze({
    canonical: asetCanonical(view, input.read.root, opts),
    provenance: input.provenance,
  })
}

export function syntaxAsetEqual(
  a: SyntaxAsetParseResult,
  b: SyntaxAsetParseResult,
  options: Partial<NormalizerOptions> = {}
): boolean {
  return normalizeSyntaxAset(a, options).canonical === normalizeSyntaxAset(b, options).canonical
}
