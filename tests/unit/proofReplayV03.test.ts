import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  DefinitionEnvironment,
  canonicalExpression,
  definitionTargetKey,
  openDefinition,
  parseDefinition,
  parseDefinitionTarget,
} from '../../src/core/definitionEnvironment'
import {
  MTS_PROOF_CONTRACT_VERSION_V03,
  MTS_PROOF_SCHEMA_V03,
  checkJudgmentV03,
  parseProofObjectV03,
} from '../../src/core/proofReplayV03'
import { checkVersionedProof, detectProofVersion } from '../../src/core/proofReplayVersioned'

const bundleRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.4')
const contractPath = resolve(bundleRoot, 'mts-contract-v0.4.json')
const conformancePath = resolve(bundleRoot, 'mts-conformance-v0.4.json')
const proofPath = resolve(bundleRoot, 'mts-proof-v0.3.json')
const proofConformancePath = resolve(bundleRoot, 'mts-proof-conformance-v0.3.json')
const provenancePath = resolve(bundleRoot, 'provenance.json')

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

interface ArtifactProvenance {
  path: string
  sourceCommit: string
  gitBlobSha: string
}

interface Provenance {
  sourceRepository: string
  sourceCommit: string
  contract: ArtifactProvenance
  conformance: ArtifactProvenance
  proof: ArtifactProvenance
  proofConformance: ArtifactProvenance
}

