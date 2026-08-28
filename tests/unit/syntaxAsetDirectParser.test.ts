import { describe, expect, it } from 'vitest'
import * as parser from '../../src/core/parser'

describe('direct parser -> SyntaxAset', () => {
  it('exposes a direct SyntaxAset parser entrypoint', () => {
    const direct = (parser as Record<string, unknown>).parseSyntaxAset

    expect(typeof direct).toBe('function')
  })
})
