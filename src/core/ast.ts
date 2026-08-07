/**
 * AST types for the МТС formal notation consumed from anum_docs.
 *
 * This module is shared by parser, prover and visual projection. Display text
 * is never semantic identity: repeated forms remain separate AST occurrences.
 */

/** Source location for error reporting */
export interface SourceLocation {
  start: { line: number; column: number; offset: number }
  end: { line: number; column: number; offset: number }
}

/** Base interface for all AST nodes */
export interface ASTNode {
  type: string
  loc?: SourceLocation
}

/** Link expression: a ⟼ b */
export interface LinkExpr extends ASTNode {
  type: 'Link'
  left: ASTNode
  right: ASTNode
}

/** Not-link expression: a !-> b (legacy sugar for !(a -> b)) */
export interface NotLinkExpr extends ASTNode {
  type: 'NotLink'
  left: ASTNode
  right: ASTNode
}

/** Definition expression: s : F */
export interface DefExpr extends ASTNode {
  type: 'Definition'
  name: ASTNode
  form: ASTNode
}

/** Equality expression: A = B */
export interface EqExpr extends ASTNode {
  type: 'Equality'
  left: ASTNode
  right: ASTNode
}

/** Inequality expression: A != B */
export interface NeqExpr extends ASTNode {
  type: 'Inequality'
  left: ASTNode
  right: ASTNode
}

/** Glyph ♂ node. Canonical v0.2 uses it as postfix end projection F♂. */
export interface MaleExpr extends ASTNode {
  type: 'Male'
  operand: ASTNode
}

/** Glyph ♀ node. Canonical v0.2 uses it as prefix start projection ♀F. */
export interface FemaleExpr extends ASTNode {
  type: 'Female'
  operand: ASTNode
}

/** Negation/inversion: !x or ¬x */
export interface NotExpr extends ASTNode {
  type: 'Not'
  operand: ASTNode
}

/** Power expression retained until old prover consumers are migrated. */
export interface PowerExpr extends ASTNode {
  type: 'Power'
  base: ASTNode
  exponent: number
}

/** Bundle expression: { A, B, C } */
export interface SetExpr extends ASTNode {
  type: 'Set'
  elements: ASTNode[]
}

/** Infinity/akorень: ∞ */
export interface InfinityExpr extends ASTNode {
  type: 'Infinity'
}

/** Numeric constants: 0, 1 */
export interface NumExpr extends ASTNode {
  type: 'Num'
  value: 0 | 1
}

/** Identifier/symbol. */
export interface IdentExpr extends ASTNode {
  type: 'Identifier'
  name: string
}

/** Abit literal: '...' */
export interface AbitLitExpr extends ASTNode {
  type: 'AbitLit'
  value: string
}

/** String literal: "..." */
export interface StringLitExpr extends ASTNode {
  type: 'StringLit'
  value: string
}

/** Literal square-boundary glyph, e.g. `([)` or `(])`. */
export interface BracketExpr extends ASTNode {
  type: 'Bracket'
  side: 'left' | 'right'
}

/** Canonical L2 square form: [], [1], [0], [...]. */
export interface SquareExpr extends ASTNode {
  type: 'Square'
  content: ASTNode | null
}

/** One of exactly two atomic current/ancestor context pronouns. */
export interface ContextPronounExpr extends ASTNode {
  type: 'ContextPronoun'
  pole: 'start' | 'end'
  /** 0=current context, 1=parent, 2=grandparent, ... */
  up: number
}

/** Statement wrapper used by the application file parser. */
export interface Statement extends ASTNode {
  type: 'Statement'
  expr: ASTNode
}

/** File: sequence of statements */
export interface File extends ASTNode {
  type: 'File'
  statements: Statement[]
}

/** Type guards */
export function isLinkExpr(node: ASTNode): node is LinkExpr {
  return node.type === 'Link'
}

export function isNotLinkExpr(node: ASTNode): node is NotLinkExpr {
  return node.type === 'NotLink'
}

