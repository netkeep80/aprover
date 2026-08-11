import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { interpretConstraints, type ContextFrame } from '../../src/core/interpreter'
import { ExplicitMemoryView } from '../../src/core/memoryView'
import { parseExpr } from '../../src/core/parser'

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

function loadCorpus(): ConformanceCorpus {
  const path = resolve(process.cwd(), 'contracts/anum_docs-v0.5/mts-conformance-v0.2.json')
  return JSON.parse(readFileSync(path, 'utf8')) as ConformanceCorpus
}

function contextFrame(spec: ContextSpec): ContextFrame {
  return {
    start: spec.start,
    end: spec.end,
    parent: spec.parent ? contextFrame(spec.parent) : undefined,
  }
}

describe('current MTS base interpretation dependency', () => {
  const corpus = loadCorpus()

  it('identifies the v0.2 base corpus required transitively by current MTS', () => {
    expect(corpus.schema).toBe('mts-conformance/v0.2')
    expect(corpus.contract).toBe('mts-contract/v0.2')
    expect(corpus.status).toBe('accepted')
    expect(corpus.interpretation.length).toBeGreaterThan(0)
  })

  for (const testCase of corpus.interpretation) {
    it(testCase.id, () => {
      const memory = new ExplicitMemoryView(testCase.memory.links)
      const before = memory.entries()

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
      expect(memory.entries()).toEqual(before)
    })
  }
})
