import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CURRENT_MTS_CONTRACT,
  CURRENT_MTS_PROOF,
  validateCurrentMtsRelease,
} from '../../src/core/mtsContract'

const bundleRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.5')
const contractPath = resolve(bundleRoot, 'mts-contract-v0.5.json')
const conformancePath = resolve(bundleRoot, 'mts-conformance-v0.5.json')
const proofPath = resolve(bundleRoot, 'mts-proof-v0.4.json')
const proofConformancePath = resolve(bundleRoot, 'mts-proof-conformance-v0.4.json')
const baseConformancePath = resolve(bundleRoot, 'mts-conformance-v0.2.json')
const valueBundlePath = resolve(bundleRoot, 'mts-value-bundle-v0.2.json')
const valueBundleConformancePath = resolve(bundleRoot, 'mts-value-bundle-conformance-v0.2.json')
const anumStreamPath = resolve(bundleRoot, 'anum-stream-deserialization-v0.3.json')
const provenancePath = resolve(bundleRoot, 'provenance.json')

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

describe('current pinned MTS/ANUM release snapshot from anum_docs', () => {
  it('validates only the current v0.5 umbrella and its conformance surface', () => {
    const bundle = validateCurrentMtsRelease(readJson(contractPath), readJson(conformancePath))

    expect(bundle.contract.schema).toBe(CURRENT_MTS_CONTRACT)
    expect(bundle.contract.l5.proofSchema).toBe(CURRENT_MTS_PROOF)
    expect(bundle.conformance.schema).toBe('mts-conformance/v0.5')
    expect(bundle.conformance.contract).toBe(CURRENT_MTS_CONTRACT)
  })

  it('requires exactly the six current trusted proof relations', () => {
    const { contract } = validateCurrentMtsRelease(readJson(contractPath), readJson(conformancePath))

    expect(contract.l5.trustedRelations).toEqual([
      'ContextuallySatisfies',
      'Opens',
      'NoVisibleDefinition',
      'DefinitionConflict',
      'NonAddressableDefinitionTarget',
      'DefinitionOpeningPath',
    ])
    expect(contract.l5.genericCompositionAccepted).toBe(false)
  })

  it('pins proof v0.4 as the only downstream proof schema', () => {
    const { contract, conformance } = validateCurrentMtsRelease(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(contract.downstream.aproverProofRepinAllowed).toBe(true)
    expect(contract.downstream.requiredProofSchema).toBe(CURRENT_MTS_PROOF)
    expect(contract.downstream.consumerMayInventAdditionalCompositionRules).toBe(false)
    expect(conformance.downstreamAssertions.aproverMustPinMtsProofV04).toBe(true)
    expect(conformance.downstreamAssertions.aproverMustReplayAllSixRelationsIndependently).toBe(true)
    expect(conformance.downstreamAssertions.aproverMustNotInventAdditionalComposition).toBe(true)
  })

  it('pins the one current vendor snapshot byte-exactly', () => {
    const provenance = readJson(provenancePath) as Provenance

    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('d131ded6318385b122ed5f2c05691c467023c32d')

    const paths: Record<string, string> = {
      contract: contractPath,
      conformance: conformancePath,
      proof: proofPath,
      proofConformance: proofConformancePath,
      baseConformance: baseConformancePath,
      valueBundle: valueBundlePath,
      valueBundleConformance: valueBundleConformancePath,
      anumStreamDeserialization: anumStreamPath,
    }

    for (const [key, path] of Object.entries(paths)) {
      expect(gitBlobSha(path), key).toBe(provenance.artifacts[key].gitBlobSha)
    }
  })

  it('keeps v0.2 schema ids only where current upstream still requires them', () => {
    const provenance = readJson(provenancePath) as Provenance

    expect(provenance.artifacts.baseConformance.reason).toContain('transitive current dependency')
    expect(provenance.artifacts.valueBundle.reason).toContain('current mts-contract/v0.5')
    expect((readJson(baseConformancePath) as { schema: string }).schema).toBe(
      'mts-conformance/v0.2'
    )
    expect((readJson(valueBundlePath) as { schema: string }).schema).toBe('mts-value-bundle/v0.2')
    expect((readJson(anumStreamPath) as { schema: string }).schema).toBe(
      'anum-stream-deserialization/v0.3'
    )
  })

  it('rejects a legacy umbrella instead of treating it as a compatibility release', () => {
    const legacy = { schema: 'mts-contract/v0.2', status: 'accepted' }
    expect(() => validateCurrentMtsRelease(legacy, readJson(conformancePath))).toThrow(
      /mts-contract\/v0\.5/
    )
  })
})
