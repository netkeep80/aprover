/**
 * Unit tests for the МТС parser consumed from anum_docs.
 */

import { describe, it, expect } from 'vitest'
import { parse, parseExpr, parseWithRecovery, ParseError } from '../../src/core/parser'

describe('Parser', () => {
  describe('Basic expressions', () => {
    it('should parse infinity', () => {
      expect(parseExpr('∞').type).toBe('Infinity')
    })

    it('should parse numeric constants', () => {
      expect(parseExpr('0').type).toBe('Num')
      expect(parseExpr('1').type).toBe('Num')
    })

    it('should parse identifiers', () => {
      const ast = parseExpr('x')
      expect(ast.type).toBe('Identifier')
      expect((ast as any).name).toBe('x')
    })

    it('should parse legacy serialized abit literals independently from L2 square forms', () => {
      const ast = parseExpr("'01[]'")
      expect(ast.type).toBe('AbitLit')
      expect((ast as any).value).toBe('01[]')
    })

    it('should parse string literals', () => {
      const ast = parseExpr('"связь"')
      expect(ast.type).toBe('StringLit')
      expect((ast as any).value).toBe('связь')
    })

    it('should parse canonical square forms', () => {
      expect(parseExpr('[]').type).toBe('Square')
      expect(parseExpr('[1]').type).toBe('Square')
      expect(parseExpr('[0]').type).toBe('Square')
    })

    it('should not treat a bare square boundary as an L2 form', () => {
      expect(() => parseExpr('[')).toThrow(ParseError)
      expect(() => parseExpr(']')).toThrow(ParseError)
    })

    it('should parse literal square boundary glyphs inside round forms', () => {
      const left = parseExpr('([)')
      const right = parseExpr('(])')
      expect(left.type).toBe('Round')
      expect(right.type).toBe('Round')
      expect((left as any).content.type).toBe('Literal')
      expect((right as any).content.type).toBe('Literal')
    })

    it('should parse atomic context pronouns and ascent', () => {
      expect(parseExpr('◁').type).toBe('ContextPronoun')
      expect(parseExpr('▷').type).toBe('ContextPronoun')
      const parent = parseExpr('↑◁') as any
      expect(parent.type).toBe('ContextPronoun')
      expect(parent.up).toBe(1)
    })
  })

  describe('Link expressions', () => {
    it('should parse the canonical link glyph', () => {
      const ast = parseExpr('a ⟼ b')
      expect(ast.type).toBe('Link')
      expect((ast as any).left.type).toBe('Identifier')
      expect((ast as any).right.type).toBe('Identifier')
    })

    it('should preserve left-associative chains', () => {
      const ast = parseExpr('a ⟼ b ⟼ c')
      expect(ast.type).toBe('Link')
      expect((ast as any).left.type).toBe('Link')
      expect((ast as any).right.type).toBe('Identifier')
    })
  })

  describe('Canonical projections and inversion', () => {
    it('should parse start projection as prefix ♀F', () => {
      const ast = parseExpr('♀x')
      expect(ast.type).toBe('Female')
      expect((ast as any).operand.type).toBe('Identifier')
    })

    it('should parse nested start projections', () => {
      const ast = parseExpr('♀♀x')
      expect(ast.type).toBe('Female')
      expect((ast as any).operand.type).toBe('Female')
    })

    it('should parse end projection as postfix F♂', () => {
      const ast = parseExpr('x♂')
      expect(ast.type).toBe('Male')
      expect((ast as any).operand.type).toBe('Identifier')
    })

    it('should parse nested end projections', () => {
      const ast = parseExpr('x♂♂')
      expect(ast.type).toBe('Male')
      expect((ast as any).operand.type).toBe('Male')
    })

    it('should parse inversion with canonical glyph', () => {
      const ast = parseExpr('¬x')
      expect(ast.type).toBe('Not')
    })
  })

  describe('Definitions and judgments', () => {
    it('should parse definition', () => {
      expect(parseExpr('∞ : {◁ = ∞, ▷ = ∞}').type).toBe('Definition')
    })

    it('should parse equality', () => {
      expect(parseExpr('a = b').type).toBe('Equality')
    })

    it('should parse inequality', () => {
      expect(parseExpr('a != b').type).toBe('Inequality')
    })
  })

  describe('Bundles', () => {
    it('should parse one-element bundle', () => {
      const ast = parseExpr('{ a }')
      expect(ast.type).toBe('Set')
      expect((ast as any).elements.length).toBe(1)
    })

    it('should parse multi-element bundle', () => {
      const ast = parseExpr('{ a, b, c }')
      expect(ast.type).toBe('Set')
      expect((ast as any).elements.length).toBe(3)
    })
  })

  describe('Round forms', () => {
    it('should preserve explicit round form in AST', () => {
      const ast = parseExpr('(a)')
      expect(ast.type).toBe('Round')
      expect((ast as any).content.type).toBe('Identifier')
    })

    it('should preserve grouping structure', () => {
      const ast = parseExpr('a ⟼ (b ⟼ c)')
      expect(ast.type).toBe('Link')
      expect((ast as any).right.type).toBe('Round')
      expect((ast as any).right.content.type).toBe('Link')
    })

    it('should preserve empty round form as a formal atom', () => {
      const ast = parseExpr('()')
      expect(ast.type).toBe('Round')
      expect((ast as any).content).toBeNull()
    })

    it('should distinguish literal (=) from equality operator', () => {
      const literal = parseExpr('(=)')
      const judgment = parseExpr('a = b')
      expect(literal.type).toBe('Round')
      expect((literal as any).content.type).toBe('Literal')
      expect(judgment.type).toBe('Equality')
    })
  })

  describe('Canonical root definitions', () => {
    const root = [
      '∞ : {◁ = ∞, ▷ = ∞}',
      '() : ♀() ⟼ ()♂',
      '([) : (♀∞)',
      '(]) : (∞♂)',
      '(⟼) : (♀∞ ⟼ ∞♂)',
      '(↛) : (∞♂ ⟼ ♀∞)',
      '[1] : (⟼)',
      '[0] : (↛)',
      '(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}',
      '(!=) : ¬(=)',
    ]

    for (const formula of root) {
      it(`should parse ${formula}`, () => {
        expect(parseExpr(formula).type).toBe('Definition')
      })
    }
  })

  describe('File parsing', () => {
    it('should parse multiple statements with commas', () => {
      const file = parse('a = b, c = d')
      expect(file.type).toBe('File')
      expect(file.statements.length).toBe(2)
    })

    it('should parse multiple statements with newlines', () => {
      const file = parse('a = b\nc = d')
      expect(file.statements.length).toBe(2)
    })

    it('should parse empty file', () => {
      expect(parse('').statements.length).toBe(0)
    })
  })

  describe('Error handling and recovery', () => {
    it('should throw on unexpected token', () => {
      expect(() => parseExpr(')')).toThrow(ParseError)
    })

    it('should return partial AST after valid statements', () => {
      const result = parseWithRecovery('a = b\nc = d\ne = f)')
      expect(result.file).not.toBeNull()
      expect(result.file?.statements.length).toBe(3)
      expect(result.error).not.toBeNull()
      expect(result.errorLocation).toBeDefined()
    })

    it('should return null file when error occurs first', () => {
      const result = parseWithRecovery(')\na = b')
      expect(result.file).toBeNull()
      expect(result.error).not.toBeNull()
    })

    it('should report error line after canonical formulas', () => {
      const input = ['∞ = ∞ ⟼ ∞', '♀x = ♀x', 'x♂ = x♂)'].join('\n')
      const result = parseWithRecovery(input)
      expect(result.file?.statements.length).toBe(3)
      expect(result.errorLocation?.start.line).toBe(3)
    })

    it('should return no error for successful parse', () => {
      const result = parseWithRecovery('a = b\nc = d')
      expect(result.file?.statements.length).toBe(2)
      expect(result.error).toBeNull()
      expect(result.errorLocation).toBeUndefined()
    })
  })
})
