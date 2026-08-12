import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CURRENT_MTS_CONFORMANCE,
  CURRENT_MTS_CONTRACT,
  CURRENT_MTS_DEPENDENCIES,
  CURRENT_MTS_PROOF,
  CURRENT_MTS_SURFACE_KEYS,
  CURRENT_MTS_SURFACE_ROLES,
  validateCurrentMtsRelease,
} from '../../src/core/mtsContract'

const bundleRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.6')
const contractPath = resolve(bundleRoot, 'mts-contract-v0.6.json')
const conformancePath = resolve(bundleRoot, 'mts-conformance-v0.6.json')
const provenancePath = resolve(bundleRoot, 'provenance.json')
const oldBundle = resolve(process.cwd(), 'contracts/anum_docs-v0.5')

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

function gitBlobSha(path: string): string {
  const content = readFileSync(path)
  return createHash('sha1').update(`blob ${content.byteLength}\0`).update(content).digest('hex')
}

interface Provenance {
  sourceRepository: string
  sourceCommit: string
  artifacts: Record<string, { path: string; gitBlobSha: string }>
  vendorPolicy: string
}

const artifactFiles: Record<string, string> = {
  contract: 'mts-contract-v0.6.json',
  conformance: 'mts-conformance-v0.6.json',
}

describe('current pinned MTS/ANUM release snapshot from anum_docs', () => {
  it('validates current-only v0.6 with seven embedded self-contained surfaces', () => {
    const bundle = validateCurrentMtsRelease(readJson(contractPath), readJson(conformancePath))
    expect(bundle.contract.schema).toBe(CURRENT_MTS_CONTRACT)
    expect(bundle.contract.dependsOn).toEqual(CURRENT_MTS_DEPENDENCIES)
    expect(bundle.contract.l5.proofSchema).toBe(CURRENT_MTS_PROOF)
    expect(bundle.conformance.schema).toBe(CURRENT_MTS_CONFORMANCE)
    expect(bundle.conformance.requiredAcceptedSurfaces.map(surface => surface.role)).toEqual(
      CURRENT_MTS_SURFACE_ROLES
    )
    expect(bundle.conformance.requiredAcceptedSurfaces.map(surface => surface.surfaceKey)).toEqual(
      CURRENT_MTS_SURFACE_KEYS
    )
    expect(bundle.conformance.requiredAcceptedSurfaces.map(surface => surface.schema)).toEqual(
      CURRENT_MTS_DEPENDENCIES
    )
  })

  it('keeps semantic reset, proof vetoes, and dual-input ANUM explicit', () => {
    const { contract, conformance } = validateCurrentMtsRelease(
      readJson(contractPath),
      readJson(conformancePath)
    )
    expect(contract.semanticIdentity.linkIdentity).toBe('by ordered semantic poles')
    expect(contract.semanticIdentity.runtimeHandleIsSemanticIdentity).toBe(false)
    expect(contract.semanticIdentity.samePairCreatesSecondSemanticLink).toBe(false)
    expect(contract.semanticIdentity.secondFullySelfClosedRootAllowed).toBe(false)
    expect(contract.anum.schema).toBe('anum-deserialization/v0.4')
    expect(contract.anum.alphabet).toEqual(['[', ']', '1', '0'])
    expect(contract.anum.rootIsFifthAbit).toBe(false)
    expect(contract.anum.existingAsetCarrierSemanticsAccepted).toBe(true)
    expect(contract.anum.rawChannelInputAccepted).toBe(true)
    expect(contract.anum.carrierRoleIsExplicit).toBe(true)
    expect(contract.anum.carrierReadOnly).toBe(true)
    expect(contract.anum.bothTransportsShareStackMachine).toBe(true)
    expect(conformance.releaseAssertions.existingAsetAnumCarrierAccepted).toBe(true)
    expect(conformance.releaseAssertions.anumRawAndCarrierShareStackMachine).toBe(true)
    expect(conformance.releaseAssertions.anumCarrierReadOnly).toBe(true)
    expect(conformance.releaseAssertions.anumCarrierRoleIsExplicit).toBe(true)
    expect(contract.l5.trustedRelations).toHaveLength(6)
    expect(contract.l5.genericCompositionAccepted).toBe(false)
  })

  it('pins exactly the two current upstream machine JSON byte-exactly', () => {
    const provenance = readJson(provenancePath) as Provenance
    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('614d3ef51889d117b95a4a3a109b6237227d30d8')
    expect(Object.keys(provenance.artifacts).sort()).toEqual(['conformance', 'contract'])
    expect(provenance.vendorPolicy).toContain('no leaf or historical compatibility JSON')
    expect(readdirSync(bundleRoot).sort()).toEqual([
      'mts-conformance-v0.6.json',
      'mts-contract-v0.6.json',
      'provenance.json',
    ])
    expect(existsSync(oldBundle)).toBe(false)
    for (const [key, filename] of Object.entries(artifactFiles)) {
      const path = resolve(bundleRoot, filename)
      expect(gitBlobSha(path), key).toBe(provenance.artifacts[key].gitBlobSha)
    }
  })

  it('rejects legacy/additive umbrellas instead of treating them as compatibility', () => {
    const currentConformance = readJson(conformancePath)
    expect(() =>
      validateCurrentMtsRelease(
        { schema: 'mts-contract/v0.5', status: 'accepted' },
        currentConformance
      )
    ).toThrow(/mts-contract\/v0\.6/)
    const additive = {
      ...(readJson(contractPath) as Record<string, unknown>),
      extends: 'mts-contract/v0.5',
      baseContract: 'contracts/mts-contract-v0.5.json',
    }
    expect(() => validateCurrentMtsRelease(additive, currentConformance)).toThrow(
      /historical umbrella/
    )
  })
})
