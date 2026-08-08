/**
 * Parser for the canonical МТС formal notation consumed from anum_docs.
 *
 * This is the single aprover parser. Projection fixity follows МТС v0.2:
 * `♀F` is start projection and `F♂` is end projection. Compatibility grammar
 * (`->`, binary `↛`, power, bare `!`) is intentionally absent.
 */

import type { Token, TokenType } from './lexer'
import { Lexer } from './lexer'
import type {
  ASTNode,
  File,
  Statement,
  LinkExpr,
  DefExpr,
  EqExpr,
  NeqExpr,
  MaleExpr,
  FemaleExpr,
  NotExpr,
  SetExpr,
  InfinityExpr,
  NumExpr,
  IdentExpr,
  AbitLitExpr,
  StringLitExpr,
  LiteralExpr,
  RoundExpr,
  SquareExpr,
  ContextPronounExpr,
  SourceLocation,
} from './ast'

export class ParseError extends Error {
  constructor(
    message: string,
    public token: Token
  ) {
    super(`Parse error at ${token.loc.start.line}:${token.loc.start.column}: ${message}`)
    this.name = 'ParseError'
  }
}

export interface ParseResult {
  file: File | null
  error: ParseError | null
  errorLocation?: SourceLocation
}

const ROUND_LITERALS = new Set<TokenType>([
  'ARROW',
  'NOT_ARROW',
  'EQUAL',
  'NOT_EQUAL',
  'DEFINE',
  'LBRACKET',
  'RBRACKET',
])