interface ProofCorpus {
  proofVersion: string
  contractVersion: string
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

function proofArtifact(judgments: readonly unknown[]) {
  return {
    proofVersion: MTS_PROOF_SCHEMA_V03,
    contractVersion: MTS_PROOF_CONTRACT_VERSION_V03,
    judgments,
  }
}

function proofCorpus(): ProofCorpus {
  return readJson(proofConformancePath) as ProofCorpus
}

function validById(): Map<string, Record<string, unknown>> {
  return new Map(proofCorpus().validJudgments.map(item => [item.id, item.judgment]))
}

function forgeryJudgment(vector: ProofCorpus['forgeries'][number]): Record<string, unknown> {
  if (vector.judgment !== undefined) return clone(vector.judgment)
  const source = validById().get(vector.sourceJudgment ?? '')
  if (source === undefined) throw new Error(`missing source judgment ${vector.sourceJudgment}`)
  const result = vector.patch === undefined ? clone(source) : patchDotted(source, vector.patch)
  if (vector.replaceRelation !== undefined) result.relation = vector.replaceRelation
  for (const key of vector.remove ?? []) delete result[key]
  return result
}

describe('закреплённый MTS v0.4 / proof v0.3 bundle', () => {
  it('проверяет byte-exact provenance upstream release', () => {
    const provenance = readJson(provenancePath) as Provenance

    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('ec8161ceeecbecfd95481688821785fd32757873')
    const artifacts: Array<[string, ArtifactProvenance, string]> = [
      [contractPath, provenance.contract, '52ff42a3f1b4112b1a1707f4cec8a8bee07281f3'],
      [conformancePath, provenance.conformance, '4fbf336833dca0b6f3d9fe6143a2f40a8bd62474'],
      [proofPath, provenance.proof, '9cbc83e51ca83d391eb8d2018dcc5b2d25e8e65f'],
      [
        proofConformancePath,
        provenance.proofConformance,
        'c7f0223eee0564138e783a27f00b13bf8b48bcf9',
      ],
    ]
    for (const [path, artifact, sha] of artifacts) {
      expect(artifact.sourceCommit).toBe(provenance.sourceCommit)
      expect(artifact.gitBlobSha).toBe(sha)
      expect(gitBlobSha(path)).toBe(sha)
    }
  })

  it('закрепляет proof-publication boundary без composition и subject/focus semantics', () => {
    const contract = readJson(contractPath) as {
      schema: string
      l5: { proofSchema: string; trustedRelations: string[]; genericCompositionAccepted: boolean }
      contextBoundary: { subjectIdentity: boolean; currentFocusLinkRefIdentity: boolean }
      downstream: { aproverProofRepinAllowed: boolean; consumerMayInventCompositionRules: boolean }
    }
    expect(contract.schema).toBe('mts-contract/v0.4')
    expect(contract.l5.proofSchema).toBe(MTS_PROOF_SCHEMA_V03)
    expect(contract.l5.trustedRelations).toEqual([
      'ContextuallySatisfies',
      'Opens',
      'NoVisibleDefinition',
      'DefinitionConflict',
      'NonAddressableDefinitionTarget',
    ])
    expect(contract.l5.genericCompositionAccepted).toBe(false)
    expect(contract.contextBoundary.subjectIdentity).toBe(false)
    expect(contract.contextBoundary.currentFocusLinkRefIdentity).toBe(false)
    expect(contract.downstream.aproverProofRepinAllowed).toBe(true)
    expect(contract.downstream.consumerMayInventCompositionRules).toBe(false)
  })
})

describe('DefinitionEnvironment v0.3 consumer', () => {
  it('повторяет nearest-scope shadowing и replay-local DefinitionId', () => {
    const root = new DefinitionEnvironment()
    expect(root.register(parseDefinition('a : root')).kind).toBe('registered')
    const child = root.child(0)
    expect(child.register(parseDefinition('a : child')).kind).toBe('registered')

    const opened = openDefinition(parseDefinitionTarget('a'), child)
    expect(opened.kind).toBe('match')
    expect(opened.definitionId).toEqual({ scopePath: [0], ordinal: 0 })
    expect(canonicalExpression(opened.body!)).toBe('child')
  })

  it('отличает conflict от equality и не раскрывает RHS рекурсивно', () => {
    const environment = new DefinitionEnvironment()
    expect(environment.register(parseDefinition('a : b')).kind).toBe('registered')
    expect(environment.register(parseDefinition('a : c')).kind).toBe('conflict')
    expect(openDefinition(parseDefinitionTarget('a'), environment)).toEqual({ kind: 'conflict' })
  })

  it('не делает дейксис и anonymous [] глобальными definition keys', () => {
    expect(definitionTargetKey(parseDefinitionTarget('◁'))).toBeNull()
    expect(definitionTargetKey(parseDefinitionTarget('↑▷'))).toBeNull()
    expect(definitionTargetKey(parseDefinitionTarget('[]'))).toBeNull()
    expect(definitionTargetKey(parseDefinitionTarget('[1]'))).not.toBeNull()
    expect(definitionTargetKey(parseDefinitionTarget('(=)'))).not.toBeNull()
  })

  it('использует upstream-compatible canonical formatter, а не display printer identity', () => {
    const definition = parseDefinition('x : {◁ = ∞, ▷ = ∞}')
    expect(canonicalExpression(definition)).toBe('x : {◁ = ∞, ▷ = ∞}')
    expect(canonicalExpression(parseDefinition('a : b ⟼ c').form)).toBe('b ⟼ c')
  })
})

describe('trusted mts-proof/v0.3 replay', () => {
  it('replay-ит каждый upstream valid judgment', () => {
    const corpus = proofCorpus()
    expect(corpus.proofVersion).toBe(MTS_PROOF_SCHEMA_V03)
    expect(corpus.contractVersion).toBe(MTS_PROOF_CONTRACT_VERSION_V03)

    for (const vector of corpus.validJudgments) {
      const proof = parseProofObjectV03(proofArtifact([vector.judgment]))
      expect(proof.judgments).toHaveLength(1)
      expect(checkJudgmentV03(proof.judgments[0]), vector.id).toBe(true)
      expect(proof.judgments.every(checkJudgmentV03), vector.id).toBe(true)
      expect(checkVersionedProof(proofArtifact([vector.judgment])), vector.id).toBe(true)
    }
  })

  it('fail-closed для upstream invalid artifact vectors', () => {
    for (const vector of proofCorpus().invalidArtifacts) {
      expect(checkVersionedProof(vector.artifact), vector.id).toBe(false)
    }
  })

  it('отвергает каждую upstream forgery независимым replay', () => {
    for (const vector of proofCorpus().forgeries) {
      expect(vector.mustReject).toBe(true)
      expect(checkVersionedProof(proofArtifact([forgeryJudgment(vector)])), vector.id).toBe(false)
    }
  })

  it('не придаёт порядку judgments никакой dependency semantics', () => {
    const values = [...validById().values()]
    const proof = parseProofObjectV03(proofArtifact([values[2], values[5]]))
    expect(proof.judgments.every(checkJudgmentV03)).toBe(true)
    expect([...proof.judgments].reverse().every(checkJudgmentV03)).toBe(true)
  })

  it('определяет version явно и не преобразует v0.2/v0.3 друг в друга', () => {
    expect(detectProofVersion(proofArtifact([]))).toBe(MTS_PROOF_SCHEMA_V03)
    expect(
      detectProofVersion({ schema: 'mts-proof/v0.2', contractVersion: 'mts-contract/v0.2', steps: [] })
    ).toBe('mts-proof/v0.2')
    expect(detectProofVersion({ proofVersion: 'mts-proof/v9', judgments: [] })).toBeNull()
  })
})
