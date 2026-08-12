export const CURRENT_MTS_CONTRACT = 'mts-contract/v0.6' as const
export const CURRENT_MTS_CONFORMANCE = 'mts-conformance/v0.6' as const
export const CURRENT_MTS_PROOF = 'mts-proof/v0.4' as const

export const CURRENT_MTS_DEPENDENCIES = [
  'anum-deserialization/v0.4',
  'mts-value-bundle/v0.2',
  'mts-definition-opening/v0.3',
  'mts-derivation-base/v0.3',
  'mts-opening-path/v0.4',
  'mts-proof/v0.4',
  'mts-direct-deixis/v0.5',
] as const

export const CURRENT_MTS_SURFACE_ROLES = [
  'anum-v0.4',
  'value-bundle-v0.2',
  'definition-opening-v0.3',
  'derivation-base-v0.3',
  'opening-path-v0.4',
  'proof-v0.4',
  'direct-deixis-v0.5',
] as const

export const CURRENT_MTS_SURFACE_KEYS = [
  'anum',
  'valueBundle',
  'definitionOpening',
  'derivationBase',
  'openingPath',
  'proof',
  'directDeixis',
] as const

export interface MtsAcceptedSurface {
  role: string
  surfaceKey: string
  schema: string
  conformanceKey: string
}

