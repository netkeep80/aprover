import { describe, expect, it } from 'vitest'
import { parseSyntaxAset } from '../../src/core/parser'
import type { SourceLocation } from '../../src/core/sourceProvenance'
import {
  countSyntaxStatements,
  selectSyntaxOccurrenceAtOffset,
  selectSyntaxOccurrenceBySourceSpan,
} from '../../src/core/syntaxSourceMap'

function span(loc: SourceLocation): string {
  return `${loc.start.offset}:${loc.end.offset}`
}

describe('SyntaxAset editor source map', () => {
  it('selects repeated equal-looking occurrences independently by source offset', () => {
    const syntax = parseSyntaxAset('a a.')

    const first = selectSyntaxOccurrenceAtOffset(syntax, 0)
    const second = selectSyntaxOccurrenceAtOffset(syntax, 2)

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(first!.occurrence).not.toBe(second!.occurrence)
    expect(span(first!.location)).toBe('0:1')
    expect(span(second!.location)).toBe('2:3')
  })

  it('revalidates an exact legacy source span against SyntaxAset provenance', () => {
    const syntax = parseSyntaxAset('[] = ◁.')
    const selected = selectSyntaxOccurrenceBySourceSpan(syntax, {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 3, offset: 2 },
    })

    expect(selected).not.toBeNull()
    expect(span(selected!.location)).toBe('0:2')
  })

  it('counts parsed statements from SyntaxAset occurrences', () => {
    expect(countSyntaxStatements(parseSyntaxAset('a.\nb.'))).toBe(2)
  })
})