export function isDefExpr(node: ASTNode): node is DefExpr {
  return node.type === 'Definition'
}

export function isEqExpr(node: ASTNode): node is EqExpr {
  return node.type === 'Equality'
}

export function isNeqExpr(node: ASTNode): node is NeqExpr {
  return node.type === 'Inequality'
}

export function isMaleExpr(node: ASTNode): node is MaleExpr {
  return node.type === 'Male'
}

export function isFemaleExpr(node: ASTNode): node is FemaleExpr {
  return node.type === 'Female'
}

export function isNotExpr(node: ASTNode): node is NotExpr {
  return node.type === 'Not'
}

export function isPowerExpr(node: ASTNode): node is PowerExpr {
  return node.type === 'Power'
}

export function isSetExpr(node: ASTNode): node is SetExpr {
  return node.type === 'Set'
}

export function isInfinityExpr(node: ASTNode): node is InfinityExpr {
  return node.type === 'Infinity'
}

export function isNumExpr(node: ASTNode): node is NumExpr {
  return node.type === 'Num'
}

export function isIdentExpr(node: ASTNode): node is IdentExpr {
  return node.type === 'Identifier'
}

export function isAbitLitExpr(node: ASTNode): node is AbitLitExpr {
  return node.type === 'AbitLit'
}

export function isStringLitExpr(node: ASTNode): node is StringLitExpr {
  return node.type === 'StringLit'
}

export function isBracketExpr(node: ASTNode): node is BracketExpr {
  return node.type === 'Bracket'
}

export function isSquareExpr(node: ASTNode): node is SquareExpr {
  return node.type === 'Square'
}

export function isContextPronounExpr(node: ASTNode): node is ContextPronounExpr {
  return node.type === 'ContextPronoun'
}

/** Pretty print AST node for debugging. */
export function astToString(node: ASTNode): string {
  switch (node.type) {
    case 'Link':
      return `(${astToString((node as LinkExpr).left)} ⟼ ${astToString((node as LinkExpr).right)})`
    case 'NotLink':
      return `(${astToString((node as NotLinkExpr).left)} !-> ${astToString((node as NotLinkExpr).right)})`
    case 'Definition':
      return `${astToString((node as DefExpr).name)} : ${astToString((node as DefExpr).form)}`
    case 'Equality':
      return `(${astToString((node as EqExpr).left)} = ${astToString((node as EqExpr).right)})`
    case 'Inequality':
      return `(${astToString((node as NeqExpr).left)} != ${astToString((node as NeqExpr).right)})`
    case 'Male':
      return `${astToString((node as MaleExpr).operand)}♂`
    case 'Female':
      return `♀${astToString((node as FemaleExpr).operand)}`
    case 'Not':
      return `¬${astToString((node as NotExpr).operand)}`
    case 'Power':
      return `${astToString((node as PowerExpr).base)}^${(node as PowerExpr).exponent}`
    case 'Set':
      return `{${(node as SetExpr).elements.map(astToString).join(', ')}}`
    case 'Infinity':
      return '∞'
    case 'Num':
      return String((node as NumExpr).value)
    case 'Identifier':
      return (node as IdentExpr).name
    case 'AbitLit':
      return `'${(node as AbitLitExpr).value}'`
    case 'StringLit':
      return `"${(node as StringLitExpr).value}"`
    case 'Bracket':
      return (node as BracketExpr).side === 'left' ? '[' : ']'
    case 'Square': {
      const content = (node as SquareExpr).content
      return `[${content === null ? '' : astToString(content)}]`
    }
    case 'ContextPronoun': {
      const pronoun = node as ContextPronounExpr
      return `${'↑'.repeat(pronoun.up)}${pronoun.pole === 'start' ? '◁' : '▷'}`
    }
    case 'Statement':
      return `${astToString((node as Statement).expr)}.`
    case 'File':
      return (node as File).statements.map(astToString).join('\n')
    default:
      return `<unknown: ${node.type}>`
  }
}
