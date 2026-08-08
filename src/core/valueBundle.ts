import type {
  ASTNode,
  SetExpr,
  SequenceExpr,
  SquareExpr,
} from './ast'
import type { LinkRef, OccurrencePath } from './interpreter'

export type BundleRole = 'ConstraintBundle' | 'ValueBundle'
export type ExpectedBundleRole = 'none' | 'constraint' | 'value' | 'scalar' | 'definition-rhs'

export interface BundleRoleAt {
  readonly path: OccurrencePath
  readonly role: BundleRole
}

export interface BundleElaboration {
  readonly roles: readonly BundleRoleAt[]
}

export interface ResolvedOccurrence {
  readonly path: OccurrencePath
  readonly link: LinkRef
}

export interface LinkValue {
  readonly kind: 'link'
  readonly identity: LinkRef
}

export interface BundleValue {
  readonly kind: 'bundle'
  readonly identities: readonly LinkRef[]
  readonly occurrences: readonly ResolvedOccurrence[]
}

export type MtsValue = LinkValue | BundleValue
export type FormResolver = (form: ASTNode, path: OccurrencePath) => LinkRef

/** Минимальная read-only поверхность L4 для раскрытия пучков. */
export interface BundleQueryMemory {
  findLink(start: LinkRef, end: LinkRef): LinkRef | undefined
  outgoing(start: LinkRef): readonly LinkRef[]
  incoming(end: LinkRef): readonly LinkRef[]
  allLinks(): readonly LinkRef[]
}

export class BundleElaborationError extends Error {
  constructor(
    public readonly code: string,
    public readonly path: OccurrencePath
  ) {
    super(`${code} at [${path.join(',')}]`)
    this.name = 'BundleElaborationError'
  }
}

export class BundleEvaluationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BundleEvaluationError'
  }
}

function isJudgment(node: ASTNode): boolean {
  return node.type === 'Equality' || node.type === 'Inequality'
}

function isForm(node: ASTNode): boolean {
  return !['Definition', 'Equality', 'Inequality', 'Statement', 'File'].includes(node.type)
}

function roleAt(elaboration: BundleElaboration, path: OccurrencePath): BundleRole | undefined {
  return elaboration.roles.find(item => samePath(item.path, path))?.role
}

function samePath(left: OccurrencePath, right: OccurrencePath): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function evidence(bundle: SetExpr): 'constraint' | 'value' | 'mixed' | undefined {
  const found = new Set<'constraint' | 'value'>()
  for (const item of bundle.elements) {
    if (item.type === 'Set') {
      const child = evidence(item as SetExpr)
      if (child === 'mixed') return 'mixed'
      if (child !== undefined) found.add(child)
    } else if (isJudgment(item)) {
      found.add('constraint')
    } else if (isForm(item)) {
      found.add('value')
    } else {
      throw new BundleElaborationError('unsupported-bundle-item', [])
    }
  }
  if (found.size > 1) return 'mixed'
  return [...found][0]
}

function containsBundle(node: ASTNode): boolean {
  if (node.type === 'Set') return true
  if (node.type === 'Sequence') {
    return (node as SequenceExpr).items.some(containsBundle)
  }
  if (node.type === 'Link' || node.type === 'Equality' || node.type === 'Inequality') {
    const binary = node as ASTNode & { left: ASTNode; right: ASTNode }
    return containsBundle(binary.left) || containsBundle(binary.right)
  }
  if (node.type === 'Male' || node.type === 'Female' || node.type === 'Not') {
    return containsBundle((node as ASTNode & { operand: ASTNode }).operand)
  }
  if (node.type === 'Round') {
    const content = (node as ASTNode & { content: ASTNode | null }).content
    return content !== null && containsBundle(content)
  }
  return false
}

