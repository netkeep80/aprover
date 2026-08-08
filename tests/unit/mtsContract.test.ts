import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { validateMtsContractBundleV02 } from '../../src/core/mtsContract'

const bundleRoot = resolve(process.cwd(), 'contracts/anum_docs-v0.2')
const contractPath = resolve(bundleRoot, 'mts-contract-v0.2.json')
const conformancePath = resolve(bundleRoot, 'mts-conformance-v0.2.json')
const proofPath = resolve(bundleRoot, 'mts-proof-v0.2.json')
const valueBundlePath = resolve(bundleRoot, 'mts-value-bundle-v0.2.json')
const valueBundleConformancePath = resolve(bundleRoot, 'mts-value-bundle-conformance-v0.2.json')
const boundaryPath = resolve(bundleRoot, 'anum-boundary-projection-v0.2.json')
const denotationPath = resolve(bundleRoot, 'anum-denotation-v0.2.json')
const denotationConformancePath = resolve(bundleRoot, 'anum-denotation-conformance-v0.2.json')
const pairDenotationPath = resolve(bundleRoot, 'anum-pair-denotation-v0.2.json')
const pairDenotationConformancePath = resolve(
  bundleRoot,
  'anum-pair-denotation-conformance-v0.2.json'
)
const rawCarrierPath = resolve(bundleRoot, 'anum-raw-carrier-v0.2.json')
const rawCarrierConformancePath = resolve(bundleRoot, 'anum-raw-carrier-conformance-v0.2.json')
const recursiveDenotationPath = resolve(bundleRoot, 'anum-recursive-denotation-v0.2.json')
const recursiveDenotationConformancePath = resolve(
  bundleRoot,
  'anum-recursive-denotation-conformance-v0.2.json'
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
  valueBundle: ArtifactProvenance
  valueBundleConformance: ArtifactProvenance
  anumBoundaryProjection: ArtifactProvenance
  anumDenotation: ArtifactProvenance
  anumDenotationConformance: ArtifactProvenance
  anumPairDenotation: ArtifactProvenance
  anumPairDenotationConformance: ArtifactProvenance
  anumRawCarrier: ArtifactProvenance
  anumRawCarrierConformance: ArtifactProvenance
  anumRecursiveDenotation: ArtifactProvenance
  anumRecursiveDenotationConformance: ArtifactProvenance
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

describe('закреплённый набор контрактов МТС v0.2 из anum_docs', () => {
  it('загружает единый основной контракт и корпус соответствия', () => {
    const bundle = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(bundle.contract.schema).toBe('mts-contract/v0.2')
    expect(bundle.conformance.schema).toBe('mts-conformance/v0.2')
    expect(bundle.conformance.contract).toBe(bundle.contract.schema)
  })

  it('закрепляет текущий верхний снимок anum_docs после принятия пучков', () => {
    const provenance = readProvenance()

    expect(provenance.sourceRepository).toBe('netkeep80/anum_docs')
    expect(provenance.sourceCommit).toBe('9278ee3a86af8df7d39ee6bf4ff0b3e14943bd7a')
    expect(gitBlobSha(contractPath)).toBe(provenance.contract.gitBlobSha)
    expect(provenance.contract.gitBlobSha).toBe('d7101f0277ffd9c072648bd821021cf08c0e9df4')
    expect(provenance.contract.sourceCommit).toBe(provenance.sourceCommit)
  })

  it('закрепляет принятые пучки значений байт-в-байт', () => {
    const provenance = readProvenance()

    expect(gitBlobSha(valueBundlePath)).toBe('6f6991945adf23aace7da7b3c535a279b751b88a')
    expect(gitBlobSha(valueBundlePath)).toBe(provenance.valueBundle.gitBlobSha)
    expect(provenance.valueBundle.sourceCommit).toBe(provenance.sourceCommit)

    expect(gitBlobSha(valueBundleConformancePath)).toBe(
      'ca5a3624f4cf1ab880686807d10d45afbf697670'
    )
    expect(gitBlobSha(valueBundleConformancePath)).toBe(
      provenance.valueBundleConformance.gitBlobSha
    )
    expect(provenance.valueBundleConformance.sourceCommit).toBe(provenance.sourceCommit)
  })

  it('сохраняет точное происхождение неизменённых L3-артефактов', () => {
    const provenance = readProvenance()
    const l3Origin = '62901cfc94831af41cf86cdc3acb1507c46c05c7'
    const artifacts: Array<[string, ArtifactProvenance, string]> = [
      [boundaryPath, provenance.anumBoundaryProjection, '822165f7940a4ec764bb7ac59e24e875ae03fb44'],
      [denotationPath, provenance.anumDenotation, '2c0544c1b2ff57bf9c5999b50bd881622b48159d'],
      [
        denotationConformancePath,
        provenance.anumDenotationConformance,
        'af0740a358d40e8d70a9770387a26ef8303d5eaa',
      ],
      [pairDenotationPath, provenance.anumPairDenotation, 'd09b4e4eccd9a5f439d20086bd1004cadc05b280'],
      [
        pairDenotationConformancePath,
        provenance.anumPairDenotationConformance,
        '0d5954625267299993aa66e71c55d95172a73625',
      ],
      [rawCarrierPath, provenance.anumRawCarrier, 'd5c0ddbb6c2d57967621c08551fbadd4f2cdd132'],
      [
        rawCarrierConformancePath,
        provenance.anumRawCarrierConformance,
        '39064ed361b4b53014f5f9fb7f026b2deba4b0f1',
      ],
      [
        recursiveDenotationPath,
        provenance.anumRecursiveDenotation,
        'f0fc16e989c4b49c6df476393108bc7bfb41cbb4',
      ],
      [
        recursiveDenotationConformancePath,
        provenance.anumRecursiveDenotationConformance,
        '70375b06f2031982bd42c62c8552a2edae1be4c1',
      ],
    ]

    for (const [path, artifact, expected] of artifacts) {
      expect(gitBlobSha(path)).toBe(artifact.gitBlobSha)
      expect(artifact.gitBlobSha).toBe(expected)
      expect(artifact.sourceCommit).toBe(l3Origin)
    }
  })

  it('сохраняет неизменные общий корпус и proof-контракт на их исходных commit', () => {
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

  it('проверяет ссылки верхнего контракта, не дублируя L3-семантику', () => {
    const { contract } = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(contract.anum.operations).toEqual(['serialize', 'deserialize'])
    expect(contract.anum.alphabet).toEqual(['[', ']', '1', '0'])
    expect(contract.anum.rawCarrierDescription).toBe('contracts/anum-raw-carrier-v0.2.json')
    expect(contract.anum.rootBoundaryProjection).toBe(
      'contracts/anum-boundary-projection-v0.2.json'
    )
    expect(contract.anum.denotationHandoff).toBe('contracts/anum-denotation-v0.2.json')
    expect(contract.anum.acceptedPairDenotationSubset).toBe(
      'contracts/anum-pair-denotation-v0.2.json'
    )
    expect(contract.anum.acceptedRecursiveDenotationSubset).toBe(
      'contracts/anum-recursive-denotation-v0.2.json'
    )

    expect(contract.formalNotation.valueBundle.contract).toBe(
      'contracts/mts-value-bundle-v0.2.json'
    )
    expect(contract.formalNotation.valueBundle.conformanceCorpus).toBe(
      'contracts/mts-value-bundle-conformance-v0.2.json'
    )
    expect(contract.formalNotation.valueBundle.runtimeRoleGuessing).toBe(false)
    expect(contract.formalNotation.valueBundle.valueScope).toBe('flat-only')
    expect(contract.formalNotation.valueBundle.expansionReadOnly).toBe(true)

    expect((readJson(boundaryPath) as { schema: string }).schema).toBe(
      'anum-boundary-projection/v0.2'
    )
    expect((readJson(valueBundlePath) as { schema: string; status: string }).status).toBe('accepted')
    expect((readJson(valueBundleConformancePath) as { accepted: boolean }).accepted).toBe(true)
  })

  it('сохраняет два атомарных контекстных местоимения вне квадратных скобок', () => {
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
  })

  it('не превращает видимую подпись в семантическое тождество', () => {
    const { contract } = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(contract.integration.displayLabelIsIdentity).toBe(false)
    expect(contract.formalNotation.anonymousForm.identity).toBe('ast-occurrence-path')
    expect(contract.integration.requiredRuntimeIdentities).toContain('HoleId')
    expect(contract.integration.requiredRuntimeIdentities).toContain('LinkRef')
  })

  it('оставляет интерпретацию только читающей, а изменение памяти явным', () => {
    const { contract } = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(contract.formalNotation.operations.interpret.effect).toBe('none')
    expect(contract.memory.interpretMayMaterialize).toBe(false)
    expect(contract.memory.effectOperations).toEqual(['realize', 'delete'])
    expect(contract.memory.readOperations).toEqual([
      'find',
      'poles',
      'findLink',
      'findStartProjection',
      'findEndProjection',
      'outgoing',
      'incoming',
      'allLinks',
    ])
  })

  it('содержит исполнимые случаи лексики, канонизации и интерпретации', () => {
    const { conformance } = validateMtsContractBundleV02(
      readJson(contractPath),
      readJson(conformancePath)
    )

    expect(conformance.lexing.length).toBeGreaterThan(0)
    expect(conformance.canonicalization.length).toBeGreaterThan(0)
    expect(conformance.interpretation.length).toBeGreaterThan(0)
  })
})
