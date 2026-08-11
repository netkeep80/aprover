import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CURRENT_MTS_CONTRACT,
  CURRENT_MTS_DEPENDENCIES,
  CURRENT_MTS_PROOF,
  CURRENT_MTS_SURFACE_ROLES,
  validateCurrentMtsRelease,
} from '../../src/core/mtsContract'

const bundleRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.5')
const contractPath = resolve(bundleRoot, 'mts-contract-v0.5.json')
const conformancePath = resolve(bundleRoot, 'mts-conformance-v0.5.json')
const provenancePath = resolve(bundleRoot, 'provenance.json')
const historicalBasePath = resolve(bundleRoot, 'mts-conformance-v0.2.json')

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

function gitBlobSha(path: string): string {
  const content = readFileSync(path)
  return createHash('sha1').update(`blob ${content.byteLength}\0`).update(content).digest('hex')
}

interface ArtifactProvenance {
  path: string
  gitBlobSha: string
  reason?: string
}

interface Provenance {
  sourceRepository: string
  sourceCommit: string
  artifacts: Record<string, ArtifactProvenance>
}

const artifactFiles: Record<string, string> = {
  contract: 'mts-contract-v0.5.json',
  conformance: 'mts-conformance-v0.5.json',
  anumStreamDeserialization: 'anum-stream-deserialization-v0.3.json',
  valueBundle: 'mts-value-bundle-v0.2.json',
  valueBundleConformance: 'mts-value-bundle-conformance-v0.2.json',
  definitionOpening: 'mts-definition-opening-v0.3.json',
  definitionOpeningConformance: 'mts-definition-opening-conformance-v0.3.json',
  derivationBase: 'mts-derivation-base-v0.3.json',
  derivationBaseConformance: 'mts-derivation-base-conformance-v0.3.json',
  openingPath: 'mts-opening-path-v0.4.json',
  openingPathConformance: 'mts-opening-path-conformance-v0.4.json',
  proof: 'mts-proof-v0.4.json',
  proofConformance: 'mts-proof-conformance-v0.4.json',
  directDeixis: 'mts-direct-deixis-v0.5.json',
  directDeixisConformance: 'mts-direct-deixis-conformance-v0.5.json',
}

describe('current pinned MTS/ANUM release snapshot from anum_docs', () => {
  it('validates a current-only v0.5 manifest with seven self-contained surfaces', () => {
    const bundle = validateCurrentMtsRelease(readJson(contractPath), readJson(conformancePath))

    expect(bundle.contract.schema).toBe(CURRENT_MTS_CONTRACT)
    expect(bundle.contract.dependsOn).toEqual(CURRENT_MTS_DEPENDENCIES)
    expect(bundle.contract.l5.proofSchema).toBe(CURRENT_MTS_PROOF)
    expect(bundle.conformance.schema).toBe('mts-conformance/v0.5')
    expect(bundle.conformance.requiredAcceptedSurfaces.map(surface => surface.role)).toEqual(
      CURRENT_MTS_SURFACE_ROLES
    )
    expect(bundle.conformance.requiredAcceptedSurfaces.map(surface => surface.schema)).toEqual(
      CURRENT_MTS_DEPENDENCIES
    )
  })

  it('keeps the semantic reset and proof vetoes explicit', () => {
    const { contract } = validateCurrentMtsRelease(readJson(contractPath), readJson(conformancePath))

    expect(contract.semanticIdentity.linkIdentity).toBe('by ordered semantic poles')
    expect(contract.semanticIdentity.runtimeHandleIsSemanticIdentity).toBe(false)
    expect(contract.semanticIdentity.samePairCreatesSecondSemanticLink).toBe(false)
    expect(contract.semanticIdentity.secondFullySelfClosedRootAllowed).toBe(false)
    expect(contract.anum.alphabet).toEqual(['[', ']', '1', '0'])
    expect(contract.anum.rootIsFifthAbit).toBe(false)
    expect(contract.anum.emptyStream).toBe('R')
    expect(contract.anum.emptyGroup).toBe('R')
    expect(contract.l5.trustedRelations).toEqual([
      'ContextuallySatisfies',
      'Opens',
      'NoVisibleDefinition',
      'DefinitionConflict',
      'NonAddressableDefinitionTarget',
      'DefinitionOpeningPath',
    ])
    expect(contract.l5.genericCompositionAccepted).toBe(false)
    expect(contract.l5.transportTagIsSemanticUmbrellaDependency).toBe(false)
  })

  it('pins the complete current vendor snapshot byte-exactly', () => {
    const provenance = readJson(provenancePath) as Provenance

    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('a0db1738a1943b8e753875d14a4220f250246a21')
    expect(Object.keys(provenance.artifacts).sort()).toEqual(Object.keys(artifactFiles).sort())

    for (const [key, filename] of Object.entries(artifactFiles)) {
      const path = resolve(bundleRoot, filename)
      expect(existsSync(path), key).toBe(true)
      expect(gitBlobSha(path), key).toBe(provenance.artifacts[key].gitBlobSha)
    }
  })

  it('does not retain the removed historical umbrella corpus', () => {
    const provenance = readJson(provenancePath) as Provenance

    expect(existsSync(historicalBasePath)).toBe(false)
    expect(provenance.artifacts.baseConformance).toBeUndefined()
    expect(provenance.artifacts.valueBundle.reason).toContain('schema id')
    expect((readJson(resolve(bundleRoot, 'mts-value-bundle-v0.2.json')) as { schema: string }).schema).toBe(
      'mts-value-bundle/v0.2'
    )
  })

  it('rejects a legacy or additive umbrella instead of treating it as compatibility', () => {
    const currentConformance = readJson(conformancePath)
    expect(() => validateCurrentMtsRelease({ schema: 'mts-contract/v0.2', status: 'accepted' }, currentConformance)).toThrow(
      /mts-contract\/v0\.5/
    )

    const additive = {
      ...(readJson(contractPath) as Record<string, unknown>),
      extends: 'mts-contract/v0.4',
      baseContract: 'contracts/mts-contract-v0.4.json',
    }
    expect(() => validateCurrentMtsRelease(additive, currentConformance)).toThrow(/historical umbrella/)
  })
})
