import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { validateMtsContractBundleV02 } from '../../src/core/mtsContract'

const contractPath = resolve(
  process.cwd(),
  'contracts/anum_docs-v0.2/mts-contract-v0.2.json'
)
const conformancePath = resolve(
  process.cwd(),
  'contracts/anum_docs-v0.2/mts-conformance-v0.2.json'
)
const proofPath = resolve(process.cwd(), 'contracts/anum_docs-v0.2/mts-proof-v0.2.json')
const provenancePath = resolve(process.cwd(), 'contracts/anum_docs-v0.2/provenance.json')

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

interface Provenance {
  sourceRepository: string
  sourceCommit: string
  contract: { path: string; gitBlobSha: string }
  conformance: { path: string; gitBlobSha: string }
  proof: { path: string; sourceCommit: string; gitBlobSha: string }
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

describe('pinned anum_docs MTS v0.2 contract', () => {
  it('loads as one validated contract + conformance bundle', () => {
    const bundle = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(bundle.contract.schema).toBe('mts-contract/v0.2')
    expect(bundle.conformance.schema).toBe('mts-conformance/v0.2')
    expect(bundle.conformance.contract).toBe(bundle.contract.schema)
  })

  it('pins the exact upstream Git blobs rather than a manually edited fork', () => {
    const provenance = readProvenance()

    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('294aa5e3d141e16fa93f88c0c18c4b78f8ae168c')
    expect(gitBlobSha(contractPath)).toBe(provenance.contract.gitBlobSha)
    expect(gitBlobSha(conformancePath)).toBe(provenance.conformance.gitBlobSha)
    expect(provenance.contract.gitBlobSha).toBe('fb414a1541f3430fa9292c0fdfd89ca07d5db8ea')
    expect(provenance.conformance.gitBlobSha).toBe('96303366a8808d9e67ee548b445fcdbf2233f336')
  })

  it('pins the proof contract from its newer upstream commit without rewriting old provenance', () => {
    const provenance = readProvenance()
    const proof = readJson(proofPath) as ProofContractV02

    expect(provenance.proof.sourceCommit).toBe(
      'd4d8e7c2291d26ea868d01dcc66f90d1c319c6e9'
    )
    expect(gitBlobSha(proofPath)).toBe(provenance.proof.gitBlobSha)
    expect(provenance.proof.gitBlobSha).toBe('7c125771be689ce2c825f5fa1be4674527f15dbb')
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
