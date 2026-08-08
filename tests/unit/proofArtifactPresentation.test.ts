import { describe, expect, it } from 'vitest'

import { presentProofArtifactJson } from '../../src/core/proofArtifactPresentation'
import { MTS_CONTRACT_VERSION, MTS_PROOF_SCHEMA } from '../../src/core/proofReplay'

function artifact(link = 10) {
  return JSON.stringify({
    schema: MTS_PROOF_SCHEMA,
    contractVersion: MTS_CONTRACT_VERSION,
    steps: [
      {
        rule: 'interpret',
        expression: '[] = ◁',
        context: { start: 10, end: 12, parent: { start: 20, end: 22 } },
        symbols: { x: 30 },
        distinguishedMemory: [{ id: 30, start: 2, end: 3 }],
        expected: {
          success: true,
          substitutions: [{ path: [0], link }],
          aliases: [],
        },
      },
    ],
  })
}

describe('proof artifact presentation', () => {
  it('keeps an empty source distinct from invalid proof data', () => {
    expect(presentProofArtifactJson('')).toEqual({ status: 'empty' })
  })

  it('presents a validated and independently accepted proof', () => {
    const view = presentProofArtifactJson(artifact())
    expect(view.status).toBe('accepted')
    if (view.status !== 'accepted') throw new Error('expected accepted proof')

    expect(view.schema).toBe(MTS_PROOF_SCHEMA)
    expect(view.contractVersion).toBe(MTS_CONTRACT_VERSION)
    expect(view.steps).toHaveLength(1)
    expect(view.steps[0]).toMatchObject({
      index: 1,
      rule: 'interpret',
      expression: '[] = ◁',
      accepted: true,
      context: [
        { depth: 0, start: 10, end: 12 },
        { depth: 1, start: 20, end: 22 },
      ],
      substitutions: [{ occurrence: '0', link: 10 }],
      aliases: [],
      symbolCount: 1,
      distinguishedLinkCount: 1,
    })
  })

  it('distinguishes a structurally valid forged proof from validation failure', () => {
    const view = presentProofArtifactJson(artifact(12))
    expect(view.status).toBe('rejected')
    if (view.status !== 'rejected') throw new Error('expected replay rejection')
    expect(view.accepted).toBe(false)
    expect(view.steps[0].accepted).toBe(false)
  })

  it('presents validator errors without treating them as failed proofs', () => {
    const view = presentProofArtifactJson('{"schema":"wrong","contractVersion":"mts-contract/v0.2","steps":[]}')
    expect(view.status).toBe('invalid')
    if (view.status !== 'invalid') throw new Error('expected validation failure')
    expect(view.errorPath).toBe('$.schema')
    expect(view.error).toContain('mts-proof/v0.2')
  })
})
