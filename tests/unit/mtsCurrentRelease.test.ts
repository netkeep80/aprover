import { describe, expect, it } from 'vitest'
import {
  CURRENT_MTS_CONFORMANCE,
  CURRENT_MTS_CONTRACT,
  CURRENT_MTS_RELEASE,
  CURRENT_MTS_SOURCE_COMMIT,
  CURRENT_MTS_SURFACES,
  validateCurrentMtsReleaseArtifacts,
} from '../../src/core/mtsCurrentRelease'
import { mtsContractSchema, proofSchema } from '../../src/core/mtsContract'


describe('current MTS v0.7 upstream boundary', () => {
  it('accepts the pinned v0.7 contract/conformance/C9 artifacts', () => {
    expect(validateCurrentMtsReleaseArtifacts()).toEqual([])
    expect(CURRENT_MTS_CONTRACT).toBe('mts-contract/v0.7')
    expect(CURRENT_MTS_CONFORMANCE).toBe('mts-conformance/v0.7')
    expect(CURRENT_MTS_SOURCE_COMMIT).toBe(
      'f9075d531ff7ed7e07da012bf350ca1af5ba516a',
    )
  })

  it('exposes only the accepted current leaf versions', () => {
    expect(CURRENT_MTS_SURFACES).toEqual({
      anum: 'anum-deserialization/v0.4',
      directDeixis: 'mts-direct-deixis/v0.6',
      valueBundle: 'mts-value-bundle/v0.3',
    })
    expect(CURRENT_MTS_RELEASE.publicRuntime).toBe('core/foundation_v2.py')
    expect(CURRENT_MTS_RELEASE.downstreamRepinAllowed).toBe(true)
    expect(CURRENT_MTS_RELEASE.historicalRuntimeSelectable).toBe(false)
  })

  it('does not reinterpret the historical v0.6/proof-v0.4 replay API', () => {
    expect(mtsContractSchema).toBe('mts-contract/v0.6')
    expect(proofSchema).toBe('mts-proof/v0.4')
    expect(CURRENT_MTS_RELEASE.previousAcceptedContract).toBe('mts-contract/v0.6')
  })

  it('keeps semantic Link identity independent of runtime/UI coordinates', () => {
    expect(validateCurrentMtsReleaseArtifacts()).not.toContain(
      expect.stringContaining('identity'),
    )
  })
})
