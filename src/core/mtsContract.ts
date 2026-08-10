export const CURRENT_MTS_CONTRACT = 'mts-contract/v0.5' as const
export const CURRENT_MTS_PROOF = 'mts-proof/v0.4' as const

export interface MtsReleaseDependency {
  role: string
  path: string
  schema: string
  contract: string
}

export interface MtsContractV05 {
  schema: typeof CURRENT_MTS_CONTRACT
  status: 'accepted'
  accepted: true
  extends: 'mts-contract/v0.4'
  baseContract: 'contracts/mts-contract-v0.4.json'
  conformanceCorpus: 'contracts/mts-conformance-v0.5.json'
  dependsOn: ['mts-contract/v0.4', 'mts-opening-path/v0.4', 'mts-proof/v0.4', 'mts-direct-deixis/v0.5']
  l5: {
    proofSchema: typeof CURRENT_MTS_PROOF
    trustedRelations: string[]
    genericCompositionAccepted: false
  }
  downstream: {
    aproverProofRepinAllowed: true
    requiredProofSchema: typeof CURRENT_MTS_PROOF
    consumerMayInventAdditionalCompositionRules: false
  }
}

export interface MtsConformanceV05 {
  schema: 'mts-conformance/v0.5'
  status: 'accepted'
  contract: typeof CURRENT_MTS_CONTRACT
  requiredCorpora: MtsReleaseDependency[]
  releaseAssertions: Record<string, boolean>
  downstreamAssertions: Record<string, boolean>
}

export interface MtsContractBundleV05 {
  contract: MtsContractV05
  conformance: MtsConformanceV05
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`)
  }
  return value as Record<string, unknown>
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`)
  return value
}

function exact<T>(actual: unknown, expected: T, name: string): asserts actual is T {
  if (actual !== expected) {
    throw new TypeError(`${name} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function exactArray(actual: unknown, expected: readonly unknown[], name: string): void {
  const values = array(actual, name)
  if (JSON.stringify(values) !== JSON.stringify(expected)) {
    throw new TypeError(`${name} must be exactly ${JSON.stringify(expected)}`)
  }
}

export function validateMtsContractV05(value: unknown): MtsContractV05 {
  const root = record(value, 'contract')
  exact(root.schema, CURRENT_MTS_CONTRACT, 'contract.schema')
  exact(root.status, 'accepted', 'contract.status')
  exact(root.accepted, true, 'contract.accepted')
  exact(root.extends, 'mts-contract/v0.4', 'contract.extends')
  exact(root.baseContract, 'contracts/mts-contract-v0.4.json', 'contract.baseContract')
  exact(root.conformanceCorpus, 'contracts/mts-conformance-v0.5.json', 'contract.conformanceCorpus')
  exactArray(
    root.dependsOn,
    ['mts-contract/v0.4', 'mts-opening-path/v0.4', 'mts-proof/v0.4', 'mts-direct-deixis/v0.5'],
    'contract.dependsOn'
  )

  const l5 = record(root.l5, 'contract.l5')
  exact(l5.proofSchema, CURRENT_MTS_PROOF, 'contract.l5.proofSchema')
  exactArray(
    l5.trustedRelations,
    [
      'ContextuallySatisfies',
      'Opens',
      'NoVisibleDefinition',
      'DefinitionConflict',
      'NonAddressableDefinitionTarget',
      'DefinitionOpeningPath',
    ],
    'contract.l5.trustedRelations'
  )
  exact(l5.genericCompositionAccepted, false, 'contract.l5.genericCompositionAccepted')

  const downstream = record(root.downstream, 'contract.downstream')
  exact(downstream.aproverProofRepinAllowed, true, 'contract.downstream.aproverProofRepinAllowed')
  exact(downstream.requiredProofSchema, CURRENT_MTS_PROOF, 'contract.downstream.requiredProofSchema')
  exact(
    downstream.consumerMayInventAdditionalCompositionRules,
    false,
    'contract.downstream.consumerMayInventAdditionalCompositionRules'
  )

  return value as MtsContractV05
}

export function validateMtsConformanceV05(
  value: unknown,
  contract: MtsContractV05
): MtsConformanceV05 {
  const root = record(value, 'conformance')
  exact(root.schema, 'mts-conformance/v0.5', 'conformance.schema')
  exact(root.status, 'accepted', 'conformance.status')
  exact(root.contract, contract.schema, 'conformance.contract')

  const required = array(root.requiredCorpora, 'conformance.requiredCorpora').map((item, index) => {
    const dependency = record(item, `conformance.requiredCorpora[${index}]`)
    for (const key of ['role', 'path', 'schema', 'contract'] as const) {
      if (typeof dependency[key] !== 'string') {
        throw new TypeError(`conformance.requiredCorpora[${index}].${key} must be a string`)
      }
    }
    return dependency as unknown as MtsReleaseDependency
  })

  const roles = required.map(item => item.role)
  exactArray(
    roles,
    ['base-v0.4', 'opening-path-v0.4', 'proof-v0.4', 'direct-deixis-v0.5'],
    'conformance.requiredCorpora roles'
  )
  const proof = required.find(item => item.role === 'proof-v0.4')
  if (proof?.schema !== 'mts-proof-conformance/v0.4' || proof.contract !== CURRENT_MTS_PROOF) {
    throw new TypeError('conformance proof corpus must bind mts-proof/v0.4')
  }

  const release = record(root.releaseAssertions, 'conformance.releaseAssertions')
  exact(release.allSixProofRelationsReplay, true, 'releaseAssertions.allSixProofRelationsReplay')
  exact(release.proofSearchRemainsUntrusted, true, 'releaseAssertions.proofSearchRemainsUntrusted')
  exact(release.genericCompositionAccepted, false, 'releaseAssertions.genericCompositionAccepted')
  exact(release.judgmentOrderImpliesDependency, false, 'releaseAssertions.judgmentOrderImpliesDependency')

  const downstream = record(root.downstreamAssertions, 'conformance.downstreamAssertions')
  exact(downstream.aproverMayPinMtsContractV05, true, 'downstream.aproverMayPinMtsContractV05')
  exact(downstream.aproverMustPinMtsProofV04, true, 'downstream.aproverMustPinMtsProofV04')
  exact(
    downstream.aproverMustReplayAllSixRelationsIndependently,
    true,
    'downstream.aproverMustReplayAllSixRelationsIndependently'
  )
  exact(
    downstream.aproverMustNotInventAdditionalComposition,
    true,
    'downstream.aproverMustNotInventAdditionalComposition'
  )

  return value as MtsConformanceV05
}

export function validateCurrentMtsRelease(
  contractValue: unknown,
  conformanceValue: unknown
): MtsContractBundleV05 {
  const contract = validateMtsContractV05(contractValue)
  const conformance = validateMtsConformanceV05(conformanceValue, contract)
  return { contract, conformance }
}
