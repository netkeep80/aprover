import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { validateMtsContractBundleV02 } from '../../src/core/mtsContract'

const bundleRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.2')
const contractPath = resolve(bundleRoot, 'mts-contract-v0.2.json')
const conformancePath = resolve(bundleRoot, 'mts-conformance-v0.2.json')
const proofPath = resolve(bundleRoot, 'mts-proof-v0.2.json')
const boundaryPath = resolve(bundleRoot, 'anum-boundary-projection-v0.2.json')
const denotationPath = resolve(bundleRoot, 'anum-denotation-v0.2.json')
const denotationConformancePath = resolve(bundleRoot, 'anum-denotation-conformance-v0.2.json')
const pairDenotationPath = resolve(bundleRoot, 'anum-pair-denotation-v0.2.json')
const pairDenotationConformancePath = resolve(
  bundleRoot,
  'anum-pair-denotation-conformance-v0.2.json'
)
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
  sourceCommit?: string
  gitBlobSha: string
}

interface Provenance {
  sourceRepository: string
  sourceCommit: string
  contract: ArtifactProvenance
  conformance: ArtifactProvenance
  proof: ArtifactProvenance
  anumBoundaryProjection: ArtifactProvenance
  anumDenotation: ArtifactProvenance
  anumDenotationConformance: ArtifactProvenance
  anumPairDenotation: ArtifactProvenance
  anumPairDenotationConformance: ArtifactProvenance
}

interface ProofContractV02 {
  schema: string
  status: string
  dependsOn: string
  checker: {
    trustedRuleSet: string[]
    replaysCanonicalInterpreter: boolean
    usesDisplayLabelsAsIdentity: boolean
    mayMaterialize: boolean
  }
  explicitlyNotTrusted: string[]
}

function readProvenance(): Provenance {
  return readJson(provenancePath) as Provenance
}

