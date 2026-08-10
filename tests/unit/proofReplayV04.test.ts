import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  MTS_PROOF_CONTRACT_VERSION_V04,
  MTS_PROOF_SCHEMA_V04,
  canonicalProofV04Json,
  checkProofV04,
  parseProofObjectV04,
  proofObjectV04ToData,
} from '../../src/core/proofReplayV04'
import { checkVersionedProof, detectProofVersion } from '../../src/core/proofReplayVersioned'

const bundleRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.5')
const oldProofRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.4')
const provenancePath = resolve(bundleRoot, 'provenance.json')
const contractPath = resolve(bundleRoot, 'mts-contract-v0.5.json')
const conformancePath = resolve(bundleRoot, 'mts-conformance-v0.5.json')
const proofPath = resolve(bundleRoot, 'mts-proof-v0.4.json')
const proofConformancePath = resolve(bundleRoot, 'mts-proof-conformance-v0.4.json')
const openingPath = resolve(bundleRoot, 'mts-opening-path-v0.4.json')
const openingConformancePath = resolve(bundleRoot, 'mts-opening-path-conformance-v0.4.json')
const directDeixisPath = resolve(bundleRoot, 'mts-direct-deixis-v0.5.json')
const directDeixisConformancePath = resolve(bundleRoot, 'mts-direct-deixis-conformance-v0.5.json')
const baseProofConformancePath = resolve(oldProofRoot, 'mts-proof-conformance-v0.3.json')

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

