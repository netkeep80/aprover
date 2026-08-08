import { describe, expect, it } from 'vitest'

import { presentVersionedProofArtifactJson } from '../../src/core/proofArtifactPresentationVersioned'

function openingArtifact(body = 'b') {
  return JSON.stringify({
    proofVersion: 'mts-proof/v0.3',
    contractVersion: 'mts-contract/v0.3',
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

function v02Artifact() {
  return JSON.stringify({
    schema: 'mts-proof/v0.2',
    contractVersion: 'mts-contract/v0.2',
    steps: [],
  })
}

describe('versioned proof artifact presentation', () => {
  it('keeps existing v0.2 presentation available through version dispatch', () => {
    const view = presentVersionedProofArtifactJson(v02Artifact())
    expect(view.status).toBe('accepted')
    if (view.status !== 'accepted') throw new Error('expected accepted v0.2 proof')
    expect(view.version).toBe('v0.2')
    expect(view.schema).toBe('mts-proof/v0.2')
    expect(view.steps).toEqual([])
    expect(view.judgments).toEqual([])
  })

  it('presents an independently accepted v0.3 base judgment', () => {
    const view = presentVersionedProofArtifactJson(openingArtifact())
    expect(view.status).toBe('accepted')
    if (view.status !== 'accepted') throw new Error('expected accepted v0.3 proof')

    expect(view.version).toBe('v0.3')
    expect(view.schema).toBe('mts-proof/v0.3')
    expect(view.contractVersion).toBe('mts-contract/v0.3')
    expect(view.steps).toEqual([])
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

  it('distinguishes a forged but structurally valid v0.3 claim from invalid JSON', () => {
    const forged = presentVersionedProofArtifactJson(openingArtifact('c'))
    expect(forged.status).toBe('rejected')
    if (forged.status !== 'rejected') throw new Error('expected replay rejection')
    expect(forged.judgments[0].accepted).toBe(false)

    const invalid = presentVersionedProofArtifactJson(
      JSON.stringify({
        proofVersion: 'mts-proof/v0.3',
        contractVersion: 'mts-contract/v0.3',
        judgments: [{ relation: 'Opens', target: 'a' }],
      })
    )
    expect(invalid.status).toBe('invalid')
    if (invalid.status !== 'invalid') throw new Error('expected validation error')
    expect(invalid.errorPath).toContain('judgments[0]')
  })

  it('rejects unknown proof versions before replay', () => {
    const view = presentVersionedProofArtifactJson(
      JSON.stringify({ proofVersion: 'mts-proof/v9', contractVersion: 'mts-contract/v9', judgments: [] })
    )
    expect(view.status).toBe('invalid')
    if (view.status !== 'invalid') throw new Error('expected invalid version')
    expect(view.error).toContain('mts-proof/v0.2')
    expect(view.error).toContain('mts-proof/v0.3')
  })
})
