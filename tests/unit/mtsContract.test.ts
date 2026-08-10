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
const provenancePath = resolve(bundleRoot, 'provenance.json')

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

function gitBlobSha(path: string): string {
  const content = readFileSync(path)
  return createHash('sha1').update(`blob ${content.byteLength}\0`).update(content).digest('hex')
}

describe('current pinned MTS release from anum_docs', () => {
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

  it('keeps current proof contract and corpus pinned byte-exactly', () => {
    const provenance = readJson(provenancePath) as {
      sourceRepository: string
      sourceCommit: string
      artifacts: Record<string, { gitBlobSha: string }>
    }

    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('5f985b2abc273efaa6c369781c5ad1e08c282d34')
    expect(gitBlobSha(contractPath)).toBe(provenance.artifacts.contract.gitBlobSha)
    expect(gitBlobSha(conformancePath)).toBe(provenance.artifacts.conformance.gitBlobSha)
    expect(gitBlobSha(proofPath)).toBe(provenance.artifacts.proof.gitBlobSha)
    expect(gitBlobSha(proofConformancePath)).toBe(provenance.artifacts.proofConformance.gitBlobSha)
  })

  it('rejects a legacy umbrella instead of treating it as a compatibility release', () => {
    const legacy = { schema: 'mts-contract/v0.2', status: 'accepted' }
    expect(() => validateCurrentMtsRelease(legacy, readJson(conformancePath))).toThrow(
      /mts-contract\/v0\.5/
    )
  })
})