function elaborateSet(
  bundle: SetExpr,
  path: OccurrencePath,
  expected: ExpectedBundleRole,
  roles: BundleRoleAt[]
): void {
  const intrinsic = evidence(bundle)
  if (intrinsic === 'mixed') {
    throw new BundleElaborationError('mixed-bundle-role-evidence', path)
  }
  if (expected === 'scalar') {
    throw new BundleElaborationError('bundle-not-supported-in-scalar-operator', path)
  }

  let role: BundleRole
  if (expected === 'definition-rhs') {
    if (intrinsic === 'value') {
      throw new BundleElaborationError('bundle-valued-definition-deferred', path)
    }
    role = 'ConstraintBundle'
  } else if (expected === 'constraint') {
    if (intrinsic === 'value') throw new BundleElaborationError('bundle-role-mismatch', path)
    role = 'ConstraintBundle'
  } else if (expected === 'value') {
    if (intrinsic === 'constraint') throw new BundleElaborationError('bundle-role-mismatch', path)
    role = 'ValueBundle'
  } else if (intrinsic === 'constraint') {
    role = 'ConstraintBundle'
  } else if (intrinsic === 'value') {
    role = 'ValueBundle'
  } else {
    throw new BundleElaborationError('ambiguous-empty-bundle-role', path)
  }

  if (role === 'ValueBundle' && bundle.elements.some(item => item.type === 'Set')) {
    throw new BundleElaborationError('nested-value-bundle-not-supported', path)
  }

  roles.push({ path: [...path], role })
  const childExpected: ExpectedBundleRole = role === 'ConstraintBundle' ? 'constraint' : 'scalar'
  bundle.elements.forEach((item, index) => {
    elaborateExpression(item, [...path, index], childExpected, roles)
  })
}

function elaborateExpression(
  node: ASTNode,
  path: OccurrencePath,
  expected: ExpectedBundleRole,
  roles: BundleRoleAt[]
): void {
  if (node.type === 'Set') {
    elaborateSet(node as SetExpr, path, expected, roles)
    return
  }

  if (node.type === 'Definition') {
    if (expected === 'scalar' || expected === 'value' || expected === 'constraint') {
      throw new BundleElaborationError('expression-role-mismatch', path)
    }
    const definition = node as ASTNode & { name: ASTNode; form: ASTNode }
    elaborateExpression(definition.name, [...path, 0], 'scalar', roles)
    elaborateExpression(definition.form, [...path, 1], 'definition-rhs', roles)
    return
  }

  if (node.type === 'Equality' || node.type === 'Inequality') {
    if (expected === 'scalar') throw new BundleElaborationError('expression-role-mismatch', path)
    const judgment = node as ASTNode & { left: ASTNode; right: ASTNode }
    elaborateExpression(judgment.left, [...path, 0], 'value', roles)
    elaborateExpression(judgment.right, [...path, 1], 'value', roles)
    return
  }

  if (node.type === 'Sequence') {
    if (expected === 'constraint') throw new BundleElaborationError('expression-role-mismatch', path)
    if (expected === 'scalar' && containsBundle(node)) {
      throw new BundleElaborationError('bundle-not-supported-in-scalar-operator', path)
    }
    if (expected === 'definition-rhs' && containsBundle(node)) {
      throw new BundleElaborationError('bundle-valued-definition-deferred', path)
    }
    ;(node as SequenceExpr).items.forEach((item, index) => {
      elaborateExpression(item, [...path, index], 'value', roles)
    })
    return
  }

  if (node.type === 'Link') {
    if (expected === 'constraint') throw new BundleElaborationError('expression-role-mismatch', path)
    const link = node as ASTNode & { left: ASTNode; right: ASTNode }
    elaborateExpression(link.left, [...path, 0], 'scalar', roles)
    elaborateExpression(link.right, [...path, 1], 'scalar', roles)
    return
  }

  if (node.type === 'Male' || node.type === 'Female' || node.type === 'Not') {
    if (expected === 'constraint') throw new BundleElaborationError('expression-role-mismatch', path)
    elaborateExpression((node as ASTNode & { operand: ASTNode }).operand, [...path, 0], 'scalar', roles)
    return
  }

  if (node.type === 'Round') {
    if (expected === 'constraint') throw new BundleElaborationError('expression-role-mismatch', path)
    const content = (node as ASTNode & { content: ASTNode | null }).content
    if (content !== null) elaborateExpression(content, [...path, 0], expected, roles)
    return
  }

  if (node.type === 'Square') {
    if (expected === 'constraint') throw new BundleElaborationError('expression-role-mismatch', path)
    return
  }

  if (isForm(node)) {
    if (expected === 'constraint') throw new BundleElaborationError('expression-role-mismatch', path)
    return
  }

  if (isJudgment(node)) {
    if (expected !== 'constraint') throw new BundleElaborationError('expression-role-mismatch', path)
    return
  }

  throw new BundleElaborationError('unsupported-expression', path)
}

/** Статически определяет роли фигурных записей, не читая память. */
export function elaborateBundles(
  expression: ASTNode,
  entry: ExpectedBundleRole = 'none'
): BundleElaboration {
  const roles: BundleRoleAt[] = []
  elaborateExpression(expression, [], entry, roles)
  return { roles }
}

