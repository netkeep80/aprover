/**
 * Unit tests for string anumbers parser (МТС)
 */

import { describe, it, expect } from 'vitest'
import {
  parseStringAnumLine,
  parseStringAnum,
  parseStringAnumExpr,
  toStringAnum,
  isStringAnumExpr,
  stringAnumToFormal,
  stringAnumFileToMtl,
  visualizeConversion,
  getStringAnumStats,
} from '../../src/core/stringAnum'
import type { LinkExpr, InfinityExpr, CharLitExpr } from '../../src/core/ast'

describe('StringAnum Parser', () => {
  describe('parseStringAnumLine', () => {
    it('should parse empty string to infinity', () => {
      const ast = parseStringAnumLine('')
      expect(ast.type).toBe('Infinity')
    })

    it('should parse single character', () => {
      const ast = parseStringAnumLine('a')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect(link.left.type).toBe('Infinity')
      expect(link.right.type).toBe('CharLit')
      expect((link.right as CharLitExpr).char).toBe('a')
    })

    it('should parse two characters as left-associative chain', () => {
      const ast = parseStringAnumLine('ab')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      // Right should be 'b'
      expect(link.right.type).toBe('CharLit')
      expect((link.right as CharLitExpr).char).toBe('b')
      // Left should be (∞ -> 'a')
      expect(link.left.type).toBe('Link')
      const innerLink = link.left as LinkExpr
      expect(innerLink.left.type).toBe('Infinity')
      expect(innerLink.right.type).toBe('CharLit')
      expect((innerLink.right as CharLitExpr).char).toBe('a')
    })

    it('should parse multi-character string correctly', () => {
      const ast = parseStringAnumLine('abc')
      // Should be ((∞ -> 'a') -> 'b') -> 'c'
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect((link.right as CharLitExpr).char).toBe('c')
    })

    it('should handle UTF-8 characters', () => {
      const ast = parseStringAnumLine('связь')
      expect(ast.type).toBe('Link')
      // Should be (((((∞ -> 'с') -> 'в') -> 'я') -> 'з') -> 'ь')
      const link = ast as LinkExpr
      expect((link.right as CharLitExpr).char).toBe('ь')
    })

    it('should handle emoji characters', () => {
      const ast = parseStringAnumLine('👋')
      expect(ast.type).toBe('Link')
      const link = ast as LinkExpr
      expect((link.right as CharLitExpr).char).toBe('👋')
    })

    it('should preserve source locations', () => {
      const ast = parseStringAnumLine('ab', 5, 100)
      expect(ast.loc).toBeDefined()
      expect(ast.loc?.start.line).toBe(5)
      expect(ast.loc?.start.offset).toBe(100)
    })
  })

  describe('parseStringAnum', () => {
    it('should parse empty content', () => {
      const file = parseStringAnum('')
      expect(file.type).toBe('File')
      expect(file.statements.length).toBe(0)
    })

    it('should parse single line', () => {
      const file = parseStringAnum('hello')
      expect(file.statements.length).toBe(1)
      expect(file.statements[0].type).toBe('Statement')
    })

    it('should parse multiple lines as separate statements', () => {
      const file = parseStringAnum('hello\nworld')
      expect(file.statements.length).toBe(2)
    })

    it('should skip empty lines by default', () => {
      const file = parseStringAnum('hello\n\nworld')
      expect(file.statements.length).toBe(2)
    })

    it('should skip comment lines by default', () => {
      const file = parseStringAnum('// comment\nhello')
      expect(file.statements.length).toBe(1)
    })

    it('should respect skipEmptyLines option', () => {
      const file = parseStringAnum('hello\n\nworld', { skipEmptyLines: false })
      expect(file.statements.length).toBe(3)
    })

    it('should respect skipComments option', () => {
      const file = parseStringAnum('// comment\nhello', { skipComments: false })
      expect(file.statements.length).toBe(2)
    })
  })

  describe('parseStringAnumExpr', () => {
    it('should parse entire content as single expression', () => {
      const ast = parseStringAnumExpr('hello world')
      expect(ast.type).toBe('Link')
    })
  })

  describe('toStringAnum', () => {
    it('should convert infinity to empty string', () => {
      const ast: InfinityExpr = { type: 'Infinity' }
      expect(toStringAnum(ast)).toBe('')
    })

    it('should convert simple chain to string', () => {
      const ast = parseStringAnumLine('ab')
      expect(toStringAnum(ast)).toBe('ab')
    })

    it('should return null for non-string-anum AST', () => {
      const ast = { type: 'Num', value: 0 }
      expect(toStringAnum(ast)).toBeNull()
    })

    it('should handle UTF-8 round-trip', () => {
      const original = 'привет мир 🌍'
      const ast = parseStringAnumLine(original)
      expect(toStringAnum(ast)).toBe(original)
    })
  })

  describe('isStringAnumExpr', () => {
    it('should return true for valid string anumber', () => {
      const ast = parseStringAnumLine('hello')
      expect(isStringAnumExpr(ast)).toBe(true)
    })

    it('should return true for empty string (infinity)', () => {
      const ast = parseStringAnumLine('')
      expect(isStringAnumExpr(ast)).toBe(true)
    })

    it('should return false for non-string-anum AST', () => {
      const ast = {
        type: 'Equality',
        left: { type: 'Num', value: 1 },
        right: { type: 'Num', value: 1 },
      }
      expect(isStringAnumExpr(ast)).toBe(false)
    })
  })

  describe('stringAnumToFormal', () => {
    it('should convert empty string to ∞', () => {
      expect(stringAnumToFormal('')).toBe('∞')
    })

    it('should convert single character', () => {
      expect(stringAnumToFormal('a')).toBe("(∞ -> 'a')")
    })

    it('should convert two characters', () => {
      expect(stringAnumToFormal('ab')).toBe("((∞ -> 'a') -> 'b')")
    })

    it('should convert three characters', () => {
      expect(stringAnumToFormal('abc')).toBe("(((∞ -> 'a') -> 'b') -> 'c')")
    })

    it('should handle UTF-8 characters', () => {
      expect(stringAnumToFormal('йо')).toBe("((∞ -> 'й') -> 'о')")
    })
  })

  describe('stringAnumFileToMtl', () => {
    it('should convert simple file', () => {
      const result = stringAnumFileToMtl('hello')
      expect(result).toContain("(((((∞ -> 'h') -> 'e') -> 'l') -> 'l') -> 'o').")
    })

    it('should preserve comments', () => {
      const result = stringAnumFileToMtl('// my comment\nhello')
      expect(result).toContain('// my comment')
    })

    it('should add header comment', () => {
      const result = stringAnumFileToMtl('hello')
      expect(result).toContain('// Generated from .astr file')
    })

    it('should handle multiple lines', () => {
      const result = stringAnumFileToMtl('ab\ncd')
      expect(result).toContain("((∞ -> 'a') -> 'b').")
      expect(result).toContain("((∞ -> 'c') -> 'd').")
    })
  })

  describe('visualizeConversion', () => {
    it('should show infinity for empty string', () => {
      const steps = visualizeConversion('')
      expect(steps.length).toBe(1)
      expect(steps[0].formal).toBe('∞')
    })

    it('should show all steps for conversion', () => {
      const steps = visualizeConversion('ab')
      expect(steps.length).toBe(3) // initial (∞) + 2 characters
      expect(steps[0].formal).toBe('∞')
      expect(steps[1].char).toBe('a')
      expect(steps[1].formal).toBe("(∞ -> 'a')")
      expect(steps[2].char).toBe('b')
      expect(steps[2].formal).toBe("((∞ -> 'a') -> 'b')")
    })

    it('should include step descriptions', () => {
      const steps = visualizeConversion('a')
      expect(steps[0].description).toContain('akorern')
      expect(steps[1].description).toContain('Link')
    })
  })

  describe('getStringAnumStats', () => {
    it('should count characters correctly', () => {
      const stats = getStringAnumStats('hello')
      expect(stats.charCount).toBe(5)
    })

    it('should count unique characters', () => {
      const stats = getStringAnumStats('hello')
      expect(stats.uniqueChars).toBe(4) // h, e, l, o
    })

    it('should calculate link count', () => {
      const stats = getStringAnumStats('hello')
      expect(stats.linkCount).toBe(5)
    })

    it('should handle UTF-8 correctly', () => {
      const stats = getStringAnumStats('привет')
      expect(stats.charCount).toBe(6)
      expect(stats.byteLength).toBe(12) // Cyrillic chars are 2 bytes each
    })

    it('should calculate character frequency', () => {
      const stats = getStringAnumStats('abba')
      expect(stats.charFrequency.get('a')).toBe(2)
      expect(stats.charFrequency.get('b')).toBe(2)
    })
  })
})

describe('String Anumber Integration', () => {
  it('should correctly model МТС documentation example', () => {
    // From docs: "связь" ≡ (((((∞ -> 'с') -> 'в') -> 'я') -> 'з') -> 'ь')
    const formal = stringAnumToFormal('связь')
    expect(formal).toBe("(((((∞ -> 'с') -> 'в') -> 'я') -> 'з') -> 'ь')")
  })

  it('should round-trip arbitrary UTF-8 strings', () => {
    const testStrings = ['hello', 'мир', '🎉🌍', 'Hello, 世界!', 'αβγδ', 'a b c', '']

    for (const str of testStrings) {
      const ast = parseStringAnumExpr(str)
      const recovered = toStringAnum(ast)
      expect(recovered).toBe(str)
    }
  })

  it('should handle special characters correctly', () => {
    const special = "a'b"
    const formal = stringAnumToFormal(special)
    // The quote should be escaped
    expect(formal).toContain("'\\''")
  })
})
