import type {
  ASTNode,
  LinkExpr,
  DefExpr,
  EqExpr,
  NeqExpr,
  MaleExpr,
  FemaleExpr,
  NotExpr,
  SetExpr,
  NumExpr,
  IdentExpr,
  AbitLitExpr,
  StringLitExpr,
  LiteralExpr,
  RoundExpr,
  SquareExpr,
  ContextPronounExpr,
} from './ast'

const PRECEDENCE = {
  definition: 1,
  equality: 2,
  link: 3,
  prefix: 4,
  postfix: 5,
  atom: 6,
} as const

function render(node: ASTNode, parentPrecedence = 0, rightOfLeftAssociative = false): string {
  let text: string
  let precedence: number

  switch (node.type) {
    case 'Definition': {
      const definition = node as DefExpr
      text = `${render(definition.name, PRECEDENCE.definition)} : ${render(definition.form, PRECEDENCE.definition)}`
      precedence = PRECEDENCE.definition
      break
    }
    case 'Equality': {
      const equality = node as EqExpr
      text = `${render(equality.left, PRECEDENCE.equality)} = ${render(equality.right, PRECEDENCE.equality)}`
      precedence = PRECEDENCE.equality
      break
    }
    case 'Inequality': {
      const inequality = node as NeqExpr
      text = `${render(inequality.left, PRECEDENCE.equality)} != ${render(inequality.right, PRECEDENCE.equality)}`
      precedence = PRECEDENCE.equality
      break
    }
    case 'Link': {
      const link = node as LinkExpr
      text = `${render(link.left, PRECEDENCE.link)} ⟼ ${render(link.right, PRECEDENCE.link, true)}`
      precedence = PRECEDENCE.link
      break
    }
    case 'Not': {
      const expression = node as NotExpr
      text = `¬${render(expression.operand, PRECEDENCE.prefix)}`
      precedence = PRECEDENCE.prefix
      break
    }
    case 'Female': {
      const expression = node as FemaleExpr
      text = `♀${render(expression.operand, PRECEDENCE.prefix)}`
      precedence = PRECEDENCE.prefix
      break
    }
    case 'Male': {
      const expression = node as MaleExpr
      text = `${render(expression.operand, PRECEDENCE.postfix)}♂`
      precedence = PRECEDENCE.postfix
      break
    }
    case 'Set': {
      const set = node as SetExpr
      text = `{${set.elements.map(element => render(element)).join(', ')}}`
      precedence = PRECEDENCE.atom
      break
    }
    case 'Round': {
      const round = node as RoundExpr
      text = `(${round.content === null ? '' : render(round.content)})`
      precedence = PRECEDENCE.atom
      break
    }
    case 'Square': {
      const square = node as SquareExpr
      text = `[${square.content === null ? '' : render(square.content)}]`
      precedence = PRECEDENCE.atom
      break
    }
    case 'ContextPronoun': {
      const pronoun = node as ContextPronounExpr
      text = `${'↑'.repeat(pronoun.up)}${pronoun.pole === 'start' ? '◁' : '▷'}`
      precedence = PRECEDENCE.atom
      break
    }
    case 'Literal':
      text = (node as LiteralExpr).value
      precedence = PRECEDENCE.atom
      break
    case 'Infinity':
      text = '∞'
      precedence = PRECEDENCE.atom
      break
    case 'Num':
      text = String((node as NumExpr).value)
      precedence = PRECEDENCE.atom
      break
    case 'Identifier':
      text = (node as IdentExpr).name
      precedence = PRECEDENCE.atom
      break
    case 'AbitLit':
      text = `'${(node as AbitLitExpr).value}'`
      precedence = PRECEDENCE.atom
      break
    case 'StringLit':
      text = `"${(node as StringLitExpr).value}"`
      precedence = PRECEDENCE.atom
      break
    default:
      throw new Error(`Cannot format unsupported AST node type: ${node.type}`)
  }

  const needsParentheses =
    precedence < parentPrecedence ||
    (rightOfLeftAssociative && precedence === PRECEDENCE.link)

  return needsParentheses ? `(${text})` : text
}

/** Serialize one canonical MTS v0.2 AST expression back to formal source. */
export function toMtsSource(node: ASTNode): string {
  return render(node)
}