/** Разрешает каждый элемент плоского пучка независимо, затем убирает повторы по LinkRef. */
export function evaluateFlatValueBundle(
  bundle: SetExpr,
  path: OccurrencePath,
  elaboration: BundleElaboration,
  resolveForm: FormResolver
): BundleValue {
  if (roleAt(elaboration, path) !== 'ValueBundle') {
    throw new BundleEvaluationError(`bundle at [${path.join(',')}] is not a ValueBundle`)
  }

  const occurrences: ResolvedOccurrence[] = []
  bundle.elements.forEach((item, index) => {
    if (item.type === 'Set') {
      throw new BundleEvaluationError('nested ValueBundle is not supported in v0.2')
    }
    if (!isForm(item) || isJudgment(item)) {
      throw new BundleEvaluationError('ValueBundle item must be a form')
    }
    const itemPath = [...path, index]
    occurrences.push({ path: itemPath, link: resolveForm(item, itemPath) })
  })

  return {
    kind: 'bundle',
    identities: [...new Set(occurrences.map(item => item.link))].sort((a, b) => a - b),
    occurrences,
  }
}

/** Локальное сравнение значений разных видов без приведения одиночного пучка к связи. */
export function valuesEqual(left: MtsValue, right: MtsValue): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'link' && right.kind === 'link') return left.identity === right.identity
  if (left.kind === 'bundle' && right.kind === 'bundle') {
    return (
      left.identities.length === right.identities.length &&
      left.identities.every((value, index) => value === right.identities[index])
    )
  }
  return false
}

function endpointDomain(
  expression: ASTNode,
  path: OccurrencePath,
  elaboration: BundleElaboration,
  resolveForm: FormResolver
): ReadonlySet<LinkRef> | null {
  if (expression.type === 'Set') {
    const value = evaluateFlatValueBundle(expression as SetExpr, path, elaboration, resolveForm)
    return value.identities.length === 0 ? null : new Set(value.identities)
  }
  return new Set([resolveForm(expression, path)])
}

/** Выполняет двухполюсное раскрытие как чистый запрос к существующим связям. */
export function expandBundleQuery(
  sequence: SequenceExpr,
  path: OccurrencePath,
  elaboration: BundleElaboration,
  resolveForm: FormResolver,
  memory: BundleQueryMemory
): BundleValue {
  if (sequence.items.length !== 2) {
    throw new BundleEvaluationError('bundle expansion requires exactly two endpoints in v0.2')
  }

  const [leftExpression, rightExpression] = sequence.items
  if (leftExpression.type !== 'Set' && rightExpression.type !== 'Set') {
    throw new BundleEvaluationError('bundle expansion requires at least one ValueBundle operand')
  }

  const left = endpointDomain(leftExpression, [...path, 0], elaboration, resolveForm)
  const right = endpointDomain(rightExpression, [...path, 1], elaboration, resolveForm)
  const identities = new Set<LinkRef>()

  if (left === null && right === null) {
    memory.allLinks().forEach(link => identities.add(link))
  } else if (left === null) {
    right!.forEach(end => memory.incoming(end).forEach(link => identities.add(link)))
  } else if (right === null) {
    left.forEach(start => memory.outgoing(start).forEach(link => identities.add(link)))
  } else {
    left.forEach(start => {
      right.forEach(end => {
        const found = memory.findLink(start, end)
        if (found !== undefined) identities.add(found)
      })
    })
  }

  return {
    kind: 'bundle',
    identities: [...identities].sort((a, b) => a - b),
    occurrences: [],
  }
}

/** Удобный разрешатель для тестов/простых consumers пучка. */
export function resolveCorpusForm(
  form: ASTNode,
  path: OccurrencePath,
  symbols: Readonly<Record<string, LinkRef>>,
  holes: Readonly<Record<string, LinkRef>>
): LinkRef {
  if (form.type === 'Identifier') {
    const name = (form as ASTNode & { name: string }).name
    const value = symbols[name]
    if (value === undefined) throw new BundleEvaluationError(`unbound symbol ${name}`)
    return value
  }
  if (form.type === 'Square' && (form as SquareExpr).content === null) {
    const key = path.join('.')
    const value = holes[key]
    if (value === undefined) throw new BundleEvaluationError(`unbound anonymous occurrence ${key}`)
    return value
  }
  throw new BundleEvaluationError(`unsupported resolved form ${form.type}`)
}
