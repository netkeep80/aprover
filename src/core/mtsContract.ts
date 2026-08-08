export interface MtsContextRole {
  source: string
  role: 'start' | 'end'
}

export interface MtsValueBundleContractRefV02 {
  contract: 'contracts/mts-value-bundle-v0.2.json'
  conformanceCorpus: 'contracts/mts-value-bundle-conformance-v0.2.json'
  surface: '{...}'
  staticRoles: ['ConstraintBundle', 'ValueBundle']
  runtimeRoleGuessing: false
  valueScope: 'flat-only'
  semanticIdentity: 'extensional-set-of-resolved-link-identities'
  sourceOccurrenceProvenance: true
  crossKindSingletonCoercion: false
  nestedValueBundle: false
  bundleValuedDefinition: false
  scalarOperatorLifting: false
  expansionReadOnly: true
  interpretMayRealize: false
  interpretMayDelete: false
}

export interface MtsContractV02 {
  schema: 'mts-contract/v0.2'
  status: 'accepted'
  conformanceCorpus: 'contracts/mts-conformance-v0.2.json'
  formalNotation: {
    anonymousForm: {
      source: '[]'
      identity: 'ast-occurrence-path'
      meaning: 'anonymous-link-form'
    }
    context: {
      atomicPronouns: true
      bracketOverloading: false
      roles: [MtsContextRole, MtsContextRole]
      ancestor: {
        operator: '↑'
        examples: Record<string, string>
      }
      genericPathLanguage: false
      materializedLinkRequired: false
    }
    operations: {
      parse: { effect: 'none' }
      interpret: {
        effect: 'none'
        returns: string[]
      }
    }
    patternMatching: {
      linkForm: 'decompose-existing-link'
      roundGrouping: 'transparent'
      materializes: false
    }
    equality: {
      execution: 'local-unification'
      globalRewrite: false
      definition: string
    }
    aroot: {
      definition: string
    }
    valueBundle: MtsValueBundleContractRefV02
  }
  anum: {
    operations: ['serialize', 'deserialize']
    alphabet: ['[', ']', '1', '0']
    rawCarrierDescription: 'contracts/anum-raw-carrier-v0.2.json'
    rootBoundaryProjection: 'contracts/anum-boundary-projection-v0.2.json'
    denotationHandoff: 'contracts/anum-denotation-v0.2.json'
    acceptedPairDenotationSubset: 'contracts/anum-pair-denotation-v0.2.json'
    acceptedRecursiveDenotationSubset: 'contracts/anum-recursive-denotation-v0.2.json'
    rootOpeningCollapse: string
    recursiveDenotationIssue: 101
    generalDenotationIssue: 89
  }
  memory: {
    readOperations: string[]
    effectOperations: ['realize', 'delete']
    interpretMayMaterialize: false
  }
  integration: {
    displayLabelIsIdentity: false
    requiredRuntimeIdentities: string[]
  }
}

export interface MtsLexingCase {
  id: string
  source: string
  tokens: string[]
}

export interface MtsCanonicalizationCase {
  id: string
  source: string
  canonical: string
}

export interface MtsInterpretationCase {
  id: string
  source: string
  context: {
    start: number
    end: number
    parent?: MtsInterpretationCase['context']
  }
  symbols: Record<string, number>
  memory: {
    links: Array<{ id: number; start: number; end: number }>
  }
  expected: {
    success: boolean
    substitutions: Array<{ path: number[]; link: number }>
    aliases: Array<{ path: number[]; targetPath: number[] }>
    traceKinds: string[]
  }
}

export interface MtsConformanceV02 {
  schema: 'mts-conformance/v0.2'
  contract: 'mts-contract/v0.2'
  status: 'accepted'
  lexing: MtsLexingCase[]
  canonicalization: MtsCanonicalizationCase[]
  interpretation: MtsInterpretationCase[]
}

