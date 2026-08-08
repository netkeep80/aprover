import { describe, expect, it } from 'vitest'

import { InterpretationSession } from '../../src/core/interpretationSession'
import { parseExpr } from '../../src/core/parser'

describe('InterpretationSession', () => {
  it('feeds canonical interpreter with one immutable application snapshot', () => {
    const session = new InterpretationSession({
      context: { start: 1, end: 2 },
      symbols: { x: 10 },
      links: [{ id: 10, start: 1, end: 2 }],
    })
    const before = session.memorySnapshot()

    const result = session.interpret(parseExpr('[] = x'))

    expect(result.success).toBe(true)
    expect(result.substitutions).toEqual([{ path: [0], link: 10 }])
    expect(result.aliases).toEqual([])
    expect(session.memorySnapshot()).toEqual(before)
  })

  it('keeps context pronouns in the application frame instead of materializing them', () => {
    const session = new InterpretationSession({
      context: { start: 10, end: 20, parent: { start: 30, end: 40 } },
      links: [],
    })

    expect(session.interpret(parseExpr('◁ = ◁')).success).toBe(true)
    expect(session.interpret(parseExpr('↑▷ = ↑▷')).success).toBe(true)
    expect(session.memorySnapshot()).toEqual([])
  })

  it('does not expose caller mutations of the symbols object as session state', () => {
    const symbols = { x: 10 }
    const session = new InterpretationSession({
      context: { start: 1, end: 2 },
      symbols,
      links: [{ id: 10, start: 1, end: 2 }],
    })

    symbols.x = 99

    expect(session.interpret(parseExpr('[] = x')).substitutions).toEqual([
      { path: [0], link: 10 },
    ])
  })
})
