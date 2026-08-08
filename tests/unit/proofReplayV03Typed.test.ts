import { describe, expect, it } from 'vitest'

import { checkProofV03, parseProofObjectV03 } from '../../src/core/proofReplayV03'

describe('typed mts-proof/v0.3 replay boundary', () => {
  it('replays a decoded ContextuallySatisfies proof without re-running raw JSON validation', () => {
    const proof = parseProofObjectV03({
      proofVersion: 'mts-proof/v0.3',
      contractVersion: 'mts-contract/v0.3',
      judgments: [
        {
          relation: 'ContextuallySatisfies',
          expression: '[] = []',
          context: { start: 1, end: 1, parent: null },
          symbols: [],
          memory: [],
          expected: {
            substitutions: [],
            aliases: [{ path: [1], targetPath: [0] }],
          },
        },
      ],
    })

    expect(proof.judgments[0].relation).toBe('ContextuallySatisfies')
    expect(checkProofV03(proof)).toBe(true)
  })
})
