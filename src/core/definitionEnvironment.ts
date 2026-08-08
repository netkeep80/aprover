import type {
  ASTNode,
  DefExpr,
  LinkExpr,
  EqExpr,
  NeqExpr,
  MaleExpr,
  FemaleExpr,
  NotExpr,
  SetExpr,
  SequenceExpr,
  IdentExpr,
  AbitLitExpr,
  StringLitExpr,
  LiteralExpr,
  RoundExpr,
  SquareExpr,
  ContextPronounExpr,
  NumExpr,
} from './ast'
import { parseExpr } from './parser'

export type ScopePath = readonly number[]

export interface DefinitionId {
  readonly scopePath: ScopePath
  readonly ordinal: number
}

export type DefinitionRegistrationKind = 'registered' | 'conflict' | 'non-addressable'
export type DefinitionLookupKind = 'match' | 'no-match' | 'conflict' | 'non-addressable'

interface DefinitionEntry {
  readonly id: DefinitionId
  readonly key: string
  readonly definition: DefExpr
}

export interface DefinitionRegistrationResult {
  readonly kind: DefinitionRegistrationKind
  readonly entry?: DefinitionEntry
}

export interface DefinitionOpeningResult {
  readonly kind: DefinitionLookupKind
  readonly definitionId?: DefinitionId
  readonly body?: ASTNode
}