describe('pinned anum_docs MTS v0.2 contract bundle', () => {
  it('loads as one validated formal contract + conformance bundle', () => {
    const bundle = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(bundle.contract.schema).toBe('mts-contract/v0.2')
    expect(bundle.conformance.schema).toBe('mts-conformance/v0.2')
    expect(bundle.conformance.contract).toBe(bundle.contract.schema)
  })

  it('pins the current upstream top-level contract instead of the stale #86 blob', () => {
    const provenance = readProvenance()

    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('9921ce2c6c5ccf5cc62ec27daca571752e116fe9')
    expect(gitBlobSha(contractPath)).toBe(provenance.contract.gitBlobSha)
    expect(provenance.contract.gitBlobSha).toBe('a8fc7c1d565a87941dbd4c8d691ffd4887aec620')
    expect(provenance.contract.gitBlobSha).not.toBe('fb414a1541f3430fa9292c0fdfd89ca07d5db8ea')
  })

  it('pins every referenced accepted L3 artifact by exact Git blob SHA', () => {
    const provenance = readProvenance()
    const artifacts: Array<[string, ArtifactProvenance, string]> = [
      [boundaryPath, provenance.anumBoundaryProjection, '8229fc65d0c48a811b9f97e5512fcf6e350b512d'],
      [denotationPath, provenance.anumDenotation, '2c9681e2651276f70d54bac91ec1166203872812'],
      [
        denotationConformancePath,
        provenance.anumDenotationConformance,
        'af0740a358d40e8d70a9770387a26ef8303d5eaa',
      ],
      [pairDenotationPath, provenance.anumPairDenotation, 'b07d3989f8819185424782cce80759aa8310e465'],
      [
        pairDenotationConformancePath,
        provenance.anumPairDenotationConformance,
        '0d59c92ad30b82d23e598188f64feb3644bc81a8',
      ],
    ]

    for (const [path, artifact, expected] of artifacts) {
      expect(gitBlobSha(path)).toBe(artifact.gitBlobSha)
      expect(artifact.gitBlobSha).toBe(expected)
      expect(artifact.sourceCommit).toMatch(/^[0-9a-f]{40}$/)
    }
  })

  it('keeps unchanged conformance/proof artifacts pinned to their original upstream commits', () => {
    const provenance = readProvenance()
    const proof = readJson(proofPath) as ProofContractV02

    expect(gitBlobSha(conformancePath)).toBe(provenance.conformance.gitBlobSha)
    expect(provenance.conformance.gitBlobSha).toBe('96303366a8808d9e67ee548b445fcdbf2233f336')
    expect(provenance.conformance.sourceCommit).toBe(
      '294aa5e3d141e16fa93f88c0c18c4b78f8ae168c'
    )

    expect(gitBlobSha(proofPath)).toBe(provenance.proof.gitBlobSha)
    expect(provenance.proof.gitBlobSha).toBe('7c125771be689ce2c825f5fa1be4674527f15dbb')
    expect(provenance.proof.sourceCommit).toBe(
      'd4d8e7c2291d26ea868d01dcc66f90d1c319c6e9'
    )
    expect(proof.schema).toBe('mts-proof/v0.2')
    expect(proof.status).toBe('candidate')
    expect(proof.dependsOn).toBe('mts-contract/v0.2')
    expect(proof.checker.trustedRuleSet).toEqual(['interpret'])
    expect(proof.checker.replaysCanonicalInterpreter).toBe(true)
    expect(proof.checker.usesDisplayLabelsAsIdentity).toBe(false)
    expect(proof.checker.mayMaterialize).toBe(false)
    expect(proof.explicitlyNotTrusted).toContain('transitivity')
    expect(proof.explicitlyNotTrusted).toContain('modus-ponens')
  })

  it('validates the upstream L3 contract graph without implementing L3 semantics locally', () => {
    const { contract } = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(contract.anum.operations).toEqual(['serialize', 'deserialize'])
    expect(contract.anum.alphabet).toEqual(['[', ']', '1', '0'])
    expect(contract.anum.rootBoundaryProjection).toBe(
      'contracts/anum-boundary-projection-v0.2.json'
    )
    expect(contract.anum.denotationHandoff).toBe('contracts/anum-denotation-v0.2.json')
    expect(contract.anum.acceptedPairDenotationSubset).toBe(
      'contracts/anum-pair-denotation-v0.2.json'
    )
    expect(contract.anum.recursiveDenotationIssue).toBe(95)
    expect(contract.anum.generalDenotationIssue).toBe(89)

    expect((readJson(boundaryPath) as { schema: string }).schema).toBe(
      'anum-boundary-projection/v0.2'
    )
    expect((readJson(denotationPath) as { schema: string }).schema).toBe('anum-denotation/v0.2')
    expect((readJson(pairDenotationPath) as { schema: string }).schema).toBe(
      'anum-pair-denotation/v0.2'
    )
  })

  it('treats the two context pronouns as atomic non-bracket code points', () => {
    const { contract } = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )
    const context = contract.formalNotation.context

    expect(context.atomicPronouns).toBe(true)
    expect(context.bracketOverloading).toBe(false)
    expect(context.roles).toEqual([
      { source: '◁', role: 'start' },
      { source: '▷', role: 'end' },
    ])
    expect(context.ancestor.operator).toBe('↑')
    expect(context.roles.every(role => [...role.source].length === 1)).toBe(true)
    expect(context.roles.some(role => /[\[\]]/.test(role.source))).toBe(false)
  })

  it('forbids display labels from becoming semantic identity', () => {
    const { contract } = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(contract.integration.displayLabelIsIdentity).toBe(false)
    expect(contract.formalNotation.anonymousForm.identity).toBe('ast-occurrence-path')
    expect(contract.integration.requiredRuntimeIdentities).toContain('HoleId')
    expect(contract.integration.requiredRuntimeIdentities).toContain('LinkRef')
  })

  it('keeps interpretation read-only and realization explicit', () => {
    const { contract } = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(contract.formalNotation.operations.interpret.effect).toBe('none')
    expect(contract.memory.interpretMayMaterialize).toBe(false)
    expect(contract.memory.effectOperations).toEqual(['realize', 'delete'])
    expect(contract.memory.readOperations).toContain('poles')
  })

  it('contains executable vectors for lexing, canonicalization and interpretation', () => {
    const { conformance } = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(conformance.lexing.length).toBeGreaterThan(0)
    expect(conformance.canonicalization.length).toBeGreaterThan(0)
    expect(conformance.interpretation.length).toBeGreaterThan(0)

    const bracketCase = conformance.lexing.find(
      item => item.id === 'atomic-pronouns-do-not-overload-brackets'
    )
    expect(bracketCase).toEqual({
      id: 'atomic-pronouns-do-not-overload-brackets',
      source: '◁[]▷',
      tokens: ['context-start', 'lbracket', 'rbracket', 'context-end'],
    })
  })
})
