import contractJson from '../../contracts/anum_docs-v0.7/mts-contract-v0.7.json'
import conformanceJson from '../../contracts/anum_docs-v0.7/mts-conformance-v0.7.json'
import acceptanceJson from '../../contracts/anum_docs-v0.7/foundation-v2-c9-acceptance-v0.1.json'

export const CURRENT_MTS_CONTRACT = 'mts-contract/v0.7' as const
export const CURRENT_MTS_CONFORMANCE = 'mts-conformance/v0.7' as const
export const CURRENT_MTS_SOURCE_COMMIT =
  'f9075d531ff7ed7e07da012bf350ca1af5ba516a' as const

export const CURRENT_MTS_SURFACES = Object.freeze({
  anum: 'anum-deserialization/v0.4',
  directDeixis: 'mts-direct-deixis/v0.6',
  valueBundle: 'mts-value-bundle/v0.3',
})

const HISTORICAL_RUNTIME_PATHS = new Set([
  'core/mtc_ast.py',
  'core/mtc_context_analysis.py',
  'core/mtc_definitions.py',
  'core/mtc_interpreter.py',
  'core/mtc_opening_path.py',
  'core/mtc_parser.py',
  'core/mtc_value_bundle.py',
  'core/proof_checker.py',
  'core/root_library.py',
  'core/validate_root.py',
])

export interface CurrentMtsReleaseDescriptor {
  contract: typeof CURRENT_MTS_CONTRACT
  conformance: typeof CURRENT_MTS_CONFORMANCE
  sourceCommit: typeof CURRENT_MTS_SOURCE_COMMIT
  publicRuntime: string
  surfaces: typeof CURRENT_MTS_SURFACES
  previousAcceptedContract: 'mts-contract/v0.6'
  downstreamRepinAllowed: true
  historicalRuntimeSelectable: false
}

type JsonObject = Record<string, unknown>

function objectAt(value: unknown, path: string, errors: string[]): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`${path} must be an object`)
    return {}
  }
  return value as JsonObject
}