export interface MtsContractBundleV02 {
  contract: MtsContractV02
  conformance: MtsConformanceV02
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

function string(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`)
  return value
}

function exactArray(actual: unknown, expected: readonly unknown[], name: string): void {
  const values = array(actual, name)
  if (JSON.stringify(values) !== JSON.stringify(expected)) {
    throw new TypeError(`${name} must be exactly ${JSON.stringify(expected)}`)
  }
}

function validateContextRole(value: unknown, index: number): MtsContextRole {
  const role = record(value, `formalNotation.context.roles[${index}]`)
  const source = string(role.source, `context role ${index} source`)
  if ([...source].length !== 1) {
    throw new TypeError(`context role ${index} must be exactly one Unicode code point`)
  }
  if (source.includes('[') || source.includes(']')) {
    throw new TypeError(`context role ${index} must not overload square brackets`)
  }
  if (role.role !== 'start' && role.role !== 'end') {
    throw new TypeError(`context role ${index} must be start or end`)
  }
  return { source, role: role.role }
}

function validateValueBundleRef(value: unknown): MtsValueBundleContractRefV02 {
  const bundle = record(value, 'formalNotation.valueBundle')
  exact(bundle.contract, 'contracts/mts-value-bundle-v0.2.json', 'valueBundle.contract')
  exact(
    bundle.conformanceCorpus,
    'contracts/mts-value-bundle-conformance-v0.2.json',
    'valueBundle.conformanceCorpus'
  )
  exact(bundle.surface, '{...}', 'valueBundle.surface')
  exactArray(bundle.staticRoles, ['ConstraintBundle', 'ValueBundle'], 'valueBundle.staticRoles')
  exact(bundle.runtimeRoleGuessing, false, 'valueBundle.runtimeRoleGuessing')
  exact(bundle.valueScope, 'flat-only', 'valueBundle.valueScope')
  exact(
    bundle.semanticIdentity,
    'extensional-set-of-resolved-link-identities',
    'valueBundle.semanticIdentity'
  )
  exact(bundle.sourceOccurrenceProvenance, true, 'valueBundle.sourceOccurrenceProvenance')
  exact(bundle.crossKindSingletonCoercion, false, 'valueBundle.crossKindSingletonCoercion')
  exact(bundle.nestedValueBundle, false, 'valueBundle.nestedValueBundle')
  exact(bundle.bundleValuedDefinition, false, 'valueBundle.bundleValuedDefinition')
  exact(bundle.scalarOperatorLifting, false, 'valueBundle.scalarOperatorLifting')
  exact(bundle.expansionReadOnly, true, 'valueBundle.expansionReadOnly')
  exact(bundle.interpretMayRealize, false, 'valueBundle.interpretMayRealize')
  exact(bundle.interpretMayDelete, false, 'valueBundle.interpretMayDelete')
  return value as MtsValueBundleContractRefV02
}

export function validateMtsContractV02(value: unknown): MtsContractV02 {
  const root = record(value, 'contract')
  exact(root.schema, 'mts-contract/v0.2', 'contract.schema')
  exact(root.status, 'accepted', 'contract.status')
  exact(
    root.conformanceCorpus,
    'contracts/mts-conformance-v0.2.json',
    'contract.conformanceCorpus'
  )

  const formalNotation = record(root.formalNotation, 'formalNotation')
  const anonymousForm = record(formalNotation.anonymousForm, 'formalNotation.anonymousForm')
  exact(anonymousForm.source, '[]', 'anonymousForm.source')
  exact(anonymousForm.identity, 'ast-occurrence-path', 'anonymousForm.identity')
  exact(anonymousForm.meaning, 'anonymous-link-form', 'anonymousForm.meaning')

  const context = record(formalNotation.context, 'formalNotation.context')
  exact(context.atomicPronouns, true, 'context.atomicPronouns')
  exact(context.bracketOverloading, false, 'context.bracketOverloading')
  exact(context.genericPathLanguage, false, 'context.genericPathLanguage')
  exact(context.materializedLinkRequired, false, 'context.materializedLinkRequired')

  const roles = array(context.roles, 'context.roles').map(validateContextRole)
  if (roles.length !== 2 || roles[0].role !== 'start' || roles[1].role !== 'end') {
    throw new TypeError('context.roles must contain exactly ordered start/end roles')
  }
  if (roles[0].source === roles[1].source) {
    throw new TypeError('context pronouns must be distinct')
  }

  const ancestor = record(context.ancestor, 'context.ancestor')
  exact(ancestor.operator, '↑', 'context.ancestor.operator')

  const operations = record(formalNotation.operations, 'formalNotation.operations')
  const parse = record(operations.parse, 'formalNotation.operations.parse')
  const interpret = record(operations.interpret, 'formalNotation.operations.interpret')
  exact(parse.effect, 'none', 'parse.effect')
  exact(interpret.effect, 'none', 'interpret.effect')

  const patternMatching = record(formalNotation.patternMatching, 'formalNotation.patternMatching')
  exact(patternMatching.linkForm, 'decompose-existing-link', 'patternMatching.linkForm')
  exact(patternMatching.roundGrouping, 'transparent', 'patternMatching.roundGrouping')
  exact(patternMatching.materializes, false, 'patternMatching.materializes')

  const equality = record(formalNotation.equality, 'formalNotation.equality')
  exact(equality.execution, 'local-unification', 'equality.execution')
  exact(equality.globalRewrite, false, 'equality.globalRewrite')
  string(equality.definition, 'equality.definition')

  const aroot = record(formalNotation.aroot, 'formalNotation.aroot')
  string(aroot.definition, 'aroot.definition')
  validateValueBundleRef(formalNotation.valueBundle)

  const anum = record(root.anum, 'anum')
  exactArray(anum.operations, ['serialize', 'deserialize'], 'anum.operations')
  exactArray(anum.alphabet, ['[', ']', '1', '0'], 'anum.alphabet')
  exact(
    anum.rawCarrierDescription,
    'contracts/anum-raw-carrier-v0.2.json',
    'anum.rawCarrierDescription'
  )
  exact(
    anum.rootBoundaryProjection,
    'contracts/anum-boundary-projection-v0.2.json',
    'anum.rootBoundaryProjection'
  )
  exact(
    anum.denotationHandoff,
    'contracts/anum-denotation-v0.2.json',
    'anum.denotationHandoff'
  )
  exact(
    anum.acceptedPairDenotationSubset,
    'contracts/anum-pair-denotation-v0.2.json',
    'anum.acceptedPairDenotationSubset'
  )
  exact(
    anum.acceptedRecursiveDenotationSubset,
    'contracts/anum-recursive-denotation-v0.2.json',
    'anum.acceptedRecursiveDenotationSubset'
  )
  string(anum.rootOpeningCollapse, 'anum.rootOpeningCollapse')
  exact(anum.recursiveDenotationIssue, 101, 'anum.recursiveDenotationIssue')
  exact(anum.generalDenotationIssue, 89, 'anum.generalDenotationIssue')

  const memory = record(root.memory, 'memory')
  exactArray(
    memory.readOperations,
    [
      'find',
      'poles',
      'findLink',
      'findStartProjection',
      'findEndProjection',
      'outgoing',
      'incoming',
      'allLinks',
    ],
    'memory.readOperations'
  )
  exactArray(memory.effectOperations, ['realize', 'delete'], 'memory.effectOperations')
  exact(memory.interpretMayMaterialize, false, 'memory.interpretMayMaterialize')

  const integration = record(root.integration, 'integration')
  exact(integration.displayLabelIsIdentity, false, 'integration.displayLabelIsIdentity')

  return value as MtsContractV02
}

export function validateMtsConformanceV02(
  value: unknown,
  contract: MtsContractV02
): MtsConformanceV02 {
  const root = record(value, 'conformance')
  exact(root.schema, 'mts-conformance/v0.2', 'conformance.schema')
  exact(root.contract, contract.schema, 'conformance.contract')
  exact(root.status, 'accepted', 'conformance.status')

  for (const [index, item] of array(root.lexing, 'conformance.lexing').entries()) {
    const caseValue = record(item, `lexing[${index}]`)
    string(caseValue.id, `lexing[${index}].id`)
    string(caseValue.source, `lexing[${index}].source`)
    array(caseValue.tokens, `lexing[${index}].tokens`)
  }

  for (const [index, item] of array(root.canonicalization, 'conformance.canonicalization').entries()) {
    const caseValue = record(item, `canonicalization[${index}]`)
    string(caseValue.id, `canonicalization[${index}].id`)
    string(caseValue.source, `canonicalization[${index}].source`)
    string(caseValue.canonical, `canonicalization[${index}].canonical`)
  }

  for (const [index, item] of array(root.interpretation, 'conformance.interpretation').entries()) {
    const caseValue = record(item, `interpretation[${index}]`)
    string(caseValue.id, `interpretation[${index}].id`)
    string(caseValue.source, `interpretation[${index}].source`)
    record(caseValue.context, `interpretation[${index}].context`)
    record(caseValue.symbols, `interpretation[${index}].symbols`)
    record(caseValue.memory, `interpretation[${index}].memory`)
    record(caseValue.expected, `interpretation[${index}].expected`)
  }

  return value as MtsConformanceV02
}

export function validateMtsContractBundleV02(
  contractValue: unknown,
  conformanceValue: unknown
): MtsContractBundleV02 {
  const contract = validateMtsContractV02(contractValue)
  const conformance = validateMtsConformanceV02(conformanceValue, contract)
  return { contract, conformance }
}
