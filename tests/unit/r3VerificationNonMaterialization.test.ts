import { describe, expect, it } from 'vitest'

import { approvePortableStructuralProof } from '../../src/core/proofApproval'

const BASE_REQUEST = {
  artifact: null,
  provenance: null,
  target: {
    theoryCoordinate: 0,
    targetOccurrenceCoordinate: 0,
    claimCoordinate: 0,
  },
  expectedTheory: {
    artifact: null,
    revision: null,
  },
} as const

describe('R3 verification non-materialization boundary', () => {
  it.each(['materialize', 'write', 'persist', 'store'] as const)(
    'rejects injected %s authority before trusted replay',
    async capability => {
      const result = await approvePortableStructuralProof({
        ...BASE_REQUEST,
        [capability]: true,
      })

      expect(result).toEqual({ verdict: 'REJECT', code: 'invalid-request' })
    },
  )

  it('treats the approval request as read-only input', async () => {
    let writes = 0
    const request = new Proxy(BASE_REQUEST, {
      set() {
        writes += 1
        return false
      },
      deleteProperty() {
        writes += 1
        return false
      },
      defineProperty() {
        writes += 1
        return false
      },
    })

    const result = await approvePortableStructuralProof(request)

    expect(result).toEqual({ verdict: 'REJECT', code: 'theory-rejected' })
    expect(writes).toBe(0)
  })
})