function expect(
  actual: unknown,
  expected: unknown,
  path: string,
  errors: string[],
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${path} mismatch`)
  }
}

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') {
    output.push(value)
    return output
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output)
    return output
  }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value as JsonObject)) collectStrings(item, output)
  }
  return output
}

export function validateCurrentMtsReleaseArtifacts(): string[] {
  const errors: string[] = []
  const contract = objectAt(contractJson, 'contract', errors)
  const conformance = objectAt(conformanceJson, 'conformance', errors)
  const acceptance = objectAt(acceptanceJson, 'acceptance', errors)

  expect(contract.schema, CURRENT_MTS_CONTRACT, 'contract.schema', errors)
  expect(contract.status, 'accepted', 'contract.status', errors)
  expect(contract.accepted, true, 'contract.accepted', errors)
  expect(
    contract.acceptedMtsVersion,
    CURRENT_MTS_CONTRACT,
    'contract.acceptedMtsVersion',
    errors,
  )
  expect(
    contract.conformanceCorpus,
    'contracts/mts-conformance-v0.7.json',
    'contract.conformanceCorpus',
    errors,
  )
  expect(
    contract.currentPointer,
    'cutover/foundation-v2-c9-acceptance-v0.1.json',
    'contract.currentPointer',
    errors,
  )

  const previous = objectAt(
    contract.previousAcceptedRelease,
    'contract.previousAcceptedRelease',
    errors,
  )
  expect(previous.contract, 'mts-contract/v0.6', 'previous.contract', errors)
  expect(previous.immutable, true, 'previous.immutable', errors)
  expect(previous.liveRuntimeSelectable, false, 'previous.liveRuntimeSelectable', errors)

  const identity = objectAt(contract.semanticIdentity, 'contract.semanticIdentity', errors)
  expect(identity.linkIdentity, 'by ordered semantic poles', 'identity.linkIdentity', errors)
  expect(identity.runtimeHandleIsSemanticIdentity, false, 'identity.runtimeHandleIsSemanticIdentity', errors)
  expect(identity.sourcePositionIsSemanticIdentity, false, 'identity.sourcePositionIsSemanticIdentity', errors)
  expect(identity.pathIsSemanticIdentity, false, 'identity.pathIsSemanticIdentity', errors)
  expect(identity.samePairCreatesSecondSemanticLink, false, 'identity.samePairCreatesSecondSemanticLink', errors)
  expect(identity.secondFullySelfClosedRootAllowed, false, 'identity.secondFullySelfClosedRootAllowed', errors)

  const transport = objectAt(contract.transport, 'contract.transport', errors)
  expect(transport.abits, ['[', ']', '1', '0'], 'transport.abits', errors)
  expect(transport.exactlyFour, true, 'transport.exactlyFour', errors)
  expect(transport.rootIsFifthAbit, false, 'transport.rootIsFifthAbit', errors)
  expect(transport.emptyStream, 'R', 'transport.emptyStream', errors)
  expect(transport.emptyGroup, 'R', 'transport.emptyGroup', errors)
  expect(
    transport.rawAndExistingCarrierShareOneStackMachine,
    true,
    'transport.rawAndExistingCarrierShareOneStackMachine',
    errors,
  )

  const effects = objectAt(contract.effects, 'contract.effects', errors)
  expect(effects.findEqualsMaterialize, false, 'effects.findEqualsMaterialize', errors)
  expect(effects.notFoundImpliesNonExistence, false, 'effects.notFoundImpliesNonExistence', errors)
  expect(effects.readMayMaterialize, false, 'effects.readMayMaterialize', errors)
  expect(effects.replayMayMaterialize, false, 'effects.replayMayMaterialize', errors)

  const release = objectAt(contract.release, 'contract.release', errors)
  expect(release.foundationV2Accepted, true, 'release.foundationV2Accepted', errors)
  expect(release.cutoverPerformed, true, 'release.cutoverPerformed', errors)
  expect(release.integratedC8Passed, true, 'release.integratedC8Passed', errors)
  expect(release.downstreamRepinAllowed, true, 'release.downstreamRepinAllowed', errors)
  expect(release.historicalRuntimeSelectable, false, 'release.historicalRuntimeSelectable', errors)
  expect(release.compatibilityOccurrenceMode, false, 'release.compatibilityOccurrenceMode', errors)
  expect(release.singleLiveSemanticRuntime, true, 'release.singleLiveSemanticRuntime', errors)

  const surfaces = objectAt(contract.surfaces, 'contract.surfaces', errors)
  expect(
    objectAt(surfaces.anum, 'surfaces.anum', errors).schema,
    CURRENT_MTS_SURFACES.anum,
    'surfaces.anum.schema',
    errors,
  )
  expect(
    objectAt(surfaces.directDeixis, 'surfaces.directDeixis', errors).schema,
    CURRENT_MTS_SURFACES.directDeixis,
    'surfaces.directDeixis.schema',
    errors,
  )
  expect(
    objectAt(surfaces.valueBundle, 'surfaces.valueBundle', errors).schema,
    CURRENT_MTS_SURFACES.valueBundle,
    'surfaces.valueBundle.schema',
    errors,
  )

  expect(conformance.schema, CURRENT_MTS_CONFORMANCE, 'conformance.schema', errors)
  expect(conformance.status, 'accepted', 'conformance.status', errors)
  expect(conformance.accepted, true, 'conformance.accepted', errors)
  expect(conformance.contract, CURRENT_MTS_CONTRACT, 'conformance.contract', errors)
  expect(
    conformance.versionedSurfaces,
    CURRENT_MTS_SURFACES,
    'conformance.versionedSurfaces',
    errors,
  )
  const c7 = objectAt(conformance.c7, 'conformance.c7', errors)
  expect(c7.performed, true, 'conformance.c7.performed', errors)
  expect(c7.historicalRuntimePresent, false, 'conformance.c7.historicalRuntimePresent', errors)
  expect(c7.externalHistoricalConsumers, 0, 'conformance.c7.externalHistoricalConsumers', errors)
  const c8 = objectAt(conformance.c8, 'conformance.c8', errors)
  expect(c8.performed, true, 'conformance.c8.performed', errors)
  expect(c8.integratedPathPassed, true, 'conformance.c8.integratedPathPassed', errors)
  expect(c8.requiredNegativeVectorsPassed, true, 'conformance.c8.requiredNegativeVectorsPassed', errors)
  expect(c8.compatibilityRuntimeUsed, false, 'conformance.c8.compatibilityRuntimeUsed', errors)

  expect(acceptance.schema, 'foundation-v2-c9-acceptance/v0.1', 'acceptance.schema', errors)
  expect(acceptance.decision, 'ACCEPT_MTS_V0_7', 'acceptance.decision', errors)
  const current = objectAt(acceptance.current, 'acceptance.current', errors)
  expect(current.contract, 'contracts/mts-contract-v0.7.json', 'acceptance.current.contract', errors)
  expect(current.conformance, 'contracts/mts-conformance-v0.7.json', 'acceptance.current.conformance', errors)
  expect(current.publicFacade, 'core/foundation_v2.py', 'acceptance.current.publicFacade', errors)
  const accepted = objectAt(acceptance.acceptance, 'acceptance.acceptance', errors)
  expect(accepted.foundationV2Accepted, true, 'acceptance.foundationV2Accepted', errors)
  expect(accepted.cutoverPerformed, true, 'acceptance.cutoverPerformed', errors)
  expect(accepted.downstreamRepinAllowed, true, 'acceptance.downstreamRepinAllowed', errors)
  expect(accepted.singleLiveSemanticRuntime, true, 'acceptance.singleLiveSemanticRuntime', errors)
  expect(accepted.historicalRuntimeSelectable, false, 'acceptance.historicalRuntimeSelectable', errors)
  expect(accepted.compatibilityRuntimeAllowed, false, 'acceptance.compatibilityRuntimeAllowed', errors)

  const currentMachineSurface = [...collectStrings(contractJson), ...collectStrings(conformanceJson)]
  for (const path of currentMachineSurface) {
    if (HISTORICAL_RUNTIME_PATHS.has(path)) {
      errors.push(`current MTS v0.7 references deleted historical runtime: ${path}`)
    }
  }

  return errors
}

export function assertCurrentMtsReleaseArtifacts(): void {
  const errors = validateCurrentMtsReleaseArtifacts()
  if (errors.length > 0) {
    throw new Error(`Invalid current MTS release artifacts:\n${errors.join('\n')}`)
  }
}

assertCurrentMtsReleaseArtifacts()

export const CURRENT_MTS_RELEASE: CurrentMtsReleaseDescriptor = Object.freeze({
  contract: CURRENT_MTS_CONTRACT,
  conformance: CURRENT_MTS_CONFORMANCE,
  sourceCommit: CURRENT_MTS_SOURCE_COMMIT,
  publicRuntime: 'core/foundation_v2.py',
  surfaces: CURRENT_MTS_SURFACES,
  previousAcceptedContract: 'mts-contract/v0.6',
  downstreamRepinAllowed: true,
  historicalRuntimeSelectable: false,
})
