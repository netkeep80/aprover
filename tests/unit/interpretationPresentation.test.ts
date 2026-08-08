import { describe, expect, it } from 'vitest'

import { formatOccurrencePath, presentInterpretation } from '../../src/core/interpretationPresentation'

describe('interpretation presentation', () => {
  it('formats structural occurrence paths without inventing semantic labels', () => {
    expect(formatOccurrencePath([])).toBe('root')
    expect(formatOccurrencePath([0, 1, 0])).toBe('0.1.0')
  })

  it('maps canonical interpretation data without changing it', () => {
    const result = {
      success: true,
      substitutions: [
        { path: [0], link: 10 },
        { path: [1, 0], link: 20 },
      ],
      aliases: [{ path: [1], targetPath: [0] }],
      trace: ['equality', 'context:◁->10', 'bind:1->20'],
    } as const

    expect(presentInterpretation(result)).toEqual({
      status: 'matched',
      substitutions: [
        { occurrence: '0', link: '10' },
        { occurrence: '1.0', link: '20' },
      ],
      aliases: [{ occurrence: '1', target: '0' }],
      trace: ['equality', 'context:◁->10', 'bind:1->20'],
    })

    expect(result.trace).toEqual(['equality', 'context:◁->10', 'bind:1->20'])
  })

  it('keeps a failed match distinct from an interpreter error', () => {
    expect(
      presentInterpretation({
        success: false,
        substitutions: [],
        aliases: [],
        trace: ['inequality'],
      })
    ).toEqual({
      status: 'not-matched',
      substitutions: [],
      aliases: [],
      trace: ['inequality'],
    })
  })
})
