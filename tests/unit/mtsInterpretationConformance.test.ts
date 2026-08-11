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

const regressionCases: InterpretationCase[] = [
  {
    id: 'bind-anonymous-occurrences-to-context-roles',
    source: '{[] = ◁, [] = ▷}',
    context: { start: 10, end: 12 },
    symbols: {},
    memory: { links: [] },
    expected: {
      success: true,
      substitutions: [
        { path: [0, 0], link: 10 },
        { path: [1, 0], link: 12 },
      ],
      aliases: [],
      traceKinds: ['bundle', 'equality', 'context', 'bind', 'equality', 'context', 'bind'],
    },
  },
  {
    id: 'aroot-full-self-cycle',
    source: '{◁ = ∞, ▷ = ∞}',
    context: { start: 1, end: 1 },
    symbols: { '∞': 1 },
    memory: { links: [] },
    expected: {
      success: true,
      substitutions: [],
      aliases: [],
      traceKinds: ['bundle', 'equality', 'context', 'equality', 'context'],
    },
  },
  {
    id: 'aroot-rejects-non-self-end',
    source: '{◁ = ∞, ▷ = ∞}',
    context: { start: 1, end: 2 },
    symbols: { '∞': 1 },
    memory: { links: [] },
    expected: {
      success: false,
      substitutions: [],
      aliases: [],
      traceKinds: ['bundle', 'equality', 'context', 'equality', 'context'],
    },
  },
  {
    id: 'decompose-existing-link-into-two-holes',
    source: '10 = [] ⟼ []',
    context: { start: 2, end: 3 },
    symbols: { '10': 10 },
    memory: { links: [{ id: 10, start: 2, end: 3 }] },
    expected: {
      success: true,
      substitutions: [
        { path: [1, 0], link: 2 },
        { path: [1, 1], link: 3 },
      ],
      aliases: [],
      traceKinds: ['equality', 'decompose', 'bind', 'bind'],
    },
  },
  {
    id: 'recursive-link-pattern-decomposition',
    source: '20 = ([] ⟼ []) ⟼ []',
    context: { start: 2, end: 3 },
    symbols: { '20': 20 },
    memory: {
      links: [
        { id: 10, start: 2, end: 3 },
        { id: 20, start: 10, end: 1 },
      ],
    },
    expected: {
      success: true,
      substitutions: [
        { path: [1, 0, 0, 0], link: 2 },
        { path: [1, 0, 0, 1], link: 3 },
        { path: [1, 1], link: 1 },
      ],
      aliases: [],
      traceKinds: ['equality', 'decompose', 'decompose', 'bind', 'bind', 'bind'],
    },
  },
  {
    id: 'two-anonymous-occurrences-alias-locally',
    source: '[] = []',
    context: { start: 1, end: 1 },
    symbols: {},
    memory: { links: [] },
    expected: {
      success: true,
      substitutions: [],
      aliases: [{ path: [1], targetPath: [0] }],
      traceKinds: ['equality', 'alias'],
    },
  },
]

function contextFrame(spec: ContextSpec): ContextFrame {
  return {
    start: spec.start,
    end: spec.end,
    parent: spec.parent ? contextFrame(spec.parent) : undefined,
  }
}

describe('current MTS interpretation regressions', () => {
  for (const testCase of regressionCases) {
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
