/**
 * AST types for the canonical МТС formal notation consumed from anum_docs.
 *
 * Display text is never semantic identity: repeated forms remain separate AST
 * occurrences. Compatibility-only prover-era nodes are intentionally absent.
 */

export interface SourceLocation {
  start: { line: number; column: number; offset: number }
  end: { line: number; column: number; offset: number }
}

export interface ASTNode {
  type: string
  loc?: SourceLocation
}

export interface LinkExpr extends ASTNode {
  type: 'Link'
  left: ASTNode
  right: ASTNode
}

export interface DefExpr extends ASTNode {
  type: 'Definition'
  name: ASTNode
  form: ASTNode
}

export interface EqExpr extends ASTNode {
  type: 'Equality'
  left: ASTNode
  right: ASTNode
}

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

export interface NotExpr extends ASTNode {
  type: 'Not'
  operand: ASTNode
}

/** Bundle syntax { A, B, C }. No value/set algebra is implied by this AST node. */
export interface SetExpr extends ASTNode {
  type: 'Set'
  elements: ASTNode[]
}

export interface InfinityExpr extends ASTNode {
  type: 'Infinity'
}

export interface NumExpr extends ASTNode {
  type: 'Num'
  value: 0 | 1
}

export interface IdentExpr extends ASTNode {
  type: 'Identifier'
  name: string
}

export interface AbitLitExpr extends ASTNode {
  type: 'AbitLit'
  value: string
}

export interface StringLitExpr extends ASTNode {
  type: 'StringLit'
  value: string
}

/** Literal operator/boundary glyph inside a formal container, e.g. (=), (⟼), ([). */
export interface LiteralExpr extends ASTNode {
  type: 'Literal'
  value: string
}

/** Explicit round formal form. Parentheses are not discarded by the parser. */
export interface RoundExpr extends ASTNode {
  type: 'Round'
  content: ASTNode | null
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

export interface Statement extends ASTNode {
  type: 'Statement'
  expr: ASTNode
}

export interface File extends ASTNode {
  type: 'File'
  statements: Statement[]
}

export function isLinkExpr(node: ASTNode): node is LinkExpr {
  return node.type === 'Link'
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
export function isLiteralExpr(node: ASTNode): node is LiteralExpr {
  return node.type === 'Literal'
}
export function isRoundExpr(node: ASTNode): node is RoundExpr {
  return node.type === 'Round'
}
export function isSquareExpr(node: ASTNode): node is SquareExpr {
  return node.type === 'Square'
}
export function isContextPronounExpr(node: ASTNode): node is ContextPronounExpr {
  return node.type === 'ContextPronoun'
}

/** Human-readable structural printer; it preserves explicit containers. */
export function astToString(node: ASTNode): string {
  switch (node.type) {
    case 'Link':
      return `(${astToString((node as LinkExpr).left)} ⟼ ${astToString((node as LinkExpr).right)})`
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
    case 'Literal':
      return (node as LiteralExpr).value
    case 'Round': {
      const content = (node as RoundExpr).content
      return `(${content === null ? '' : astToString(content)})`
    }
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
