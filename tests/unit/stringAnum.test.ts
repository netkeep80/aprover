import { describe, expect, it } from 'vitest'

import { parseSyntaxAset } from '../../src/core/parser'
import {
  getStringAnumStats,
  stringAnumFileToMtl,
  stringAnumToFormal,
  visualizeConversion,
} from '../../src/core/stringAnum'

describe('string application adapter', () => {
  it('maps the empty value to akorern', () => {
    expect(stringAnumToFormal('')).toBe('∞')
  })

  it('emits only the canonical link glyph and canonical parseable source', () => {
    expect(stringAnumToFormal('ab')).toBe('(∞ ⟼ "ab")')
    expect(stringAnumToFormal('ab')).not.toContain('->')
    expect(() => parseSyntaxAset(`${stringAnumToFormal('ab')}.`)).not.toThrow()
  })

  it('escapes string content without changing MTS syntax', () => {
    expect(stringAnumToFormal('a"b')).toBe('(∞ ⟼ "a\\"b")')
    expect(stringAnumToFormal('a\\b')).toBe('(∞ ⟼ "a\\\\b")')
  })

  it('projects UTF-8 application values into canonical parseable source', () => {
    for (const value of ['hello', 'мир', '🎉🌍', 'Hello, 世界!', 'αβγδ', 'a b c', '']) {
      expect(() => parseSyntaxAset(`${stringAnumToFormal(value)}.`), value).not.toThrow()
    }
  })

  it('projects .astr files into canonical parseable MTS source', () => {
    const source = stringAnumFileToMtl('hello\nworld')
    expect(source).toContain('(∞ ⟼ "hello").')
    expect(source).toContain('(∞ ⟼ "world").')
    expect(source).not.toContain('->')
    expect(() => parseSyntaxAset(source)).not.toThrow()
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
