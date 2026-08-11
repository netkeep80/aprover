export const CURRENT_MTS_CONTRACT = 'mts-contract/v0.5' as const
export const CURRENT_MTS_PROOF = 'mts-proof/v0.4' as const

export const CURRENT_MTS_DEPENDENCIES = [
  'anum-stream-deserialization/v0.3',
  'mts-value-bundle/v0.2',
  'mts-definition-opening/v0.3',
  'mts-derivation-base/v0.3',
  'mts-opening-path/v0.4',
  'mts-proof/v0.4',
  'mts-direct-deixis/v0.5',
] as const

export const CURRENT_MTS_SURFACE_ROLES = [
  'anum-stream-v0.3',
  'value-bundle-v0.2',
  'definition-opening-v0.3',
  'derivation-base-v0.3',
  'opening-path-v0.4',
  'proof-v0.4',
  'direct-deixis-v0.5',
] as const

export interface MtsAcceptedSurface {
  role: string
  contractPath: string
  schema: string
  conformance?: 'embedded'
  conformancePath?: string
}

export interface MtsContractV05 {
  schema: typeof CURRENT_MTS_CONTRACT
  status: 'accepted'
  accepted: true
  dependsOn: string[]
  conformanceCorpus: 'contracts/mts-conformance-v0.5.json'
  semanticIdentity: {
    linkIdentity: 'by ordered semantic poles'
    runtimeHandleIsSemanticIdentity: false
    sourcePositionIsSemanticIdentity: false
    samePairCreatesSecondSemanticLink: false
    root: 'R = R ⟼ R'
    secondFullySelfClosedRootAllowed: false
  }
  anum: {
    schema: 'anum-stream-deserialization/v0.3'
    alphabet: ['[', ']', '1', '0']
    rootIsFifthAbit: false
    emptyStream: 'R'
    emptyGroup: 'R'
    linkIdentityByOrderedPoles: true
    materializationAcceptedByThisOperation: false
    existingAsetCarrierSemanticsAccepted: false
  }
  memory: {
    readOperations: string[]
    effectOperations: ['intern_link', 'delete_link']
    findEqualsMaterialize: false
    notFoundImpliesNonExistence: false
    readOperationsMayMaterialize: false
  }
  l5: {
    proofSchema: typeof CURRENT_MTS_PROOF
    proofContractVersionTransportTag: 'mts-contract/v0.4'
    transportTagIsSemanticUmbrellaDependency: false
    trustedRelations: string[]
    genericCompositionAccepted: false
    judgmentOrderImpliesDependency: false
    proofDagDependencyAccepted: false
  }
}

export interface MtsConformanceV05 {
  schema: 'mts-conformance/v0.5'
  status: 'accepted'
  accepted: true
  contract: typeof CURRENT_MTS_CONTRACT
  requiredAcceptedSurfaces: MtsAcceptedSurface[]
  releaseAssertions: Record<string, boolean>
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
  if ('extends' in root || 'baseContract' in root) {
    throw new TypeError('current mts-contract/v0.5 must not inherit a historical umbrella')
  }
  exact(root.conformanceCorpus, 'contracts/mts-conformance-v0.5.json', 'contract.conformanceCorpus')
  exactArray(root.dependsOn, CURRENT_MTS_DEPENDENCIES, 'contract.dependsOn')

  const identity = record(root.semanticIdentity, 'contract.semanticIdentity')
  exact(identity.linkIdentity, 'by ordered semantic poles', 'contract.semanticIdentity.linkIdentity')
  exact(identity.runtimeHandleIsSemanticIdentity, false, 'contract.semanticIdentity.runtimeHandleIsSemanticIdentity')
  exact(identity.sourcePositionIsSemanticIdentity, false, 'contract.semanticIdentity.sourcePositionIsSemanticIdentity')
  exact(identity.samePairCreatesSecondSemanticLink, false, 'contract.semanticIdentity.samePairCreatesSecondSemanticLink')
  exact(identity.root, 'R = R ⟼ R', 'contract.semanticIdentity.root')
  exact(identity.secondFullySelfClosedRootAllowed, false, 'contract.semanticIdentity.secondFullySelfClosedRootAllowed')

  const anum = record(root.anum, 'contract.anum')
  exact(anum.schema, 'anum-stream-deserialization/v0.3', 'contract.anum.schema')
  exactArray(anum.alphabet, ['[', ']', '1', '0'], 'contract.anum.alphabet')
  exact(anum.rootIsFifthAbit, false, 'contract.anum.rootIsFifthAbit')
  exact(anum.emptyStream, 'R', 'contract.anum.emptyStream')
  exact(anum.emptyGroup, 'R', 'contract.anum.emptyGroup')
  exact(anum.linkIdentityByOrderedPoles, true, 'contract.anum.linkIdentityByOrderedPoles')
  exact(anum.materializationAcceptedByThisOperation, false, 'contract.anum.materializationAcceptedByThisOperation')
  exact(anum.existingAsetCarrierSemanticsAccepted, false, 'contract.anum.existingAsetCarrierSemanticsAccepted')

