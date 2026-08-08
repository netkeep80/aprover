/**
 * Lexer for the canonical МТС v0.2 notation consumed from anum_docs.
 *
 * Compatibility spellings are intentionally rejected: ASCII arrows, bare `!`,
 * `¬=`, `≠` and `^` are not part of the accepted upstream language.
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
  | 'INFINITY'
  | 'ZERO'
  | 'ONE'
  | 'NAT'
  | 'ID'
  | 'ABIT_LIT'
  | 'STRING_LIT'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COMMA'
  | 'DOT'
  | 'CONTEXT_START'
  | 'CONTEXT_END'
  | 'CONTEXT_UP'
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
    public loc: SourceLocation
  ) {
    super(`Lexer error at ${loc.start.line}:${loc.start.column}: ${message}`)
    this.name = 'LexerError'
  }
}

export class Lexer {
  private pos = 0
  private line = 1
  private column = 1

  constructor(private input: string) {}

  private current(): string {
    return this.input[this.pos] || ''
  }

  private peek(n = 1): string {
    return this.input[this.pos + n] || ''
  }

  private advance(): string {
    const char = this.current()
    this.pos++
    if (char === '\n') {
      this.line++
      this.column = 1
    } else {
      this.column++
    }
    return char
  }

  private makeLoc(startLine: number, startColumn: number, startOffset: number): SourceLocation {
    return {
      start: { line: startLine, column: startColumn, offset: startOffset },
      end: { line: this.line, column: this.column, offset: this.pos },
    }
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.input.length) {
      if (/\s/.test(this.current())) {
        this.advance()
        continue
      }
      if (this.current() === '/' && this.peek() === '/') {
        while (this.pos < this.input.length && this.current() !== '\n') this.advance()
        continue
      }
      break
    }
  }

  private readQuoted(quote: "'" | '"', type: 'ABIT_LIT' | 'STRING_LIT'): Token {
    const startLine = this.line
    const startColumn = this.column
    const startOffset = this.pos
    this.advance()
    let value = ''

    while (this.pos < this.input.length && this.current() !== quote) {
      if (this.current() === '\\') {
        this.advance()
        if (this.pos >= this.input.length) break
        const escaped = this.advance()
        if (type === 'STRING_LIT') {
          const escapes: Record<string, string> = {
            n: '\n',
            t: '\t',
            r: '\r',
            '\\': '\\',
            '"': '"',
            "'": "'",
          }
          value += escapes[escaped] ?? escaped
        } else {
          value += escaped
        }
      } else {
        value += this.advance()
      }
    }

    if (this.current() !== quote) {
      throw new LexerError(
        `Unterminated ${type === 'ABIT_LIT' ? 'abit' : 'string'} literal`,
        this.makeLoc(startLine, startColumn, startOffset)
      )
    }
    this.advance()

    if (type === 'ABIT_LIT') {
      if (!value) {
        throw new LexerError(
          'Abit literal cannot be empty',
          this.makeLoc(startLine, startColumn, startOffset)
        )
      }
      if (!/^[\[\]01]+$/.test(value)) {
        throw new LexerError(
          'Abit literal may contain only [, ], 0 and 1',
          this.makeLoc(startLine, startColumn, startOffset)
        )
      }
    }

    return { type, value, loc: this.makeLoc(startLine, startColumn, startOffset) }
  }

  nextToken(): Token {
    this.skipWhitespaceAndComments()

    const startLine = this.line
    const startColumn = this.column
    const startOffset = this.pos

    if (this.pos >= this.input.length) {
      return { type: 'EOF', value: '', loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    if (this.input.startsWith('¬=', this.pos)) {
      this.advance()
      this.advance()
      throw new LexerError(
        'Compatibility spelling ¬= is not accepted; use !=',
        this.makeLoc(startLine, startColumn, startOffset)
      )
    }

    if (this.input.startsWith('!=', this.pos)) {
      this.advance()
      this.advance()
      return {
        type: 'NOT_EQUAL',
        value: '!=',
        loc: this.makeLoc(startLine, startColumn, startOffset),
      }
    }

    const char = this.current()

    if (char === "'") return this.readQuoted("'", 'ABIT_LIT')
    if (char === '"') return this.readQuoted('"', 'STRING_LIT')

    const single: Partial<Record<string, TokenType>> = {
      '⟼': 'ARROW',
      '↛': 'NOT_ARROW',
      ':': 'DEFINE',
      '=': 'EQUAL',
      '♂': 'MALE',
      '♀': 'FEMALE',
      '¬': 'NOT',
      '∞': 'INFINITY',
      '(': 'LPAREN',
      ')': 'RPAREN',
      '{': 'LBRACE',
      '}': 'RBRACE',
      '[': 'LBRACKET',
      ']': 'RBRACKET',
      ',': 'COMMA',
      '.': 'DOT',
      '◁': 'CONTEXT_START',
      '▷': 'CONTEXT_END',
      '↑': 'CONTEXT_UP',
    }
    const type = single[char]
    if (type) {
      this.advance()
      return { type, value: char, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    if (/\d/.test(char)) {
      let value = ''
      while (/\d/.test(this.current())) value += this.advance()
      if (value === '0') {
        return { type: 'ZERO', value, loc: this.makeLoc(startLine, startColumn, startOffset) }
      }
      if (value === '1') {
        return { type: 'ONE', value, loc: this.makeLoc(startLine, startColumn, startOffset) }
      }
      return { type: 'NAT', value, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    if (/[A-Za-zА-Яа-яЁё_]/.test(char)) {
      let value = ''
      while (/[A-Za-zА-Яа-яЁё0-9_]/.test(this.current())) value += this.advance()
      return { type: 'ID', value, loc: this.makeLoc(startLine, startColumn, startOffset) }
    }

    throw new LexerError(
      `Unexpected character: ${char}`,
      this.makeLoc(startLine, startColumn, startOffset)
    )
  }

  tokenize(): Token[] {
    const tokens: Token[] = []
    while (true) {
      const token = this.nextToken()
      tokens.push(token)
      if (token.type === 'EOF') return tokens
    }
  }
}

export function tokenize(input: string): Token[] {
  return new Lexer(input).tokenize()
}
