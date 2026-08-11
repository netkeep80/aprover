import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  MTS_PROOF_CONTRACT_VERSION_V04,
  MTS_PROOF_SCHEMA_V04,
  canonicalProofV04Json,
  checkProofV04,
  checkProofV04Data,
  parseProofObjectV04,
  proofObjectV04ToData,
} from '../../src/core/proofReplayV04'

const bundleRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.5')
const provenancePath = resolve(bundleRoot, 'provenance.json')
const contractPath = resolve(bundleRoot, 'mts-contract-v0.5.json')
const proofPath = resolve(bundleRoot, 'mts-proof-v0.4.json')
const proofConformancePath = resolve(bundleRoot, 'mts-proof-conformance-v0.4.json')
const derivationPath = resolve(bundleRoot, 'mts-derivation-base-v0.3.json')
const derivationConformancePath = resolve(bundleRoot, 'mts-derivation-base-conformance-v0.3.json')
const openingPath = resolve(bundleRoot, 'mts-opening-path-v0.4.json')
const openingConformancePath = resolve(bundleRoot, 'mts-opening-path-conformance-v0.4.json')

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

function gitBlobSha(path: string): string {
  const content = readFileSync(path)
  return createHash('sha1').update(`blob ${content.byteLength}\0`).update(content).digest('hex')
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
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
  baseJudgments: Array<{ id: string; judgment: Record<string, unknown> }>
  invalidArtifacts: Array<{ id: string; artifact: unknown }>
  mixedArtifact: {
    baseJudgmentId: string
    openingPathId: string
    requiredBothOrdersAccepted: boolean
    orderImpliesDependency: boolean
  }
}

function openingCorpus(): OpeningCorpus {
  return readJson(openingConformancePath) as OpeningCorpus
}

function proofCorpus(): ProofV04Corpus {
  return readJson(proofConformancePath) as ProofV04Corpus
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
      artifacts: Record<string, { gitBlobSha: string }>
    }
    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('a0db1738a1943b8e753875d14a4220f250246a21')

    const pinned: Array<[string, string]> = [
      [contractPath, provenance.artifacts.contract.gitBlobSha],
      [proofPath, provenance.artifacts.proof.gitBlobSha],
      [proofConformancePath, provenance.artifacts.proofConformance.gitBlobSha],
      [derivationPath, provenance.artifacts.derivationBase.gitBlobSha],
      [derivationConformancePath, provenance.artifacts.derivationBaseConformance.gitBlobSha],
      [openingPath, provenance.artifacts.openingPath.gitBlobSha],
      [openingConformancePath, provenance.artifacts.openingPathConformance.gitBlobSha],
    ]
    for (const [path, expected] of pinned) expect(gitBlobSha(path)).toBe(expected)
  })

  it('pins exactly six relations without restoring a historical umbrella dependency', () => {
    const contract = readJson(contractPath) as {
      schema: string
      l5: {
        proofSchema: string
        proofContractVersionTransportTag: string
        transportTagIsSemanticUmbrellaDependency: boolean
        trustedRelations: string[]
        genericCompositionAccepted: boolean
      }
    }
    expect(contract.schema).toBe('mts-contract/v0.5')
    expect(contract.l5.proofSchema).toBe(MTS_PROOF_SCHEMA_V04)
    expect(contract.l5.proofContractVersionTransportTag).toBe(MTS_PROOF_CONTRACT_VERSION_V04)
    expect(contract.l5.transportTagIsSemanticUmbrellaDependency).toBe(false)
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
})

describe('trusted current mts-proof/v0.4 replay', () => {
  it('replays every portable base judgment from the current proof corpus', () => {
    for (const vector of proofCorpus().baseJudgments) {
      expect(checkProofV04Data(proofArtifact([vector.judgment])), vector.id).toBe(true)
    }
  })

  it('rejects forged base claims through the same v0.4 API', () => {
    const open = proofCorpus().baseJudgments.find(item => item.id === 'opens-direct')
    const context = proofCorpus().baseJudgments.find(item => item.id === 'contextually-satisfies-aroot')
    if (open === undefined || context === undefined) throw new Error('missing current base vector')

    const forgedOpen = clone(open.judgment)
    ;((forgedOpen.expected as Record<string, unknown>).body as unknown) = 'c'
    expect(checkProofV04Data(proofArtifact([forgedOpen]))).toBe(false)

    const forgedContext = clone(context.judgment)
    ;((forgedContext.context as Record<string, unknown>).end as unknown) = 2
    expect(checkProofV04Data(proofArtifact([forgedContext]))).toBe(false)
  })

  it('accepts every current DefinitionOpeningPath vector', () => {
    for (const vector of openingCorpus().validPaths) {
      expect(checkProofV04Data(proofArtifact([openingJudgment(vector)])), vector.id).toBe(true)
    }
  })

  it('rejects every current invalid DefinitionOpeningPath vector', () => {
    for (const vector of openingCorpus().invalidPaths) {
      expect(checkProofV04Data(proofArtifact([openingJudgment(vector)])), vector.id).toBe(false)
    }
  })

  it('rejects every v0.4 transport forgery', () => {
    for (const vector of proofCorpus().invalidArtifacts) {
      expect(checkProofV04Data(vector.artifact), vector.id).toBe(false)
    }
  })

  it('does not give judgment order dependency semantics', () => {
    const mixed = proofCorpus().mixedArtifact
    const opening = openingCorpus().validPaths.find(item => item.id === mixed.openingPathId)
    const base = proofCorpus().baseJudgments.find(item => item.id === mixed.baseJudgmentId)
    if (opening === undefined || base === undefined) throw new Error('missing mixed corpus vector')

    expect(checkProofV04Data(proofArtifact([base.judgment, openingJudgment(opening)]))).toBe(true)
    expect(checkProofV04Data(proofArtifact([openingJudgment(opening), base.judgment]))).toBe(true)
    expect(mixed.requiredBothOrdersAccepted).toBe(true)
    expect(mixed.orderImpliesDependency).toBe(false)
  })

  it('round-trips canonical portable v0.4 data through fresh replay', () => {
    const opening = openingCorpus().validPaths.find(item => item.id === 'two-edge')
    if (opening === undefined) throw new Error('missing two-edge vector')
    const proof = parseProofObjectV04(proofArtifact([openingJudgment(opening)]))
    expect(checkProofV04(proof)).toBe(true)
    const data = proofObjectV04ToData(proof)
    expect(checkProofV04Data(data)).toBe(true)
    expect(JSON.parse(canonicalProofV04Json(proof))).toEqual(data)
  })
})