  const memory = record(root.memory, 'contract.memory')
  exactArray(memory.effectOperations, ['intern_link', 'delete_link'], 'contract.memory.effectOperations')
  exact(memory.findEqualsMaterialize, false, 'contract.memory.findEqualsMaterialize')
  exact(memory.notFoundImpliesNonExistence, false, 'contract.memory.notFoundImpliesNonExistence')
  exact(memory.readOperationsMayMaterialize, false, 'contract.memory.readOperationsMayMaterialize')

  const l5 = record(root.l5, 'contract.l5')
  exact(l5.proofSchema, CURRENT_MTS_PROOF, 'contract.l5.proofSchema')
  exact(l5.proofContractVersionTransportTag, 'mts-contract/v0.4', 'contract.l5.proofContractVersionTransportTag')
  exact(l5.transportTagIsSemanticUmbrellaDependency, false, 'contract.l5.transportTagIsSemanticUmbrellaDependency')
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
  exact(l5.judgmentOrderImpliesDependency, false, 'contract.l5.judgmentOrderImpliesDependency')
  exact(l5.proofDagDependencyAccepted, false, 'contract.l5.proofDagDependencyAccepted')

  return value as MtsContractV05
}

export function validateMtsConformanceV05(
  value: unknown,
  contract: MtsContractV05
): MtsConformanceV05 {
  const root = record(value, 'conformance')
  exact(root.schema, 'mts-conformance/v0.5', 'conformance.schema')
  exact(root.status, 'accepted', 'conformance.status')
  exact(root.accepted, true, 'conformance.accepted')
  exact(root.contract, contract.schema, 'conformance.contract')

  const surfaces = array(root.requiredAcceptedSurfaces, 'conformance.requiredAcceptedSurfaces').map(
    (item, index) => {
      const surface = record(item, `conformance.requiredAcceptedSurfaces[${index}]`)
      for (const key of ['role', 'contractPath', 'schema'] as const) {
        if (typeof surface[key] !== 'string') {
          throw new TypeError(`conformance.requiredAcceptedSurfaces[${index}].${key} must be a string`)
        }
      }
      if (surface.conformance !== undefined && surface.conformance !== 'embedded') {
        throw new TypeError(`conformance.requiredAcceptedSurfaces[${index}].conformance must be embedded`)
      }
      if (surface.conformancePath !== undefined && typeof surface.conformancePath !== 'string') {
        throw new TypeError(`conformance.requiredAcceptedSurfaces[${index}].conformancePath must be a string`)
      }
      return surface as unknown as MtsAcceptedSurface
    }
  )

  exactArray(
    surfaces.map(surface => surface.role),
    CURRENT_MTS_SURFACE_ROLES,
    'conformance.requiredAcceptedSurfaces roles'
  )
  exactArray(
    surfaces.map(surface => surface.schema),
    CURRENT_MTS_DEPENDENCIES,
    'conformance.requiredAcceptedSurfaces schemas'
  )

  const release = record(root.releaseAssertions, 'conformance.releaseAssertions')
  exact(release.historicalUmbrellaIsNormativeParent, false, 'releaseAssertions.historicalUmbrellaIsNormativeParent')
  exact(release.currentContractHasNoExtendsOrBaseContract, true, 'releaseAssertions.currentContractHasNoExtendsOrBaseContract')
  exact(release.linkIdentityByOrderedPoles, true, 'releaseAssertions.linkIdentityByOrderedPoles')
  exact(release.rootIsUniqueFullySelfClosedLink, true, 'releaseAssertions.rootIsUniqueFullySelfClosedLink')
  exact(release.anumHasExactlyFourAbits, true, 'releaseAssertions.anumHasExactlyFourAbits')
  exact(release.anumRootIsFifthAbit, false, 'releaseAssertions.anumRootIsFifthAbit')
  exact(release.anumEmptyStreamIsRoot, true, 'releaseAssertions.anumEmptyStreamIsRoot')
  exact(release.anumEmptyGroupIsRoot, true, 'releaseAssertions.anumEmptyGroupIsRoot')
  exact(release.trustedProofRelationsExactlySix, true, 'releaseAssertions.trustedProofRelationsExactlySix')
  exact(release.genericCompositionAccepted, false, 'releaseAssertions.genericCompositionAccepted')
  exact(release.judgmentOrderImpliesDependency, false, 'releaseAssertions.judgmentOrderImpliesDependency')
  exact(release.existingAsetAnumCarrierAccepted, false, 'releaseAssertions.existingAsetAnumCarrierAccepted')

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
