import { describe, expect, it } from 'vitest'

import type { LinkExpr, StringLitExpr } from '../../src/core/ast'
import {
  getStringAnumStats,
  isStringAnumExpr,
  parseStringAnum,
  parseStringAnumExpr,
  parseStringAnumLine,
  stringAnumFileToMtl,
  stringAnumToFormal,
  toStringAnum,
  visualizeConversion,
} from '../../src/core/stringAnum'
import { parseExpr } from '../../src/core/parser'

describe('string application adapter', () => {
  it('uses the shared structural AST rather than a second parser grammar', () => {
    const ast = parseStringAnumLine('hello') as LinkExpr
    expect(ast.type).toBe('Link')
    expect(ast.left.type).toBe('Infinity')
    expect(ast.right).toMatchObject({ type: 'StringLit', value: 'hello' })
    expect((ast.right as StringLitExpr).value).toBe('hello')
  })

  it('maps the empty value to akorern', () => {
    expect(parseStringAnumLine('').type).toBe('Infinity')
    expect(stringAnumToFormal('')).toBe('∞')
  })

  it('emits only the canonical link glyph', () => {
    expect(stringAnumToFormal('ab')).toBe('(∞ ⟼ "ab")')
    expect(stringAnumToFormal('ab')).not.toContain('->')
    expect(() => parseExpr(stringAnumToFormal('ab'))).not.toThrow()
  })

  it('escapes string content without changing MTS syntax', () => {
    expect(stringAnumToFormal('a"b')).toBe('(∞ ⟼ "a\\"b")')
    expect(stringAnumToFormal('a\\b')).toBe('(∞ ⟼ "a\\\\b")')
  })

  it('round-trips UTF-8 application values through the shared AST', () => {
    for (const value of ['hello', 'мир', '🎉🌍', 'Hello, 世界!', 'αβγδ', 'a b c', '']) {
      expect(toStringAnum(parseStringAnumExpr(value))).toBe(value)
      expect(isStringAnumExpr(parseStringAnumExpr(value))).toBe(true)
    }
  })

  it('parses line-oriented application data without changing source locations', () => {
    const ast = parseStringAnumLine('ab', 5, 100)
    expect(ast.loc?.start).toMatchObject({ line: 5, offset: 100 })

    const file = parseStringAnum('// comment\nhello\n\nworld')
    expect(file.statements).toHaveLength(2)
  })

  it('projects .astr files into canonical parseable MTS source', () => {
    const source = stringAnumFileToMtl('hello\nworld')
    expect(source).toContain('(∞ ⟼ "hello").')
    expect(source).toContain('(∞ ⟼ "world").')
    expect(source).not.toContain('->')
  })

  it('shows canonical source in conversion presentation', () => {
    const steps = visualizeConversion('ab')
    expect(steps.map(step => step.formal)).toEqual(['∞', '(∞ ⟼ "ab")'])
  })

  it('reports UTF-8 statistics without attaching MTS semantics to characters', () => {
    const stats = getStringAnumStats('abba')
    expect(stats.charCount).toBe(4)
    expect(stats.uniqueChars).toBe(2)
    expect(stats.charFrequency.get('a')).toBe(2)
    expect(stats.charFrequency.get('b')).toBe(2)
    expect(getStringAnumStats('привет').byteLength).toBe(12)
  })
})
