import { describe, expect, it } from 'vitest'

import { presentVersionedProofArtifactJson } from '../../src/core/proofArtifactPresentationVersioned'

function openingArtifact(body = 'b') {
  return JSON.stringify({
    proofVersion: 'mts-proof/v0.4',
    contractVersion: 'mts-contract/v0.4',
    judgments: [
      {
        relation: 'Opens',
        scopes: [{ path: [], parent: null, definitions: ['a : b'] }],
        lookupScope: [],
        target: 'a',
        expected: {
          definitionId: { scopePath: [], ordinal: 0 },
          body,
        },
      },
    ],
  })
}

describe('current proof artifact presentation', () => {
  it('presents an independently accepted v0.4 base judgment', () => {
    const view = presentVersionedProofArtifactJson(openingArtifact())
    expect(view.status).toBe('accepted')
    if (view.status !== 'accepted') throw new Error('expected accepted v0.4 proof')

    expect(view.version).toBe('v0.4')
    expect(view.schema).toBe('mts-proof/v0.4')
    expect(view.contractVersion).toBe('mts-contract/v0.4')
    expect(view.judgments).toHaveLength(1)
    expect(view.judgments[0]).toMatchObject({
      index: 1,
      relation: 'Opens',
      accepted: true,
      primary: 'a',
      meta: ['lookup scope: root', 'scopes: 1'],
      details: ['DefinitionId: root / 0', 'RHS: b'],
    })
  })

  it('distinguishes a forged current claim from invalid transport', () => {
    const forged = presentVersionedProofArtifactJson(openingArtifact('c'))
    expect(forged.status).toBe('rejected')
    if (forged.status !== 'rejected') throw new Error('expected replay rejection')
    expect(forged.judgments[0].accepted).toBe(false)

    const invalid = presentVersionedProofArtifactJson(
      JSON.stringify({
        proofVersion: 'mts-proof/v0.4',
        contractVersion: 'mts-contract/v0.4',
        judgments: [{ relation: 'Opens', target: 'a' }],
      })
    )
    expect(invalid.status).toBe('invalid')
    if (invalid.status !== 'invalid') throw new Error('expected validation error')
    expect(invalid.errorPath).toContain('judgments[0]')
  })

  it('rejects legacy v0.2 and v0.3 artifacts instead of dispatching compatibility replay', () => {
    for (const artifact of [
      { schema: 'mts-proof/v0.2', contractVersion: 'mts-contract/v0.2', steps: [] },
      { proofVersion: 'mts-proof/v0.3', contractVersion: 'mts-contract/v0.3', judgments: [] },
    ]) {
      const view = presentVersionedProofArtifactJson(JSON.stringify(artifact))
      expect(view.status).toBe('invalid')
      if (view.status !== 'invalid') throw new Error('expected legacy artifact rejection')
      expect(view.error).toContain('mts-proof/v0.4')
      expect(view.errorPath).toBe('$.proofVersion')
    }
  })

  it('rejects unknown proof versions before replay', () => {
    const view = presentVersionedProofArtifactJson(
      JSON.stringify({ proofVersion: 'mts-proof/v9', contractVersion: 'mts-contract/v9', judgments: [] })
    )
    expect(view.status).toBe('invalid')
    if (view.status !== 'invalid') throw new Error('expected invalid version')
    expect(view.error).toContain('mts-proof/v0.4')
  })
})
