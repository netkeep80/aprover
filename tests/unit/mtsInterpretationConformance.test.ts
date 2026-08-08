import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseExpr } from '../../src/core/parser'
import {
  interpretConstraints,
  type ContextFrame,
  type LinkRef,
  type MemoryView,
} from '../../src/core/interpreter'

interface LinkSpec {
  id: number
  start: number
  end: number
}

interface ContextSpec {
  start: number
  end: number
  parent?: ContextSpec
}

interface InterpretationCase {
  id: string
  source: string
  context: ContextSpec
  symbols: Record<string, number>
  memory: { links: LinkSpec[] }
  expected: {
    success: boolean
    substitutions: Array<{ path: number[]; link: number }>
    aliases: Array<{ path: number[]; targetPath: number[] }>
    traceKinds: string[]
  }
}

interface ConformanceCorpus {
  schema: string
  contract: string
  status: string
  interpretation: InterpretationCase[]
}

class CorpusMemory implements MemoryView {
  readonly links: Map<LinkRef, readonly [LinkRef, LinkRef]>

  constructor(links: LinkSpec[]) {
    this.links = new Map(links.map(link => [link.id, [link.start, link.end] as const]))
  }

  poles(link: LinkRef): readonly [LinkRef, LinkRef] {
    const poles = this.links.get(link)
    if (!poles) throw new Error(`Unknown memory link ${link}`)
    return poles
  }

  findLink(start: LinkRef, end: LinkRef): LinkRef | undefined {
    for (const [link, poles] of this.links) {
      if (poles[0] === start && poles[1] === end) return link
    }
    return undefined
  }

  findStartProjection(form: LinkRef): LinkRef | undefined {
    for (const [link, poles] of this.links) {
      if (poles[0] === link && poles[1] === form) return link
    }
    return undefined
  }

  findEndProjection(form: LinkRef): LinkRef | undefined {
    for (const [link, poles] of this.links) {
      if (poles[0] === form && poles[1] === link) return link
    }
    return undefined
  }
}

function loadCorpus(): ConformanceCorpus {
  const path = resolve(process.cwd(), 'contracts/anum_docs-v0.2/mts-conformance-v0.2.json')
  return JSON.parse(readFileSync(path, 'utf8')) as ConformanceCorpus
}

function contextFrame(spec: ContextSpec): ContextFrame {
  return {
    start: spec.start,
    end: spec.end,
    parent: spec.parent ? contextFrame(spec.parent) : undefined,
  }
}

function snapshotMemory(memory: CorpusMemory): Array<[number, readonly [number, number]]> {
  return [...memory.links.entries()].map(([link, poles]) => [link, [...poles] as const])
}

describe('MTS v0.2 upstream interpretation conformance', () => {
  const corpus = loadCorpus()

  it('identifies the exact accepted upstream contract', () => {
    expect(corpus.schema).toBe('mts-conformance/v0.2')
    expect(corpus.contract).toBe('mts-contract/v0.2')
    expect(corpus.status).toBe('accepted')
    expect(corpus.interpretation.length).toBeGreaterThan(0)
  })

  for (const testCase of corpus.interpretation) {
    it(testCase.id, () => {
      const memory = new CorpusMemory(testCase.memory.links)
      const before = snapshotMemory(memory)

      const result = interpretConstraints(
        parseExpr(testCase.source),
        contextFrame(testCase.context),
        memory,
        testCase.symbols
      )

      expect(result.success).toBe(testCase.expected.success)
      expect(result.substitutions).toEqual(testCase.expected.substitutions)
      expect(result.aliases).toEqual(testCase.expected.aliases)
      expect(result.trace.map(event => event.split(':', 1)[0])).toEqual(testCase.expected.traceKinds)
      expect(snapshotMemory(memory)).toEqual(before)
    })
  }
})
