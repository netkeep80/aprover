/**
 * Lexer for the canonical МТС formal notation consumed from anum_docs.
 *
 * The lexer stays deliberately context-free: square brackets are always
 * emitted as square-bracket tokens and never acquire special meaning from a
 * neighbouring pronoun. This is required by mts-contract/v0.2.
 */

import type { SourceLocation } from './ast'

/** Token types */
export type TokenType =
  | 'ARROW' // ⟼ | ->
  | 'NOT_ARROW' // !->
  | 'DEFINE' // :
  | 'EQUAL' // =
  | 'NOT_EQUAL' // != | ≠ | ¬=
  | 'MALE' // ♂ (legacy name; parser semantics is migrated separately)
  | 'FEMALE' // ♀ (legacy name; parser semantics is migrated separately)
  | 'NOT' // ! | ¬
  | 'POWER' // ^
  | 'INFINITY' // ∞
  | 'CONTEXT_START' // ◁
  | 'CONTEXT_END' // ▷
  | 'CONTEXT_UP' // ↑
  | 'ZERO' // 0
  | 'ONE' // 1
  | 'LPAREN' // (
  | 'RPAREN' // )
  | 'LBRACE' // {
  | 'RBRACE' // }
  | 'LBRACKET' // [
  | 'RBRACKET' // ]
  | 'COMMA' // ,
  | 'DOT' // .
  | 'ABIT_LIT' // '...' (abit sequence: only [, 0, 1, ] characters)
  | 'STRING_LIT' // "..." (string for string anumbers - UTF-8)
  | 'ID' // identifier
  | 'NAT' // natural number
  | 'EOF'

/** Token structure */
export interface Token {
  type: TokenType
  value: string
  loc: SourceLocation
}

/** Names used by the upstream mts-conformance/v0.2 lexing vectors. */
export type MtsConformanceToken =
  | 'context-start'
  | 'context-end'
  | 'context-up'
  | 'lbracket'
  | 'rbracket'

/** Map lexical primitives that are explicitly named by the upstream corpus. */
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

/** Lexer error */
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

/** Lexer class */
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
        while (!this.isEOF() && this.current() !== '\n') {
          this.advance()
        }
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
    if (this.isEOF()) {
      throw new LexerError('Unterminated abit literal', this.line, this.column, this.pos)
    }
    if (result.length === 0) {
      throw new LexerError('Empty abit literal', this.line, this.column, this.pos)
    }
    this.advance()
    return result
  }

  private readStringLit(): string {
    this.advance()
    let result = ''
    while (!this.isEOF() && this.current() !== '"') {
      if (this.current() === '\\') {
        this.advance()
        if (this.isEOF()) {
          throw new LexerError('Unterminated string literal', this.line, this.column, this.pos)
        }
        const escaped = this.current()
        switch (escaped) {
          case 'n':
            result += '\n'
            break
          case 't':
            result += '\t'
            break
          case 'r':
            result += '\r'
            break
          case '\\':
            result += '\\'
            break
          case '"':
            result += '"'
            break
          default:
            result += escaped
        }
      } else {
        result += this.current()
      }
      this.advance()
    }
    if (this.isEOF()) {
      throw new LexerError('Unterminated string literal', this.line, this.column, this.pos)
    }
    this.advance()
    return result
  }

  nextToken(): Token {
    this.skipWhitespaceAndComments()

    if (this.isEOF()) {
      return {
        type: 'EOF',
        value: '',
        loc: this.makeLoc(this.line, this.column, this.pos),
      }
    }

    const startLine = this.line
    const startColumn = this.column
    const startOffset = this.pos
    const c = this.current()

    if (c === '!' && this.peek() === '-' && this.peek(2) === '>') {
      this.advance(3)
      return {
        type: 'NOT_ARROW',
        value: '!->',
        loc: this.makeLoc(startLine, startColumn, startOffset),
      }
    }

    if (c === '!' && this.peek() === '=') {
      this.advance(2)
      return {
        type: 'NOT_EQUAL',
        value: '!=',
        loc: this.makeLoc(startLine, startColumn, startOffset),
      }
    }

    if (c === '-' && this.peek() === '>') {
      this.advance(2)
      return { type: 'ARROW', value: '->', loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    if (c === '¬' && this.peek() === '=') {
      this.advance(2)
      return {
        type: 'NOT_EQUAL',
        value: '¬=',
        loc: this.makeLoc(startLine, startColumn, startOffset),
      }
    }

    switch (c) {
      case '⟼':
        this.advance()
        return { type: 'ARROW', value: '⟼', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '◁':
        this.advance()
        return {
          type: 'CONTEXT_START',
          value: '◁',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '▷':
        this.advance()
        return {
          type: 'CONTEXT_END',
          value: '▷',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '↑':
        this.advance()
        return {
          type: 'CONTEXT_UP',
          value: '↑',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case ':':
        this.advance()
        return {
          type: 'DEFINE',
          value: ':',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '=':
        this.advance()
        return { type: 'EQUAL', value: '=', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '≠':
        this.advance()
        return {
          type: 'NOT_EQUAL',
          value: '≠',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '♂':
        this.advance()
        return { type: 'MALE', value: '♂', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '♀':
        this.advance()
        return {
          type: 'FEMALE',
          value: '♀',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '!':
        this.advance()
        return { type: 'NOT', value: '!', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '¬':
        this.advance()
        return { type: 'NOT', value: '¬', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '^':
        this.advance()
        return { type: 'POWER', value: '^', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '∞':
        this.advance()
        return {
          type: 'INFINITY',
          value: '∞',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '(':
        this.advance()
        return {
          type: 'LPAREN',
          value: '(',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case ')':
        this.advance()
        return {
          type: 'RPAREN',
          value: ')',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '{':
        this.advance()
        return {
          type: 'LBRACE',
          value: '{',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '}':
        this.advance()
        return {
          type: 'RBRACE',
          value: '}',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case '[':
        this.advance()
        return {
          type: 'LBRACKET',
          value: '[',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case ']':
        this.advance()
        return {
          type: 'RBRACKET',
          value: ']',
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      case ',':
        this.advance()
        return { type: 'COMMA', value: ',', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case '.':
        this.advance()
        return { type: 'DOT', value: '.', loc: this.makeLoc(startLine, startColumn, startOffset) }
      case "'": {
        const abit = this.readAbitLit()
        return {
          type: 'ABIT_LIT',
          value: abit,
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      }
      case '"': {
        const str = this.readStringLit()
        return {
          type: 'STRING_LIT',
          value: str,
          loc: this.makeLoc(startLine, startColumn, startOffset),
        }
      }
    }

    if (this.isDigit(c)) {
      const num = this.readNumber()
      if (num === '0') {
        return { type: 'ZERO', value: '0', loc: this.makeLoc(startLine, startColumn, startOffset) }
      }
      if (num === '1') {
        return { type: 'ONE', value: '1', loc: this.makeLoc(startLine, startColumn, startOffset) }
      }
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
