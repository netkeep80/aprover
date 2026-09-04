/**
 * Единственный parser канонической формальной нотации МТС из anum_docs.
 *
 * Фиксация проекций v0.2: `♀F` — проекция начала, `F♂` — проекция конца.
 * Старая совместимая грамматика (`->`, binary `↛`, power, bare `!`) отсутствует.
 */

import type { Token, TokenType } from './lexer'
import { Lexer } from './lexer'
import {
  SyntaxAsetDirectEmitter,
  type SyntaxAsetParseResult,
  type SyntaxAsetReductionRef,
} from './syntaxAsetDirectEmitter'
import type { SourceLocation } from './sourceProvenance'

export class ParseError extends Error {
  constructor(
    message: string,
    public token: Token
  ) {
    super(`Parse error at ${token.loc.start.line}:${token.loc.start.column}: ${message}`)
    this.name = 'ParseError'
  }
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

/** Токены, с которых может начинаться следующая форма в соположении. */
const FORM_STARTS = new Set<TokenType>([
  'INFINITY',
  'ZERO',
  'ONE',
  'CONTEXT_START',
  'CONTEXT_END',
  'CONTEXT_UP',
  'ID',
  'NAT',
  'ABIT_LIT',
  'STRING_LIT',
  'LBRACE',
  'LPAREN',
  'LBRACKET',
  'NOT',
  'FEMALE',
])

export class Parser {
  private pos = 0

  constructor(
    private readonly tokens: Token[],
    private readonly syntaxEmitter: SyntaxAsetDirectEmitter
  ) {}

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

  parseFile(): SyntaxAsetParseResult {
    const statements: SyntaxAsetReductionRef[] = []
    const startLoc = this.current().loc
    while (!this.check('EOF')) statements.push(this.parseStatement())
    return this.syntaxEmitter.finish(statements, this.mergeLoc(startLoc, this.current().loc))
  }

  private parseStatement(): SyntaxAsetReductionRef {
    const expr = this.parseExpression()
    let endLoc = expr.loc
    if (this.checkAny('COMMA', 'DOT')) endLoc = this.advance().loc
    return this.syntaxEmitter.emitStatement(expr, this.mergeLoc(expr.loc, endLoc))
  }

  private parseExpression(): SyntaxAsetReductionRef {
    const left = this.parseTerm()

    if (this.check('DEFINE')) {
      this.advance()
      // `:` is the weakest canonical infix operator and is right-associative:
      // `a : b = c` => Definition(a, Equality(b,c)); `a : b : c` => a : (b : c).
      const right = this.parseExpression()
      return this.syntaxEmitter.emitBinary(
        'Definition',
        left,
        right,
        this.mergeLoc(left.loc, right.loc)
      )
    }

    if (this.check('EQUAL')) {
      this.advance()
      const right = this.parseTerm()
      return this.syntaxEmitter.emitBinary(
        'Equality',
        left,
        right,
        this.mergeLoc(left.loc, right.loc)
      )
    }

    if (this.check('NOT_EQUAL')) {
      this.advance()
      const right = this.parseTerm()
      return this.syntaxEmitter.emitBinary(
        'Inequality',
        left,
        right,
        this.mergeLoc(left.loc, right.loc)
      )
    }

    return left
  }

  private parseTerm(): SyntaxAsetReductionRef {
    return this.parseChain()
  }

  /** `⟼` имеет меньший приоритет, чем соположение форм. */
  private parseChain(): SyntaxAsetReductionRef {
    let left = this.parseSequence()

    while (this.check('ARROW')) {
      this.advance()
      const right = this.parseSequence()
      left = this.syntaxEmitter.emitBinary(
        'Link',
        left,
        right,
        this.mergeLoc(left.loc, right.loc)
      )
    }

    return left
  }

  /**
   * Каноническое соположение внутри одной строки: a{b,c}, {}b, {}{}, [][], ...
   *
   * В файловом/editor workflow aprover перевод строки остаётся границей формул.
   * Это application-boundary: перевод строки не становится отдельным оператором.
   */
  private parseSequence(): SyntaxAsetReductionRef {
    const first = this.parsePref()
    const items: SyntaxAsetReductionRef[] = [first]

    while (
      FORM_STARTS.has(this.current().type) &&
      this.current().loc.start.line === items[items.length - 1].loc.end.line
    ) {
      items.push(this.parsePref())
    }

    if (items.length === 1) return first
    const last = items[items.length - 1]
    return this.syntaxEmitter.emitSequence(items, this.mergeLoc(first.loc, last.loc))
  }