function samePath(left: ScopePath, right: ScopePath): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function assertPath(path: ScopePath, label = 'scope path'): void {
  for (const value of path) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be non-negative`)
  }
}

function precedence(node: ASTNode): number {
  switch (node.type) {
    case 'Definition':
      return 10
    case 'Equality':
    case 'Inequality':
      return 20
    case 'Link':
      return 40
    case 'Sequence':
      return 50
    case 'Not':
      return 60
    case 'Female':
    case 'Male':
      return 70
    default:
      return 100
  }
}

function canonicalInner(node: ASTNode, parentPrecedence: number): string {
  const current = precedence(node)
  let text: string

  switch (node.type) {
    case 'Identifier':
      text = (node as IdentExpr).name
      break
    case 'Infinity':
      text = '∞'
      break
    case 'Num':
      text = String((node as NumExpr).value)
      break
    case 'AbitLit':
      text = `'${(node as AbitLitExpr).value}'`
      break
    case 'StringLit':
      text = `"${(node as StringLitExpr).value}"`
      break
    case 'Literal':
      text = (node as LiteralExpr).value
      break
    case 'ContextPronoun': {
      const value = node as ContextPronounExpr
      text = `${'↑'.repeat(value.up)}${value.pole === 'start' ? '◁' : '▷'}`
      break
    }
    case 'Round': {
      const value = node as RoundExpr
      text = `(${value.content === null ? '' : canonicalInner(value.content, 0)})`
      break
    }
    case 'Square': {
      const value = node as SquareExpr
      text = `[${value.content === null ? '' : canonicalInner(value.content, 0)}]`
      break
    }
    case 'Set':
      text = `{${(node as SetExpr).elements.map(item => canonicalInner(item, 0)).join(', ')}}`
      break
    case 'Sequence':
      text = (node as SequenceExpr).items.map(item => canonicalInner(item, 51)).join('')
      break
    case 'Female':
      text = `♀${canonicalInner((node as FemaleExpr).operand, 70)}`
      break
    case 'Male':
      text = `${canonicalInner((node as MaleExpr).operand, 70)}♂`
      break
    case 'Not':
      text = `¬${canonicalInner((node as NotExpr).operand, 60)}`
      break
    case 'Link': {
      const value = node as LinkExpr
      text = `${canonicalInner(value.left, 40)} ⟼ ${canonicalInner(value.right, 41)}`
      break
    }
    case 'Equality': {
      const value = node as EqExpr
      text = `${canonicalInner(value.left, 20)} = ${canonicalInner(value.right, 21)}`
      break
    }
    case 'Inequality': {
      const value = node as NeqExpr
      text = `${canonicalInner(value.left, 20)} != ${canonicalInner(value.right, 21)}`
      break
    }
    case 'Definition': {
      const value = node as DefExpr
      text = `${canonicalInner(value.name, 10)} : ${canonicalInner(value.form, 10)}`
      break
    }
    default:
      throw new Error(`unsupported AST node ${node.type}`)
  }

  return current < parentPrecedence ? `(${text})` : text
}

/** Canonical formatter matching anum_docs `format_expression` observable output. */
export function canonicalExpression(node: ASTNode): string {
  return canonicalInner(node, 0)
}

type StructuralValue = string | number | null | StructuralValue[]

function structuralValue(node: ASTNode | null): StructuralValue {
  if (node === null) return null

  switch (node.type) {
    // anum_docs represents all of these unquoted atoms as Symbol(name).
    case 'Identifier':
      return ['symbol', (node as IdentExpr).name]
    case 'Infinity':
      return ['symbol', '∞']
    case 'Num':
      return ['symbol', String((node as NumExpr).value)]
    case 'AbitLit':
      return ['symbol', (node as AbitLitExpr).value]
    case 'StringLit':
      return ['symbol', (node as StringLitExpr).value]
    case 'Literal':
      return ['literal', (node as LiteralExpr).value]
    case 'ContextPronoun': {
      const value = node as ContextPronounExpr
      return ['context-pronoun', value.up, value.pole === 'start' ? '◁' : '▷']
    }
    case 'Round':
      return ['round', structuralValue((node as RoundExpr).content)]
    case 'Square':
      return ['square', structuralValue((node as SquareExpr).content)]
    case 'Set':
      return ['bundle', (node as SetExpr).elements.map(structuralValue)]
    case 'Sequence':
      return ['sequence', (node as SequenceExpr).items.map(structuralValue)]
    case 'Female':
      return ['start', structuralValue((node as FemaleExpr).operand)]
    case 'Male':
      return ['end', structuralValue((node as MaleExpr).operand)]
    case 'Not':
      return ['inversion', structuralValue((node as NotExpr).operand)]
    case 'Link': {
      const value = node as LinkExpr
      return ['link', structuralValue(value.left), structuralValue(value.right)]
    }
    case 'Equality': {
      const value = node as EqExpr
      return ['equality', structuralValue(value.left), structuralValue(value.right)]
    }
    case 'Inequality': {
      const value = node as NeqExpr
      return ['inequality', structuralValue(value.left), structuralValue(value.right)]
    }
    case 'Definition': {
      const value = node as DefExpr
      return ['definition', structuralValue(value.name), structuralValue(value.form)]
    }
    default:
      throw new Error(`unsupported AST node ${node.type}`)
  }
}

function isAddressableTarget(node: ASTNode): boolean {
  switch (node.type) {
    case 'Identifier':
    case 'Infinity':
    case 'Num':
    case 'AbitLit':
    case 'StringLit':
    case 'Literal':
      return true
    case 'ContextPronoun':
    case 'Set':
    case 'Equality':
    case 'Inequality':
    case 'Definition':
      return false
    case 'Round': {
      const content = (node as RoundExpr).content
      return content === null || isAddressableTarget(content)
    }
    case 'Square': {
      const content = (node as SquareExpr).content
      return content !== null && isAddressableTarget(content)
    }
    case 'Sequence': {
      const items = (node as SequenceExpr).items
      return items.length > 0 && items.every(isAddressableTarget)
    }
    case 'Female':
      return isAddressableTarget((node as FemaleExpr).operand)
    case 'Male':
      return isAddressableTarget((node as MaleExpr).operand)
    case 'Not':
      return isAddressableTarget((node as NotExpr).operand)
    case 'Link': {
      const value = node as LinkExpr
      return isAddressableTarget(value.left) && isAddressableTarget(value.right)
    }
    default:
      return false
  }
}

export function definitionTargetKey(node: ASTNode): string | null {
  return isAddressableTarget(node) ? JSON.stringify(structuralValue(node)) : null
}

export function parseDefinition(source: string): DefExpr {
  const node = parseExpr(source)
  if (node.type !== 'Definition') throw new Error('definition source must parse as Definition')
  return node as DefExpr
}

export function parseDefinitionTarget(source: string): ASTNode {
  return parseDefinition(`${source} : __proof_query__`).name
}

export class DefinitionEnvironment {
  readonly scopePath: ScopePath
  readonly parent: DefinitionEnvironment | null
  private readonly entries = new Map<string, DefinitionEntry>()
  private readonly conflicts = new Set<string>()
  private readonly children = new Map<number, DefinitionEnvironment>()
  private nextOrdinal = 0

  constructor(scopePath: ScopePath = [], parent: DefinitionEnvironment | null = null) {
    assertPath(scopePath)
    if (parent === null) {
      if (scopePath.length !== 0) throw new Error('root definition scope path must be empty')
    } else {
      if (scopePath.length === 0 || !samePath(scopePath.slice(0, -1), parent.scopePath)) {
        throw new Error('child definition scope path must extend parent by one index')
      }
      const index = scopePath[scopePath.length - 1]
      if (parent.children.has(index)) throw new Error('definition child scope already exists')
      parent.children.set(index, this)
    }
    this.scopePath = [...scopePath]
    this.parent = parent
  }

  child(index: number): DefinitionEnvironment {
    if (!Number.isSafeInteger(index) || index < 0) {
      throw new Error('definition child index must be a non-negative integer')
    }
    const existing = this.children.get(index)
    if (existing !== undefined) return existing
    return new DefinitionEnvironment([...this.scopePath, index], this)
  }

  register(definition: DefExpr): DefinitionRegistrationResult {
    const key = definitionTargetKey(definition.name)
    if (key === null) return { kind: 'non-addressable' }
    if (this.conflicts.has(key)) return { kind: 'conflict' }

    const existing = this.entries.get(key)
    if (existing !== undefined) {
      this.conflicts.add(key)
      return { kind: 'conflict' }
    }

    const entry: DefinitionEntry = {
      id: { scopePath: [...this.scopePath], ordinal: this.nextOrdinal++ },
      key,
      definition,
    }
    this.entries.set(key, entry)
    return { kind: 'registered', entry }
  }

  private lookupKey(key: string): DefinitionOpeningResult {
    if (this.conflicts.has(key)) return { kind: 'conflict' }
    const entry = this.entries.get(key)
    if (entry !== undefined) {
      return {
        kind: 'match',
        definitionId: entry.id,
        body: entry.definition.form,
      }
    }
    return this.parent?.lookupKey(key) ?? { kind: 'no-match' }
  }

  lookup(target: ASTNode): DefinitionOpeningResult {
    const key = definitionTargetKey(target)
    if (key === null) return { kind: 'non-addressable' }
    return this.lookupKey(key)
  }
}

export function openDefinition(
  target: ASTNode,
  environment: DefinitionEnvironment
): DefinitionOpeningResult {
  return environment.lookup(target)
}