export class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private current(): Token {
    return this.tokens[this.pos]
  }

  private peek(n = 1): Token {
    return this.tokens[this.pos + n] || this.tokens[this.tokens.length - 1]
  }

  private advance(): Token {
    const token = this.current()
    if (this.pos < this.tokens.length - 1) this.pos++
    return token
  }

  private check(type: TokenType): boolean {
    return this.current().type === type
  }

  private checkAny(...types: TokenType[]): boolean {
    return types.includes(this.current().type)
  }

  private expect(type: TokenType): Token {
    if (!this.check(type)) {
      throw new ParseError(`Expected ${type}, got ${this.current().type}`, this.current())
    }
    return this.advance()
  }

  private mergeLoc(start: SourceLocation, end: SourceLocation): SourceLocation {
    return { start: start.start, end: end.end }
  }

  parseFile(): File {
    const statements: Statement[] = []
    const startLoc = this.current().loc
    while (!this.check('EOF')) statements.push(this.parseStatement())
    return {
      type: 'File',
      statements,
      loc: this.mergeLoc(startLoc, this.current().loc),
    }
  }

  parseFileWithRecovery(): ParseResult {
    const statements: Statement[] = []
    const startLoc = this.current().loc
    let error: ParseError | null = null
    let errorLocation: SourceLocation | undefined

    while (!this.check('EOF')) {
      try {
        statements.push(this.parseStatement())
      } catch (e) {
        if (e instanceof ParseError) {
          error = e
          errorLocation = e.token.loc
          break
        }
        throw e
      }
    }

    const file: File | null =
      statements.length > 0
        ? {
            type: 'File',
            statements,
            loc: this.mergeLoc(startLoc, this.current().loc),
          }
        : null

    return { file, error, errorLocation }
  }

  private parseStatement(): Statement {
    const expr = this.parseExpr()
    let endLoc = expr.loc!
    if (this.checkAny('COMMA', 'DOT')) endLoc = this.advance().loc
    return {
      type: 'Statement',
      expr,
      loc: this.mergeLoc(expr.loc!, endLoc),
    }
  }

  private parseExpr(): ASTNode {
    const left = this.parseTerm()

    if (this.check('DEFINE')) {
      this.advance()
      const right = this.parseTerm()
      return {
        type: 'Definition',
        name: left,
        form: right,
        loc: this.mergeLoc(left.loc!, right.loc!),
      } as DefExpr
    }

    if (this.check('EQUAL')) {
      this.advance()
      const right = this.parseTerm()
      return {
        type: 'Equality',
        left,
        right,
        loc: this.mergeLoc(left.loc!, right.loc!),
      } as EqExpr
    }

    if (this.check('NOT_EQUAL')) {
      this.advance()
      const right = this.parseTerm()
      return {
        type: 'Inequality',
        left,
        right,
        loc: this.mergeLoc(left.loc!, right.loc!),
      } as NeqExpr
    }

    return left
  }

  private parseTerm(): ASTNode {
    return this.parseChain()
  }

  private parseChain(): ASTNode {
    let left = this.parsePref()

    while (this.check('ARROW')) {
      this.advance()
      const right = this.parsePref()
      left = {
        type: 'Link',
        left,
        right,
        loc: this.mergeLoc(left.loc!, right.loc!),
      } as LinkExpr
    }

    return left
  }

  /** Canonical prefix operators: inversion `¬` and start projection `♀`. */
  private parsePref(): ASTNode {
    const prefixes: { type: 'NOT' | 'FEMALE'; loc: SourceLocation }[] = []

    while (this.checkAny('NOT', 'FEMALE')) {
      const token = this.current()
      prefixes.push({ type: token.type as 'NOT' | 'FEMALE', loc: token.loc })
      this.advance()
    }

    let node = this.parsePost()

    for (let i = prefixes.length - 1; i >= 0; i--) {
      const prefix = prefixes[i]
      if (prefix.type === 'NOT') {
        node = {
          type: 'Not',
          operand: node,
          loc: this.mergeLoc(prefix.loc, node.loc!),
        } as NotExpr
      } else {
        node = {
          type: 'Female',
          operand: node,
          loc: this.mergeLoc(prefix.loc, node.loc!),
        } as FemaleExpr
      }
    }

    return node
  }

  /** Canonical postfix operator: end projection `F♂`. */
  private parsePost(): ASTNode {
    let node = this.parseAtom()

    while (this.check('MALE')) {
      const loc = this.advance().loc
      node = {
        type: 'Male',
        operand: node,
        loc: this.mergeLoc(node.loc!, loc),
      } as MaleExpr
    }

    return node
  }

  private parseAtom(): ASTNode {
    const token = this.current()

    if (this.check('INFINITY')) {
      this.advance()
      return { type: 'Infinity', loc: token.loc } as InfinityExpr
    }
    if (this.check('ZERO')) {
      this.advance()
      return { type: 'Num', value: 0, loc: token.loc } as NumExpr
    }
    if (this.check('ONE')) {
      this.advance()
      return { type: 'Num', value: 1, loc: token.loc } as NumExpr
    }
    if (this.checkAny('CONTEXT_START', 'CONTEXT_END', 'CONTEXT_UP')) {
      return this.parseContextPronoun()
    }
    if (this.check('ID')) {
      this.advance()
      return { type: 'Identifier', name: token.value, loc: token.loc } as IdentExpr
    }
    if (this.check('NAT')) {
      this.advance()
      return { type: 'Identifier', name: token.value, loc: token.loc } as IdentExpr
    }
    if (this.check('ABIT_LIT')) {
      this.advance()
      return { type: 'AbitLit', value: token.value, loc: token.loc } as AbitLitExpr
    }
    if (this.check('STRING_LIT')) {
      this.advance()
      return { type: 'StringLit', value: token.value, loc: token.loc } as StringLitExpr
    }
    if (this.check('LBRACE')) return this.parseSet()
    if (this.check('LPAREN')) return this.parseRound()
    if (this.check('LBRACKET')) return this.parseSquare()

    throw new ParseError(`Unexpected token: ${token.type}`, token)
  }

  private parseContextPronoun(): ContextPronounExpr {
    const first = this.current()
    let up = 0
    while (this.check('CONTEXT_UP')) {
      this.advance()
      up++
    }

    const pole = this.current()
    if (!this.checkAny('CONTEXT_START', 'CONTEXT_END')) {
      throw new ParseError('Expected ◁ or ▷ after ↑', first)
    }
    this.advance()

    return {
      type: 'ContextPronoun',
      pole: pole.type === 'CONTEXT_START' ? 'start' : 'end',
      up,
      loc: this.mergeLoc(first.loc, pole.loc),
    } as ContextPronounExpr
  }

  private parseRound(): RoundExpr {
    const opening = this.expect('LPAREN')
    if (this.check('RPAREN')) {
      const closing = this.advance()
      return { type: 'Round', content: null, loc: this.mergeLoc(opening.loc, closing.loc) }
    }

    if (ROUND_LITERALS.has(this.current().type) && this.peek().type === 'RPAREN') {
      const literalToken = this.advance()
      const closing = this.expect('RPAREN')
      const literal: LiteralExpr = {
        type: 'Literal',
        value: literalToken.value,
        loc: literalToken.loc,
      }
      return {
        type: 'Round',
        content: literal,
        loc: this.mergeLoc(opening.loc, closing.loc),
      }
    }

    const content = this.parseExpr()
    const closing = this.expect('RPAREN')
    return { type: 'Round', content, loc: this.mergeLoc(opening.loc, closing.loc) }
  }

  private parseSquare(): SquareExpr {
    const opening = this.expect('LBRACKET')
    if (this.check('RBRACKET')) {
      const closing = this.advance()
      return {
        type: 'Square',
        content: null,
        loc: this.mergeLoc(opening.loc, closing.loc),
      }
    }

    const content = this.parseExpr()
    const closing = this.expect('RBRACKET')
    return { type: 'Square', content, loc: this.mergeLoc(opening.loc, closing.loc) }
  }

  private parseSet(): SetExpr {
    const lbrace = this.expect('LBRACE')
    const elements: ASTNode[] = []

    if (!this.check('RBRACE')) {
      elements.push(this.parseExpr())
      while (this.check('COMMA')) {
        this.advance()
        elements.push(this.parseExpr())
      }
    }

    const rbrace = this.expect('RBRACE')
    return {
      type: 'Set',
      elements,
      loc: this.mergeLoc(lbrace.loc, rbrace.loc),
    }
  }
}

export function parse(input: string): File {
  const lexer = new Lexer(input)
  return new Parser(lexer.tokenize()).parseFile()
}

export function parseWithRecovery(input: string): ParseResult {
  const lexer = new Lexer(input)
  return new Parser(lexer.tokenize()).parseFileWithRecovery()
}

export function parseExpr(input: string): ASTNode {
  const lexer = new Lexer(input)
  const tokens = lexer.tokenize()
  const file = new Parser(tokens).parseFile()
  if (file.statements.length !== 1) {
    throw new ParseError('Expected single expression', tokens[0])
  }
  return file.statements[0].expr
}