  /** Канонические префиксные операторы: инверсия `¬` и проекция начала `♀`. */
  private parsePref(): SyntaxAsetReductionRef {
    const prefixes: { type: 'NOT' | 'FEMALE'; loc: SourceLocation }[] = []

    while (this.checkAny('NOT', 'FEMALE')) {
      const token = this.current()
      prefixes.push({ type: token.type as 'NOT' | 'FEMALE', loc: token.loc })
      this.advance()
    }

    let result = this.parsePost()

    for (let i = prefixes.length - 1; i >= 0; i--) {
      const prefix = prefixes[i]
      result = this.syntaxEmitter.emitUnary(
        prefix.type === 'NOT' ? 'Not' : 'Female',
        result,
        this.mergeLoc(prefix.loc, result.loc)
      )
    }

    return result
  }

  /** Канонический постфиксный оператор: проекция конца `F♂`. */
  private parsePost(): SyntaxAsetReductionRef {
    let result = this.parseAtom()

    while (this.check('MALE')) {
      const loc = this.advance().loc
      result = this.syntaxEmitter.emitUnary('Male', result, this.mergeLoc(result.loc, loc))
    }

    return result
  }

  private parseAtom(): SyntaxAsetReductionRef {
    const token = this.current()

    if (this.check('INFINITY')) {
      this.advance()
      return this.syntaxEmitter.emitLiteral('Infinity', '∞', token.loc)
    }
    if (this.check('ZERO')) {
      this.advance()
      return this.syntaxEmitter.emitLiteral('Num', '0', token.loc)
    }
    if (this.check('ONE')) {
      this.advance()
      return this.syntaxEmitter.emitLiteral('Num', '1', token.loc)
    }
    if (this.checkAny('CONTEXT_START', 'CONTEXT_END', 'CONTEXT_UP')) {
      return this.parseContextPronoun()
    }
    if (this.check('ID') || this.check('NAT')) {
      this.advance()
      return this.syntaxEmitter.emitLiteral('Identifier', token.value, token.loc)
    }
    if (this.check('ABIT_LIT')) {
      this.advance()
      return this.syntaxEmitter.emitLiteral('AbitLit', token.value, token.loc)
    }
    if (this.check('STRING_LIT')) {
      this.advance()
      return this.syntaxEmitter.emitLiteral('StringLit', token.value, token.loc)
    }
    if (this.check('LBRACE')) return this.parseSet()
    if (this.check('LPAREN')) return this.parseRound()
    if (this.check('LBRACKET')) return this.parseSquare()

    throw new ParseError(`Unexpected token: ${token.type}`, token)
  }

  private parseContextPronoun(): SyntaxAsetReductionRef {
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

    return this.syntaxEmitter.emitContextPronoun(
      pole.type === 'CONTEXT_START' ? 'start' : 'end',
      up,
      this.mergeLoc(first.loc, pole.loc)
    )
  }

  private parseRound(): SyntaxAsetReductionRef {
    const opening = this.expect('LPAREN')
    if (this.check('RPAREN')) {
      const closing = this.advance()
      return this.syntaxEmitter.emitContainer(
        'Round',
        null,
        this.mergeLoc(opening.loc, closing.loc)
      )
    }

    if (ROUND_LITERALS.has(this.current().type) && this.peek().type === 'RPAREN') {
      const literalToken = this.advance()
      const closing = this.expect('RPAREN')
      const literal = this.syntaxEmitter.emitLiteral(
        'Literal',
        literalToken.value,
        literalToken.loc
      )
      return this.syntaxEmitter.emitContainer(
        'Round',
        literal,
        this.mergeLoc(opening.loc, closing.loc)
      )
    }

    const content = this.parseExpression()
    const closing = this.expect('RPAREN')
    return this.syntaxEmitter.emitContainer(
      'Round',
      content,
      this.mergeLoc(opening.loc, closing.loc)
    )
  }

  private parseSquare(): SyntaxAsetReductionRef {
    const opening = this.expect('LBRACKET')
    if (this.check('RBRACKET')) {
      const closing = this.advance()
      return this.syntaxEmitter.emitContainer(
        'Square',
        null,
        this.mergeLoc(opening.loc, closing.loc)
      )
    }

    const content = this.parseExpression()
    const closing = this.expect('RBRACKET')
    return this.syntaxEmitter.emitContainer(
      'Square',
      content,
      this.mergeLoc(opening.loc, closing.loc)
    )
  }

  private parseSet(): SyntaxAsetReductionRef {
    const lbrace = this.expect('LBRACE')
    const elements: SyntaxAsetReductionRef[] = []

    if (!this.check('RBRACE')) {
      elements.push(this.parseExpression())
      while (this.check('COMMA')) {
        this.advance()
        elements.push(this.parseExpression())
      }
    }

    const rbrace = this.expect('RBRACE')
    return this.syntaxEmitter.emitSet(elements, this.mergeLoc(lbrace.loc, rbrace.loc))
  }
}

/** Canonical structured source path: grammar reductions materialize SyntaxAset online. */
export function parseSyntaxAset(input: string): SyntaxAsetParseResult {
  const lexer = new Lexer(input)
  const emitter = new SyntaxAsetDirectEmitter()
  return new Parser(lexer.tokenize(), emitter).parseFile()
}