function gitBlobSha(path: string): string {
  const content = readFileSync(path)
  return createHash('sha1')
    .update(`blob ${content.byteLength}\0`)
    .update(content)
    .digest('hex')
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function patchDotted(source: Record<string, unknown>, patch: Record<string, unknown>) {
  const result = clone(source)
  for (const [dotted, replacement] of Object.entries(patch)) {
    const parts = dotted.split('.')
    let current = result
    for (const part of parts.slice(0, -1)) current = current[part] as Record<string, unknown>
    current[parts[parts.length - 1]] = clone(replacement)
  }
  return result
}

interface BaseProofCorpus {
  validJudgments: Array<{ id: string; judgment: Record<string, unknown> }>
  invalidArtifacts: Array<{ id: string; artifact: unknown }>
  forgeries: Array<{
    id: string
    sourceJudgment?: string
    patch?: Record<string, unknown>
    replaceRelation?: string
    remove?: string[]
    judgment?: Record<string, unknown>
    mustReject: boolean
  }>
}

interface OpeningPathVector {
  id: string
  scopes: Array<{ path: number[]; parent: number[] | null; definitions: string[] }>
  lookupScope: number[]
  startTarget: string
  edges: Array<{
    target: string
    definitionId: { scopePath: number[]; ordinal: number }
    body: string
  }>
  finalBody: string
}

interface OpeningCorpus {
  validPaths: OpeningPathVector[]
  invalidPaths: OpeningPathVector[]
}

interface ProofV04Corpus {
  invalidArtifacts: Array<{ id: string; artifact: unknown }>
  mixedArtifact: {
    baseJudgmentId: string
    openingPathId: string
    requiredBothOrdersAccepted: boolean
    orderImpliesDependency: boolean
  }
}

function baseCorpus(): BaseProofCorpus {
  return readJson(baseProofConformancePath) as BaseProofCorpus
}

function openingCorpus(): OpeningCorpus {
  return readJson(openingConformancePath) as OpeningCorpus
}

function proofCorpus(): ProofV04Corpus {
  return readJson(proofConformancePath) as ProofV04Corpus
}

function validBaseById(): Map<string, Record<string, unknown>> {
  return new Map(baseCorpus().validJudgments.map(item => [item.id, item.judgment]))
}

function forgedBase(vector: BaseProofCorpus['forgeries'][number]): Record<string, unknown> {
  if (vector.judgment !== undefined) return clone(vector.judgment)
  const source = validBaseById().get(vector.sourceJudgment ?? '')
  if (source === undefined) throw new Error(`missing source judgment ${vector.sourceJudgment}`)
  const result = vector.patch === undefined ? clone(source) : patchDotted(source, vector.patch)
  if (vector.replaceRelation !== undefined) result.relation = vector.replaceRelation
  for (const key of vector.remove ?? []) delete result[key]
  return result
}

function openingJudgment(vector: OpeningPathVector): Record<string, unknown> {
  return {
    relation: 'DefinitionOpeningPath',
    scopes: clone(vector.scopes),
    lookupScope: clone(vector.lookupScope),
    startTarget: vector.startTarget,
    edges: clone(vector.edges),
    finalBody: vector.finalBody,
  }
}

function proofArtifact(judgments: readonly unknown[]) {
  return {
    proofVersion: MTS_PROOF_SCHEMA_V04,
    contractVersion: MTS_PROOF_CONTRACT_VERSION_V04,
    judgments,
  }
}

describe('current anum_docs v0.5 exact pin', () => {
  it('pins the compressed upstream release byte-exactly', () => {
    const provenance = readJson(provenancePath) as {
      sourceRepository: string
      sourceCommit: string
      artifacts: Record<string, { path: string; gitBlobSha: string }>
    }
    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('5f985b2abc273efaa6c369781c5ad1e08c282d34')

    const pinned: Array<[string, string]> = [
      [contractPath, provenance.artifacts.contract.gitBlobSha],
      [conformancePath, provenance.artifacts.conformance.gitBlobSha],
      [proofPath, provenance.artifacts.proof.gitBlobSha],
      [proofConformancePath, provenance.artifacts.proofConformance.gitBlobSha],
      [openingPath, provenance.artifacts.openingPath.gitBlobSha],
      [openingConformancePath, provenance.artifacts.openingPathConformance.gitBlobSha],
      [directDeixisPath, provenance.artifacts.directDeixis.gitBlobSha],
      [directDeixisConformancePath, provenance.artifacts.directDeixisConformance.gitBlobSha],
    ]
    for (const [path, expected] of pinned) expect(gitBlobSha(path)).toBe(expected)
  })

  it('pins exactly six trusted proof relations and no generic composition', () => {
    const contract = readJson(contractPath) as {
      schema: string
      l5: { proofSchema: string; trustedRelations: string[]; genericCompositionAccepted: boolean }
      downstream: { aproverProofRepinAllowed: boolean; consumerMayInventAdditionalCompositionRules: boolean }
    }
    expect(contract.schema).toBe('mts-contract/v0.5')
    expect(contract.l5.proofSchema).toBe(MTS_PROOF_SCHEMA_V04)
    expect(contract.l5.trustedRelations).toEqual([
      'ContextuallySatisfies',
      'Opens',
      'NoVisibleDefinition',
      'DefinitionConflict',
      'NonAddressableDefinitionTarget',
      'DefinitionOpeningPath',
    ])
    expect(contract.l5.genericCompositionAccepted).toBe(false)
    expect(contract.downstream.aproverProofRepinAllowed).toBe(true)
    expect(contract.downstream.consumerMayInventAdditionalCompositionRules).toBe(false)
  })
})

describe('trusted mts-proof/v0.4 replay', () => {
  it('lifts every accepted v0.3 base judgment through the same trusted replay', () => {
    for (const vector of baseCorpus().validJudgments) {
      expect(checkVersionedProof(proofArtifact([vector.judgment])), vector.id).toBe(true)
    }
  })

  it('rejects every accepted v0.3 base forgery after lifting', () => {
    for (const vector of baseCorpus().forgeries) {
      expect(vector.mustReject).toBe(true)
      expect(checkVersionedProof(proofArtifact([forgedBase(vector)])), vector.id).toBe(false)
    }
  })

  it('accepts every upstream DefinitionOpeningPath vector', () => {
    for (const vector of openingCorpus().validPaths) {
      expect(checkVersionedProof(proofArtifact([openingJudgment(vector)])), vector.id).toBe(true)
    }
  })

  it('rejects every upstream invalid DefinitionOpeningPath vector', () => {
    for (const vector of openingCorpus().invalidPaths) {
      expect(checkVersionedProof(proofArtifact([openingJudgment(vector)])), vector.id).toBe(false)
    }
  })

  it('rejects every v0.4 transport forgery', () => {
    for (const vector of proofCorpus().invalidArtifacts) {
      expect(checkVersionedProof(vector.artifact), vector.id).toBe(false)
    }
  })

  it('does not give judgment order dependency semantics', () => {
    const mixed = proofCorpus().mixedArtifact
    const base = validBaseById().get(mixed.baseJudgmentId)
    const opening = openingCorpus().validPaths.find(item => item.id === mixed.openingPathId)
    if (base === undefined || opening === undefined) throw new Error('missing mixed corpus vector')
    expect(checkVersionedProof(proofArtifact([base, openingJudgment(opening)]))).toBe(true)
    expect(checkVersionedProof(proofArtifact([openingJudgment(opening), base]))).toBe(true)
    expect(mixed.requiredBothOrdersAccepted).toBe(true)
    expect(mixed.orderImpliesDependency).toBe(false)
  })

  it('round-trips canonical portable v0.4 data through fresh replay', () => {
    const opening = openingCorpus().validPaths.find(item => item.id === 'two-edge')
    if (opening === undefined) throw new Error('missing two-edge vector')
    const proof = parseProofObjectV04(proofArtifact([openingJudgment(opening)]))
    expect(checkProofV04(proof)).toBe(true)
    const data = proofObjectV04ToData(proof)
    expect(checkVersionedProof(data)).toBe(true)
    expect(JSON.parse(canonicalProofV04Json(proof))).toEqual(data)
    expect(detectProofVersion(data)).toBe(MTS_PROOF_SCHEMA_V04)
  })
})
