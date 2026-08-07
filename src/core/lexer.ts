/**
 * Lexer for the canonical МТС formal notation consumed from anum_docs.
 *
 * The lexer stays deliberately context-free: square brackets are always
 * emitted as square-bracket tokens and never acquire special meaning from a
 * neighbouring pronoun. This is required by mts-contract/v0.2.
 */

import type { SourceLocation } from './ast'

export type TokenType =
  | 'ARROW'
  | 'NOT_ARROW'
  | 'DEFINE'
  | 'EQUAL'
  | 'NOT_EQUAL'
  | 'MALE'
  | 'FEMALE'
  | 'NOT'
  | 'POWER'
  | 'INFINITY'
  | 'CONTEXT_START'
  | 'CONTEXT_END'
  | 'CONTEXT_UP'
  | 'ZERO'
  | 'ONE'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'DOT'
  | 'ABIT_LIT'
  | 'STRING_LIT'
  | 'ID'
  | 'NAT'
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  loc: SourceLocation
}

export type MtsConformanceToken =
  | 'context-start'
  | 'context-end'
  | 'context-up'
  | 'lbracket'
  | 'rbracket'

export function toMtsConformanceToken(token: Token): MtsConformanceToken | null {
  switch (token.type) {
    case 'CONTEXT_START':
      return 'context-start'
    case 'CONTEXT_END':
      return 'context-end'
    case 'CONTEXT_UP':
      return 'context-up'
    case 'LBRACKET':
      return 'lbracket'
    case 'RBRACKET':
      return 'rbracket'
    default:
      return null
  }
}

export class LexerError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public offset: number
  ) {
    super(`Lexer error at ${line}:${column}: ${message}`)
    this.name = 'LexerError'
  }
}

export class Lexer {
  private input: string
  private pos: number = 0
  private line: number = 1
  private column: number = 1

  constructor(input: string) {
    this.input = input
  }

  private current(): string {
    return this.input[this.pos] || ''
  }

  private peek(n: number = 1): string {
    return this.input[this.pos + n] || ''
  }