export interface MtsContractV06 {
  schema: typeof CURRENT_MTS_CONTRACT
  status: 'accepted'
  accepted: true
  dependsOn: string[]
  conformanceCorpus: 'contracts/mts-conformance-v0.6.json'
  semanticIdentity: {
    linkIdentity: 'by ordered semantic poles'
    runtimeHandleIsSemanticIdentity: false
    sourcePositionIsSemanticIdentity: false
    samePairCreatesSecondSemanticLink: false
    root: 'R = R ⟼ R'
    secondFullySelfClosedRootAllowed: false
  }
  anum: {
    schema: 'anum-deserialization/v0.4'
    alphabet: ['[', ']', '1', '0']
    rootIsFifthAbit: false
    emptyStream: 'R'
    emptyGroup: 'R'
    linkIdentityByOrderedPoles: true
    materializationAcceptedByThisOperation: false
    existingAsetCarrierSemanticsAccepted: true
    rawChannelInputAccepted: true
    carrierRoleIsExplicit: true
    carrierReadOnly: true
    bothTransportsShareStackMachine: true
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
  surfaces: Record<string, unknown>
}

export interface MtsConformanceV06 {
  schema: typeof CURRENT_MTS_CONFORMANCE
  status: 'accepted'
  accepted: true
  contract: typeof CURRENT_MTS_CONTRACT
  requiredAcceptedSurfaces: MtsAcceptedSurface[]
  releaseAssertions: Record<string, boolean>
  corpora: Record<string, unknown>
}

export interface MtsContractBundleV06 {
  contract: MtsContractV06
  conformance: MtsConformanceV06
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
    throw new TypeError(
      `${name} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    )
  }
}

function exactArray(actual: unknown, expected: readonly unknown[], name: string): void {
  const values = array(actual, name)
  if (JSON.stringify(values) !== JSON.stringify(expected)) {
    throw new TypeError(`${name} must be exactly ${JSON.stringify(expected)}`)
  }
}

export function validateMtsContractV06(value: unknown): MtsContractV06 {
  const root = record(value, 'contract')
  exact(root.schema, CURRENT_MTS_CONTRACT, 'contract.schema')
  exact(root.status, 'accepted', 'contract.status')
  exact(root.accepted, true, 'contract.accepted')
  if ('extends' in root || 'baseContract' in root) {
    throw new TypeError('current mts-contract/v0.6 must not inherit a historical umbrella')
  }
  exact(root.conformanceCorpus, 'contracts/mts-conformance-v0.6.json', 'contract.conformanceCorpus')
  exactArray(root.dependsOn, CURRENT_MTS_DEPENDENCIES, 'contract.dependsOn')

  const identity = record(root.semanticIdentity, 'contract.semanticIdentity')
  exact(
    identity.linkIdentity,
    'by ordered semantic poles',
    'contract.semanticIdentity.linkIdentity'
  )
  exact(
    identity.runtimeHandleIsSemanticIdentity,
    false,
    'contract.semanticIdentity.runtimeHandleIsSemanticIdentity'
  )
  exact(
    identity.sourcePositionIsSemanticIdentity,
    false,
    'contract.semanticIdentity.sourcePositionIsSemanticIdentity'
  )
  exact(
    identity.samePairCreatesSecondSemanticLink,
    false,
    'contract.semanticIdentity.samePairCreatesSecondSemanticLink'
  )
  exact(identity.root, 'R = R ⟼ R', 'contract.semanticIdentity.root')
  exact(
    identity.secondFullySelfClosedRootAllowed,
    false,
    'contract.semanticIdentity.secondFullySelfClosedRootAllowed'
  )

  const anum = record(root.anum, 'contract.anum')
  exact(anum.schema, 'anum-deserialization/v0.4', 'contract.anum.schema')
  exactArray(anum.alphabet, ['[', ']', '1', '0'], 'contract.anum.alphabet')
  exact(anum.rootIsFifthAbit, false, 'contract.anum.rootIsFifthAbit')
  exact(anum.emptyStream, 'R', 'contract.anum.emptyStream')
  exact(anum.emptyGroup, 'R', 'contract.anum.emptyGroup')
  exact(anum.linkIdentityByOrderedPoles, true, 'contract.anum.linkIdentityByOrderedPoles')
  exact(
    anum.materializationAcceptedByThisOperation,
    false,
    'contract.anum.materializationAcceptedByThisOperation'
  )
  exact(
    anum.existingAsetCarrierSemanticsAccepted,
    true,
    'contract.anum.existingAsetCarrierSemanticsAccepted'
  )
  exact(anum.rawChannelInputAccepted, true, 'contract.anum.rawChannelInputAccepted')
  exact(anum.carrierRoleIsExplicit, true, 'contract.anum.carrierRoleIsExplicit')
  exact(anum.carrierReadOnly, true, 'contract.anum.carrierReadOnly')
  exact(anum.bothTransportsShareStackMachine, true, 'contract.anum.bothTransportsShareStackMachine')

  const surfaces = record(root.surfaces, 'contract.surfaces')
  exactArray(Object.keys(surfaces), CURRENT_MTS_SURFACE_KEYS, 'contract.surfaces keys')
  CURRENT_MTS_SURFACE_KEYS.forEach((key, index) => {
    const surface = record(surfaces[key], `contract.surfaces.${key}`)
    exact(surface.schema, CURRENT_MTS_DEPENDENCIES[index], `contract.surfaces.${key}.schema`)
    exact(surface.status, 'accepted', `contract.surfaces.${key}.status`)
    exact(surface.accepted, true, `contract.surfaces.${key}.accepted`)
  })

  const anumSurface = record(surfaces.anum, 'contract.surfaces.anum')
  const scope = record(anumSurface.scope, 'contract.surfaces.anum.scope')
  exact(scope.rawChannelInputAccepted, true, 'contract.surfaces.anum.scope.rawChannelInputAccepted')
  exact(
    scope.existingAsetCarrierInputAccepted,
    true,
    'contract.surfaces.anum.scope.existingAsetCarrierInputAccepted'
  )
  exact(scope.carrierRoleIsExplicit, true, 'contract.surfaces.anum.scope.carrierRoleIsExplicit')
  exact(
    scope.materializationAcceptedHere,
    false,
    'contract.surfaces.anum.scope.materializationAcceptedHere'
  )
  const transports = record(anumSurface.transports, 'contract.surfaces.anum.transports')
  const carrier = record(
    transports.existingCarrier,
    'contract.surfaces.anum.transports.existingCarrier'
  )
  exact(
    carrier.roleIsExplicit,
    true,
    'contract.surfaces.anum.transports.existingCarrier.roleIsExplicit'
  )
  exact(carrier.readOnly, true, 'contract.surfaces.anum.transports.existingCarrier.readOnly')
  exact(
    carrier.materializes,
    false,
    'contract.surfaces.anum.transports.existingCarrier.materializes'
  )
  exact(
    carrier.singletonShortcutByVocabularyIdentity,
    false,
    'contract.surfaces.anum.transports.existingCarrier.singletonShortcutByVocabularyIdentity'
  )
  const convergence = record(
    anumSurface.transportConvergence,
    'contract.surfaces.anum.transportConvergence'
  )
  exact(
    convergence.carrierDecodesToRawBeforeStackMachine,
    true,
    'contract.surfaces.anum.transportConvergence.carrierDecodesToRawBeforeStackMachine'
  )
  exact(
    convergence.secondOpenCloseValueAlgorithm,
    false,
    'contract.surfaces.anum.transportConvergence.secondOpenCloseValueAlgorithm'
  )
  exact(
    convergence.equivalentRawAndCarrierYieldSameDenotation,
    true,
    'contract.surfaces.anum.transportConvergence.equivalentRawAndCarrierYieldSameDenotation'
  )

  const memory = record(root.memory, 'contract.memory')
  exactArray(
    memory.effectOperations,
    ['intern_link', 'delete_link'],
    'contract.memory.effectOperations'
  )
  exact(memory.findEqualsMaterialize, false, 'contract.memory.findEqualsMaterialize')
  exact(memory.notFoundImpliesNonExistence, false, 'contract.memory.notFoundImpliesNonExistence')
  exact(memory.readOperationsMayMaterialize, false, 'contract.memory.readOperationsMayMaterialize')

  const l5 = record(root.l5, 'contract.l5')
  exact(l5.proofSchema, CURRENT_MTS_PROOF, 'contract.l5.proofSchema')
  exact(
    l5.proofContractVersionTransportTag,
    'mts-contract/v0.4',
    'contract.l5.proofContractVersionTransportTag'
  )
  exact(
    l5.transportTagIsSemanticUmbrellaDependency,
    false,
    'contract.l5.transportTagIsSemanticUmbrellaDependency'
  )
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

  return value as MtsContractV06
}

export function validateMtsConformanceV06(
  value: unknown,
  contract: MtsContractV06
): MtsConformanceV06 {
  const root = record(value, 'conformance')
  exact(root.schema, CURRENT_MTS_CONFORMANCE, 'conformance.schema')
  exact(root.status, 'accepted', 'conformance.status')
  exact(root.accepted, true, 'conformance.accepted')
  exact(root.contract, contract.schema, 'conformance.contract')

  const surfaces = array(root.requiredAcceptedSurfaces, 'conformance.requiredAcceptedSurfaces').map(
    (item, index) => {
      const surface = record(item, `conformance.requiredAcceptedSurfaces[${index}]`)
      for (const key of ['role', 'surfaceKey', 'schema', 'conformanceKey'] as const) {
        if (typeof surface[key] !== 'string') {
          throw new TypeError(
            `conformance.requiredAcceptedSurfaces[${index}].${key} must be a string`
          )
        }
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
    surfaces.map(surface => surface.surfaceKey),
    CURRENT_MTS_SURFACE_KEYS,
    'conformance.requiredAcceptedSurfaces surface keys'
  )
  exactArray(
    surfaces.map(surface => surface.schema),
    CURRENT_MTS_DEPENDENCIES,
    'conformance.requiredAcceptedSurfaces schemas'
  )
  exactArray(
    surfaces.map(surface => surface.conformanceKey),
    CURRENT_MTS_SURFACE_KEYS,
    'conformance.requiredAcceptedSurfaces conformance keys'
  )

  const release = record(root.releaseAssertions, 'conformance.releaseAssertions')
  exact(
    release.historicalUmbrellaIsNormativeParent,
    false,
    'releaseAssertions.historicalUmbrellaIsNormativeParent'
  )
  exact(
    release.currentContractHasNoExtendsOrBaseContract,
    true,
    'releaseAssertions.currentContractHasNoExtendsOrBaseContract'
  )
  exact(release.linkIdentityByOrderedPoles, true, 'releaseAssertions.linkIdentityByOrderedPoles')
  exact(
    release.rootIsUniqueFullySelfClosedLink,
    true,
    'releaseAssertions.rootIsUniqueFullySelfClosedLink'
  )
  exact(release.anumHasExactlyFourAbits, true, 'releaseAssertions.anumHasExactlyFourAbits')
  exact(release.anumRootIsFifthAbit, false, 'releaseAssertions.anumRootIsFifthAbit')
  exact(release.anumEmptyStreamIsRoot, true, 'releaseAssertions.anumEmptyStreamIsRoot')
  exact(release.anumEmptyGroupIsRoot, true, 'releaseAssertions.anumEmptyGroupIsRoot')
  exact(
    release.existingAsetAnumCarrierAccepted,
    true,
    'releaseAssertions.existingAsetAnumCarrierAccepted'
  )
  exact(
    release.anumRawAndCarrierShareStackMachine,
    true,
    'releaseAssertions.anumRawAndCarrierShareStackMachine'
  )
  exact(release.anumCarrierReadOnly, true, 'releaseAssertions.anumCarrierReadOnly')
  exact(release.anumCarrierRoleIsExplicit, true, 'releaseAssertions.anumCarrierRoleIsExplicit')
  exact(
    release.trustedProofRelationsExactlySix,
    true,
    'releaseAssertions.trustedProofRelationsExactlySix'
  )
  exact(release.genericCompositionAccepted, false, 'releaseAssertions.genericCompositionAccepted')
  exact(
    release.judgmentOrderImpliesDependency,
    false,
    'releaseAssertions.judgmentOrderImpliesDependency'
  )

  const corpora = record(root.corpora, 'conformance.corpora')
  exactArray(Object.keys(corpora), CURRENT_MTS_SURFACE_KEYS, 'conformance.corpora keys')
  const anum = record(corpora.anum, 'conformance.corpora.anum')
  exact(anum.schema, 'anum-deserialization-conformance/v0.4', 'conformance.corpora.anum.schema')
  exact(anum.status, 'accepted', 'conformance.corpora.anum.status')
  exact(anum.accepted, true, 'conformance.corpora.anum.accepted')
  exact(anum.contract, 'anum-deserialization/v0.4', 'conformance.corpora.anum.contract')
  const carrier = record(anum.carrier, 'conformance.corpora.anum.carrier')
  exact(carrier.roleIsExplicit, true, 'conformance.corpora.anum.carrier.roleIsExplicit')
  exact(carrier.readOnly, true, 'conformance.corpora.anum.carrier.readOnly')
  exact(carrier.materializes, false, 'conformance.corpora.anum.carrier.materializes')
  const equivalence = record(anum.equivalence, 'conformance.corpora.anum.equivalence')
  exact(equivalence.sameDenotation, true, 'conformance.corpora.anum.equivalence.sameDenotation')
  exact(
    equivalence.sameStackErrorCode,
    true,
    'conformance.corpora.anum.equivalence.sameStackErrorCode'
  )

  return value as MtsConformanceV06
}

export function validateCurrentMtsRelease(
  contractValue: unknown,
  conformanceValue: unknown
): MtsContractBundleV06 {
  const contract = validateMtsContractV06(contractValue)
  const conformance = validateMtsConformanceV06(conformanceValue, contract)
  return { contract, conformance }
}
