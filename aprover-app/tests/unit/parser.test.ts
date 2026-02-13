/**
 * Unit tests for МТС parser
 */

import { describe, it, expect } from 'vitest'
import { parse, parseExpr, ParseError } from '../../src/core/parser'

describe('Parser', () => {
  describe('Basic expressions', () => {
    it('should parse infinity', () => {
      const ast = parseExpr('∞')
      expect(ast.type).toBe('Infinity')
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

    it('should parse character literals', () => {
      const ast = parseExpr("'a'")
      expect(ast.type).toBe('CharLit')
      expect((ast as any).char).toBe('a')
    })

    it('should parse brackets', () => {
      expect(parseExpr('[').type).toBe('Bracket')
      expect(parseExpr(']').type).toBe('Bracket')
    })
  })

  describe('Link expressions', () => {
    it('should parse simple link', () => {
      const ast = parseExpr('a -> b')
      expect(ast.type).toBe('Link')
      expect((ast as any).left.type).toBe('Identifier')
      expect((ast as any).right.type).toBe('Identifier')
    })

    it('should parse left-associative chains', () => {
      const ast = parseExpr('a -> b -> c')
      expect(ast.type).toBe('Link')
      // Should be ((a -> b) -> c)
      expect((ast as any).left.type).toBe('Link')
      expect((ast as any).right.type).toBe('Identifier')
    })

    it('should parse not-link', () => {
      const ast = parseExpr('a !-> b')
      expect(ast.type).toBe('NotLink')
    })
  })

  describe('Prefix operators', () => {
    it('should parse male prefix', () => {
      const ast = parseExpr('♂x')
      expect(ast.type).toBe('Male')
      expect((ast as any).operand.type).toBe('Identifier')
    })

    it('should parse nested male', () => {
      const ast = parseExpr('♂♂x')
      expect(ast.type).toBe('Male')
      expect((ast as any).operand.type).toBe('Male')
    })

    it('should parse not prefix', () => {
      const ast = parseExpr('!x')
      expect(ast.type).toBe('Not')
    })

    it('should parse combined prefixes', () => {
      const ast = parseExpr('!♂x')
      expect(ast.type).toBe('Not')
      expect((ast as any).operand.type).toBe('Male')
    })
  })

  describe('Postfix operators', () => {
    it('should parse female postfix', () => {
      const ast = parseExpr('x♀')
      expect(ast.type).toBe('Female')
      expect((ast as any).operand.type).toBe('Identifier')
    })

    it('should parse nested female', () => {
      const ast = parseExpr('x♀♀')
      expect(ast.type).toBe('Female')
      expect((ast as any).operand.type).toBe('Female')
    })

    it('should parse power', () => {
      const ast = parseExpr('a^2')
      expect(ast.type).toBe('Power')
      expect((ast as any).exponent).toBe(2)
    })
  })

  describe('Definitions and equalities', () => {
    it('should parse definition', () => {
      const ast = parseExpr('∞ : ∞ -> ∞')
      expect(ast.type).toBe('Definition')
    })

    it('should parse equality', () => {
      const ast = parseExpr('a = b')
      expect(ast.type).toBe('Equality')
    })

    it('should parse inequality', () => {
      const ast = parseExpr('a != b')
      expect(ast.type).toBe('Inequality')
    })
  })

  describe('Sets', () => {
    it('should parse empty-ish set', () => {
      // Note: our grammar requires at least one element
      const ast = parseExpr('{ a }')
      expect(ast.type).toBe('Set')
      expect((ast as any).elements.length).toBe(1)
    })

    it('should parse multi-element set', () => {
      const ast = parseExpr('{ a, b, c }')
      expect(ast.type).toBe('Set')
      expect((ast as any).elements.length).toBe(3)
    })
  })

  describe('Parentheses', () => {
    it('should parse parenthesized expression', () => {
      const ast = parseExpr('(a)')
      expect(ast.type).toBe('Identifier')
    })

    it('should override associativity', () => {
      const ast = parseExpr('a -> (b -> c)')
      expect(ast.type).toBe('Link')
      // Right side should be a link, not identifier
      expect((ast as any).right.type).toBe('Link')
    })
  })

  describe('Complex expressions', () => {
    it('should parse МТС axioms', () => {
      // А4: ∞ : (∞ -> ∞)
      const ast1 = parseExpr('∞ : (∞ -> ∞)')
      expect(ast1.type).toBe('Definition')

      // А5: ♂x : (♂x -> x)
      const ast2 = parseExpr('♂x : (♂x -> x)')
      expect(ast2.type).toBe('Definition')

      // А6: x♀ : (x -> x♀)
      const ast3 = parseExpr('x♀ : (x -> x♀)')
      expect(ast3.type).toBe('Definition')

      // А8: 1 : (♂∞ -> ∞♀)
      const ast4 = parseExpr('1 : (♂∞ -> ∞♀)')
      expect(ast4.type).toBe('Definition')
    })

    it('should parse complex equalities', () => {
      // From mtl_formulas.mtc
      const ast = parseExpr('a -> b -> c = (a -> b) -> c')
      expect(ast.type).toBe('Equality')
    })

    it('should parse complex inequalities', () => {
      const ast = parseExpr('♂∞♀ != ∞')
      expect(ast.type).toBe('Inequality')
    })
  })

  describe('File parsing', () => {
    it('should parse multiple statements', () => {
      const file = parse('a = b. c = d.')
      expect(file.type).toBe('File')
      expect(file.statements.length).toBe(2)
    })

    it('should parse empty file', () => {
      const file = parse('')
      expect(file.statements.length).toBe(0)
    })
  })

  describe('Error handling', () => {
    it('should throw on missing dot', () => {
      expect(() => parse('a = b')).toThrow(ParseError)
    })

    it('should throw on unexpected token', () => {
      expect(() => parseExpr(')')).toThrow(ParseError)
    })
  })
})