  private advance(n: number = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.current() === '\n') {
        this.line++
        this.column = 1
      } else {
        this.column++
      }
      this.pos++
    }
  }

  private isEOF(): boolean {
    return this.pos >= this.input.length
  }

  private skipWhitespaceAndComments(): void {
    while (!this.isEOF()) {
      if (/\s/.test(this.current())) {
        this.advance()
        continue
      }
      if (this.current() === '/' && this.peek() === '/') {
        while (!this.isEOF() && this.current() !== '\n') this.advance()
        continue
      }
      break
    }
  }

  private makeLoc(startLine: number, startColumn: number, startOffset: number): SourceLocation {
    return {
      start: { line: startLine, column: startColumn, offset: startOffset },
      end: { line: this.line, column: this.column, offset: this.pos },
    }
  }

  private isIdStart(c: string): boolean {
    return /[a-zA-Zа-яА-ЯёЁ_]/.test(c)
  }

  private isIdContinue(c: string): boolean {
    return /[a-zA-Zа-яА-ЯёЁ0-9_]/.test(c)
  }

  private isDigit(c: string): boolean {
    return /[0-9]/.test(c)
  }

  private readIdentifier(): string {
    let result = ''
    while (!this.isEOF() && this.isIdContinue(this.current())) {
      result += this.current()
      this.advance()
    }
    return result
  }

  private readNumber(): string {
    let result = ''
    while (!this.isEOF() && this.isDigit(this.current())) {
      result += this.current()
      this.advance()
    }
    return result
  }

  private isAbitChar(c: string): boolean {
    return c === '[' || c === '0' || c === '1' || c === ']'
  }

  private readAbitLit(): string {
    this.advance()
    let result = ''
    while (!this.isEOF() && this.current() !== "'") {
      const c = this.current()
      if (!this.isAbitChar(c)) {
        throw new LexerError(
          `Invalid abit character: '${c}'. Only [, 0, 1, ] are allowed in abit literals`,
          this.line,
          this.column,
          this.pos
        )
      }
      result += c
      this.advance()
    }
    if (this.isEOF()) throw new LexerError('Unterminated abit literal', this.line, this.column, this.pos)
    if (result.length === 0) throw new LexerError('Empty abit literal', this.line, this.column, this.pos)
    this.advance()
    return result
  }

  private readStringLit(): string {
    this.advance()
    let result = ''
    while (!this.isEOF() && this.current() !== '"') {
      if (this.current() === '\\') {
        this.advance()
        if (this.isEOF()) throw new LexerError('Unterminated string literal', this.line, this.column, this.pos)
        const escaped = this.current()
        switch (escaped) {
          case 'n': result += '\n'; break
          case 't': result += '\t'; break
          case 'r': result += '\r'; break
          case '\\': result += '\\'; break
          case '"': result += '"'; break
          default: result += escaped
        }
      } else {
        result += this.current()
      }
      this.advance()
    }
    if (this.isEOF()) throw new LexerError('Unterminated string literal', this.line, this.column, this.pos)
    this.advance()
    return result
  }

  nextToken(): Token {
    this.skipWhitespaceAndComments()
    if (this.isEOF()) {
      return { type: 'EOF', value: '', loc: this.makeLoc(this.line, this.column, this.pos) }
    }

    const startLine = this.line
    const startColumn = this.column
    const startOffset = this.pos
    const c = this.current()

    if (c === '!' && this.peek() === '-' && this.peek(2) === '>') {
      this.advance(3)
      return { type: 'NOT_ARROW', value: '!->', loc: this.makeLoc(startLine, startColumn, startOffset) }
    }
    if (c === '!' && this.peek() === '=') {
      this.advance(2)
      return { type: 'NOT_EQUAL', value: '!=', loc: this.makeLoc(startLine, startColumn, startOffset) }
    }
    if (c === '-' && this.peek() === '>') {
      this.advance(2)
      return { type: 'ARROW', value: '->', loc: this.makeLoc(startLine, startColumn, startOffset) }
    }
    if (c === '¬' && this.peek() === '=') {
      this.advance(2)
      return { type: 'NOT_EQUAL', value: '¬=', loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    const single: Partial<Record<string, TokenType>> = {
      '⟼': 'ARROW', '↛': 'NOT_ARROW', '◁': 'CONTEXT_START', '▷': 'CONTEXT_END', '↑': 'CONTEXT_UP',
      ':': 'DEFINE', '=': 'EQUAL', '≠': 'NOT_EQUAL', '♂': 'MALE', '♀': 'FEMALE', '!': 'NOT', '¬': 'NOT',
      '^': 'POWER', '∞': 'INFINITY', '(': 'LPAREN', ')': 'RPAREN', '{': 'LBRACE', '}': 'RBRACE',
      '[': 'LBRACKET', ']': 'RBRACKET', ',': 'COMMA', '.': 'DOT'
    }
    const tokenType = single[c]
    if (tokenType) {
      this.advance()
      return { type: tokenType, value: c, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    if (c === "'") {
      const value = this.readAbitLit()
      return { type: 'ABIT_LIT', value, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }
    if (c === '"') {
      const value = this.readStringLit()
      return { type: 'STRING_LIT', value, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    if (this.isDigit(c)) {
      const num = this.readNumber()
      if (num === '0') return { type: 'ZERO', value: '0', loc: this.makeLoc(startLine, startColumn, startOffset) }
      if (num === '1') return { type: 'ONE', value: '1', loc: this.makeLoc(startLine, startColumn, startOffset) }
      return { type: 'NAT', value: num, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    if (this.isIdStart(c)) {
      const id = this.readIdentifier()
      return { type: 'ID', value: id, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    throw new LexerError(`Unexpected character: ${c}`, this.line, this.column, this.pos)
  }

  tokenize(): Token[] {
    const tokens: Token[] = []
    while (true) {
      const token = this.nextToken()
      tokens.push(token)
      if (token.type === 'EOF') break
    }
    return tokens
  }
}

export function tokenize(input: string): Token[] {
  return new Lexer(input).tokenize()
}
