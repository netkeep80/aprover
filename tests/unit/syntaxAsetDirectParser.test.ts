import { describe, expect, it } from 'vitest'
import type { LinkHandle, ReadMemory } from '@mts/core'
import * as parser from '../../src/core/parser'
import { ParseError } from '../../src/core/parser'
import { buildSyntaxAsetOracle, type SyntaxAsetOracleResult } from '../../src/core/syntaxAsetOracle'

function topology(memory: ReadMemory, root: LinkHandle): string {
  const ids = new Map<LinkHandle, number>([[root, 0]])
  const queue: LinkHandle[] = [root]
  const records: Array<readonly [number, number]> = []
  const id = (link: LinkHandle): number => {
    const existing = ids.get(link)
    if (existing !== undefined) return existing
    const created = ids.size
    ids.set(link, created)
    queue.push(link)
    return created
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const poles = memory.poles(queue[cursor])
    records.push([id(poles.start), id(poles.end)])
  }
  return JSON.stringify(records)
}

function sourceSpans(result: SyntaxAsetOracleResult): readonly string[] {
  return result.read.occurrences.map(({ occurrence }) => {
    const loc = result.provenance.get(occurrence)
    return loc === undefined
      ? '-'
      : `${loc.start.offset}:${loc.end.offset}:${loc.start.line}:${loc.start.column}:${loc.end.line}:${loc.end.column}`
  })
}

function directParser(): (source: string) => SyntaxAsetOracleResult {
  const direct = (parser as Record<string, unknown>).parseSyntaxAset
  expect(typeof direct).toBe('function')
  return direct as (source: string) => SyntaxAsetOracleResult
}

describe('direct parser -> SyntaxAset', () => {
  it('exposes a direct SyntaxAset parser entrypoint', () => {
    directParser()
  })

  it('is differential-equivalent to the A1 oracle across the accepted syntax corpus', () => {
    const sources = [
      'a ⟼ b.',
      'x : ¬(a ⟼ b).',
      '♀a a♂.',
      'a = b.\na != b.',
      '{a,b} a.',
      '[a] (⟼).',
      'a a.',
      '↑◁ ⟼ ↑▷.',
      '"hello" [10].',
    ]

    for (const source of sources) {
      const oracle = buildSyntaxAsetOracle(source)
      const direct = directParser()(source)

      expect(topology(direct.memory, direct.aset), source).toBe(topology(oracle.memory, oracle.aset))
      expect(sourceSpans(direct), source).toEqual(sourceSpans(oracle))
    }
  })

  it('preserves equal-looking occurrences as distinct direct syntax occurrences', () => {
    const result = directParser()('a a.')
    const literals = result.read.occurrences.filter(
      occurrence => occurrence.kind === result.vocabulary.kinds.Literal
    )

    expect(literals).toHaveLength(2)
    expect(literals[0].occurrence).not.toBe(literals[1].occurrence)
    expect(result.provenance.get(literals[0].occurrence)?.start.offset).toBe(0)
    expect(result.provenance.get(literals[1].occurrence)?.start.offset).toBe(2)
  })

  it('fails closed on malformed source like the A1 oracle', () => {
    expect(() => directParser()('a ⟼')).toThrow(ParseError)
  })
})
