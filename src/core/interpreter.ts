import type {
  ASTNode,
  ContextPronounExpr,
  EqExpr,
  FemaleExpr,
  IdentExpr,
  LinkExpr,
  MaleExpr,
  NeqExpr,
  NumExpr,
  RoundExpr,
  SetExpr,
  SquareExpr,
} from './ast'

export type LinkRef = number
export type OccurrencePath = readonly number[]

/** Read-only associative-memory surface required by canonical MTS v0.2 interpretation. */
export interface MemoryView {
  poles(link: LinkRef): readonly [LinkRef, LinkRef]
  findLink(start: LinkRef, end: LinkRef): LinkRef | undefined
  findStartProjection(form: LinkRef): LinkRef | undefined
  findEndProjection(form: LinkRef): LinkRef | undefined
}

/** Virtual binary role environment. It does not need to be materialized as a memory link. */
export interface ContextFrame {
  readonly start: LinkRef
  readonly end: LinkRef
  readonly parent?: ContextFrame
}

export interface HoleId {
  readonly path: OccurrencePath
}

export interface InterpretationSubstitution {
  readonly path: OccurrencePath
  readonly link: LinkRef
}

export interface InterpretationAlias {
  readonly path: OccurrencePath
  readonly targetPath: OccurrencePath
}

export interface InterpretationResult {
  readonly success: boolean
  readonly substitutions: readonly InterpretationSubstitution[]
  readonly aliases: readonly InterpretationAlias[]
  readonly trace: readonly string[]
}

interface InterpretationState {
  symbols: Map<string, LinkRef>
  holes: Map<string, LinkRef>
  aliases: Map<string, string>
  paths: Map<string, OccurrencePath>
  trace: string[]
}

type Resolved = LinkRef | HoleId

export class InterpretationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InterpretationError'
  }
}

function pathKey(path: OccurrencePath): string {
  return path.join('.')
}

function comparePaths(left: OccurrencePath, right: OccurrencePath): number {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return left.length - right.length
}

function isHole(value: Resolved): value is HoleId {
  return typeof value !== 'number'
}

function hole(path: OccurrencePath, state: InterpretationState): HoleId {
  const key = pathKey(path)
  state.paths.set(key, path)
  return { path }
}

function cloneState(state: InterpretationState): InterpretationState {
  return {
    symbols: new Map(state.symbols),
    holes: new Map(state.holes),
    aliases: new Map(state.aliases),
    paths: new Map(state.paths),
    trace: [...state.trace],
  }
}

/** Resolve one atomic context pronoun against the current or an ancestor frame. */
export function resolveContextPronoun(
  pronoun: ContextPronounExpr,
  frame: ContextFrame
): LinkRef {
  let anchor: ContextFrame | undefined = frame
  for (let index = 0; index < pronoun.up; index++) {
    anchor = anchor.parent
    if (!anchor) {
      throw new InterpretationError(
        `Context pronoun ascends above the root context: up=${pronoun.up}`
      )
    }
  }
  return pronoun.pole === 'start' ? anchor.start : anchor.end
}

/**
 * Interpret one canonical MTS v0.2 equality/inequality/bundle against existing memory.
 *
 * This function is deliberately read-only: it can inspect MemoryView but cannot realize
 * missing links or projections. Anonymous [] identity is its structural AST path.
 */
export function interpretConstraints(
  expression: ASTNode,
  frame: ContextFrame,
  memory: MemoryView,
  symbols: Readonly<Record<string, LinkRef>> = {}
): InterpretationResult {
  const state: InterpretationState = {
    symbols: new Map(Object.entries(symbols)),
    holes: new Map(),
    aliases: new Map(),
    paths: new Map(),
    trace: [],
  }

  const success = interpretExpression(expression, [], frame, memory, state)
  return {
    success,
    substitutions: groundedHoles(state),
    aliases: normalizedAliases(state),
    trace: state.trace,
  }
}

function interpretExpression(
  expression: ASTNode,
  path: OccurrencePath,
  frame: ContextFrame,
  memory: MemoryView,
  state: InterpretationState
): boolean {
  if (expression.type === 'Equality') {
    const equality = expression as EqExpr
    state.trace.push('equality')
    return unifyForms(
      equality.left,
      [...path, 0],
      equality.right,
      [...path, 1],
      frame,
      memory,
      state
    )
  }

  if (expression.type === 'Inequality') {
    const inequality = expression as NeqExpr
    state.trace.push('inequality')
    const trial = cloneState(state)
    return !unifyForms(
      inequality.left,
      [...path, 0],
      inequality.right,
      [...path, 1],
      frame,
      memory,
      trial
    )
  }

  if (expression.type === 'Set') {
    const bundle = expression as SetExpr
    state.trace.push(`bundle:${bundle.elements.length}`)
    return bundle.elements.every((item, index) =>
      interpretExpression(item, [...path, index], frame, memory, state)
    )
  }

  throw new InterpretationError(
    `Constraint interpreter expects equality, inequality or bundle; got ${expression.type}`
  )
}

function unwrapRound(
  form: ASTNode,
  path: OccurrencePath
): { form: ASTNode; path: OccurrencePath } {
  let current = form
  let currentPath = path
  while (current.type === 'Round') {
    const round = current as RoundExpr
    if (round.content === null) {
      throw new InterpretationError('Round grouping used as a form must not be empty')
    }
    current = round.content
    currentPath = [...currentPath, 0]
  }
  return { form: current, path: currentPath }
}

function isAnonymous(form: ASTNode): boolean {
  return form.type === 'Square' && (form as SquareExpr).content === null
}

function unifyForms(
  rawLeft: ASTNode,
  rawLeftPath: OccurrencePath,
  rawRight: ASTNode,
  rawRightPath: OccurrencePath,
  frame: ContextFrame,
  memory: MemoryView,
  state: InterpretationState
): boolean {
  const leftUnwrapped = unwrapRound(rawLeft, rawLeftPath)
  const rightUnwrapped = unwrapRound(rawRight, rawRightPath)
  const left = leftUnwrapped.form
  const right = rightUnwrapped.form
  const leftPath = leftUnwrapped.path
  const rightPath = rightUnwrapped.path

  if (isAnonymous(left)) {
    const leftHole = resolveForm(left, leftPath, frame, memory, state)
    if (!isHole(leftHole)) throw new InterpretationError('Anonymous form resolved as a link')
    if (isAnonymous(right)) {
      const rightHole = resolveForm(right, rightPath, frame, memory, state)
      if (!isHole(rightHole)) throw new InterpretationError('Anonymous form resolved as a link')
      return unionHoles(leftHole, rightHole, state)
    }
    const rightValue = resolveForm(right, rightPath, frame, memory, state)
    return isHole(rightValue)
      ? unionHoles(leftHole, rightValue, state)
      : bindHole(leftHole, rightValue, state)
  }

  if (isAnonymous(right)) {
    const rightHole = resolveForm(right, rightPath, frame, memory, state)
    if (!isHole(rightHole)) throw new InterpretationError('Anonymous form resolved as a link')
    const leftValue = resolveForm(left, leftPath, frame, memory, state)
    return isHole(leftValue)
      ? unionHoles(leftValue, rightHole, state)
      : bindHole(rightHole, leftValue, state)
  }

  if (left.type === 'Link' && right.type === 'Link') {
    const leftLink = left as LinkExpr
    const rightLink = right as LinkExpr
    return (
      unifyForms(
        leftLink.left,
        [...leftPath, 0],
        rightLink.left,
        [...rightPath, 0],
        frame,
        memory,
        state
      ) &&
      unifyForms(
        leftLink.right,
        [...leftPath, 1],
        rightLink.right,
        [...rightPath, 1],
        frame,
        memory,
        state
      )
    )
  }

  if (left.type === 'Link') {
    const rightRef = requireLink(resolveForm(right, rightPath, frame, memory, state), 'right =')
    return matchLinkPattern(left as LinkExpr, leftPath, rightRef, frame, memory, state)
  }

  if (right.type === 'Link') {
    const leftRef = requireLink(resolveForm(left, leftPath, frame, memory, state), 'left =')
    return matchLinkPattern(right as LinkExpr, rightPath, leftRef, frame, memory, state)
  }

  const leftValue = resolveForm(left, leftPath, frame, memory, state)
  const rightValue = resolveForm(right, rightPath, frame, memory, state)
  if (isHole(leftValue) && isHole(rightValue)) return unionHoles(leftValue, rightValue, state)
  if (isHole(leftValue)) return bindHole(leftValue, rightValue, state)
  if (isHole(rightValue)) return bindHole(rightValue, leftValue, state)
  return leftValue === rightValue
}

function matchLinkPattern(
  pattern: LinkExpr,
  path: OccurrencePath,
  link: LinkRef,
  frame: ContextFrame,
  memory: MemoryView,
  state: InterpretationState
): boolean {
  const [start, end] = memory.poles(link)
  state.trace.push(`decompose:${link}->${start},${end}`)
  return (
    unifyFormWithRef(pattern.left, [...path, 0], start, frame, memory, state) &&
    unifyFormWithRef(pattern.right, [...path, 1], end, frame, memory, state)
  )
}

function unifyFormWithRef(
  rawForm: ASTNode,
  rawPath: OccurrencePath,
  value: LinkRef,
  frame: ContextFrame,
  memory: MemoryView,
  state: InterpretationState
): boolean {
  const unwrapped = unwrapRound(rawForm, rawPath)
  const form = unwrapped.form
  const path = unwrapped.path
  if (isAnonymous(form)) {
    const resolved = resolveForm(form, path, frame, memory, state)
    if (!isHole(resolved)) throw new InterpretationError('Anonymous form resolved as a link')
    return bindHole(resolved, value, state)
  }
  if (form.type === 'Link') {
    return matchLinkPattern(form as LinkExpr, path, value, frame, memory, state)
  }
  const resolved = resolveForm(form, path, frame, memory, state)
  return isHole(resolved) ? bindHole(resolved, value, state) : resolved === value
}

function resolveForm(
  rawForm: ASTNode,
  rawPath: OccurrencePath,
  frame: ContextFrame,
  memory: MemoryView,
  state: InterpretationState
): Resolved {
  const unwrapped = unwrapRound(rawForm, rawPath)
  const form = unwrapped.form
  const path = unwrapped.path

  if (form.type === 'ContextPronoun') {
    const pronoun = form as ContextPronounExpr
    const resolved = resolveContextPronoun(pronoun, frame)
    state.trace.push(`context:${'↑'.repeat(pronoun.up)}${pronoun.pole === 'start' ? '◁' : '▷'}->${resolved}`)
    return resolved
  }

  if (isAnonymous(form)) {
    const occurrence = hole(path, state)
    const root = findRoot(occurrence, state)
    const bound = state.holes.get(pathKey(root.path))
    return bound === undefined ? root : bound
  }

  if (form.type === 'Identifier') {
    return resolveSymbol((form as IdentExpr).name, state)
  }

  if (form.type === 'Infinity') {
    return resolveSymbol('∞', state)
  }

  if (form.type === 'Num') {
    return resolveSymbol(String((form as NumExpr).value), state)
  }

  if (form.type === 'Female') {
    const value = requireLink(
      resolveForm((form as FemaleExpr).operand, [...path, 0], frame, memory, state),
      '♀'
    )
    const projected = memory.findStartProjection(value)
    if (projected === undefined) {
      throw new InterpretationError(
        `Start projection for ${value} is not distinguished; interpret does not realize`
      )
    }
    state.trace.push(`start:${value}->${projected}`)
    return projected
  }

  if (form.type === 'Male') {
    const value = requireLink(
      resolveForm((form as MaleExpr).operand, [...path, 0], frame, memory, state),
      '♂'
    )
    const projected = memory.findEndProjection(value)
    if (projected === undefined) {
      throw new InterpretationError(
        `End projection for ${value} is not distinguished; interpret does not realize`
      )
    }
    state.trace.push(`end:${value}->${projected}`)
    return projected
  }

  if (form.type === 'Link') {
    const link = form as LinkExpr
    const start = requireLink(
      resolveForm(link.left, [...path, 0], frame, memory, state),
      'left pole of ⟼'
    )
    const end = requireLink(
      resolveForm(link.right, [...path, 1], frame, memory, state),
      'right pole of ⟼'
    )
    const found = memory.findLink(start, end)
    if (found === undefined) {
      throw new InterpretationError(
        `Link (${start} ⟼ ${end}) is not distinguished; interpret does not realize`
      )
    }
    state.trace.push(`link:${start},${end}->${found}`)
    return found
  }

  throw new InterpretationError(`Interpreter does not resolve form ${form.type}`)
}

function resolveSymbol(name: string, state: InterpretationState): LinkRef {
  const value = state.symbols.get(name)
  if (value === undefined) {
    throw new InterpretationError(`Symbol ${JSON.stringify(name)} is not bound`)
  }
  return value
}

function requireLink(value: Resolved, role: string): LinkRef {
  if (isHole(value)) {
    throw new InterpretationError(
      `${role} cannot be resolved before anonymous form ${JSON.stringify(value.path)} is bound`
    )
  }
  return value
}

function findRoot(value: HoleId, state: InterpretationState): HoleId {
  const key = pathKey(value.path)
  state.paths.set(key, value.path)
  const parentKey = state.aliases.get(key)
  if (parentKey === undefined) {
    state.aliases.set(key, key)
    return value
  }
  if (parentKey === key) return value
  const parentPath = state.paths.get(parentKey)
  if (!parentPath) throw new InterpretationError(`Unknown alias path ${parentKey}`)
  const root = findRoot({ path: parentPath }, state)
  state.aliases.set(key, pathKey(root.path))
  return root
}

function unionHoles(left: HoleId, right: HoleId, state: InterpretationState): boolean {
  const leftRoot = findRoot(left, state)
  const rightRoot = findRoot(right, state)
  const leftKey = pathKey(leftRoot.path)
  const rightKey = pathKey(rightRoot.path)
  if (leftKey === rightKey) return true

  const leftBound = state.holes.get(leftKey)
  const rightBound = state.holes.get(rightKey)
  if (leftBound !== undefined && rightBound !== undefined && leftBound !== rightBound) return false

  const [root, child] =
    comparePaths(leftRoot.path, rightRoot.path) <= 0
      ? [leftRoot, rightRoot]
      : [rightRoot, leftRoot]
  const rootKey = pathKey(root.path)
  const childKey = pathKey(child.path)
  state.aliases.set(rootKey, rootKey)
  state.aliases.set(childKey, rootKey)
  state.holes.delete(leftKey)
  state.holes.delete(rightKey)
  const bound = leftBound ?? rightBound
  if (bound !== undefined) state.holes.set(rootKey, bound)
  state.trace.push(`alias:${childKey}->${rootKey}`)
  return true
}

function bindHole(value: HoleId, link: LinkRef, state: InterpretationState): boolean {
  const root = findRoot(value, state)
  const key = pathKey(root.path)
  const existing = state.holes.get(key)
  if (existing !== undefined) return existing === link
  state.holes.set(key, link)
  state.trace.push(`bind:${key}->${link}`)
  return true
}

function groundedHoles(state: InterpretationState): InterpretationSubstitution[] {
  const result = new Map<string, LinkRef>()
  for (const key of state.aliases.keys()) {
    const path = state.paths.get(key)
    if (!path) continue
    const root = findRoot({ path }, state)
    const bound = state.holes.get(pathKey(root.path))
    if (bound !== undefined) result.set(key, bound)
  }
  for (const [key, value] of state.holes) result.set(key, value)

  return [...result.entries()]
    .map(([key, link]) => ({ path: state.paths.get(key) ?? [], link }))
    .sort((left, right) => comparePaths(left.path, right.path))
}

function normalizedAliases(state: InterpretationState): InterpretationAlias[] {
  const result: InterpretationAlias[] = []
  for (const key of state.aliases.keys()) {
    const path = state.paths.get(key)
    if (!path) continue
    const root = findRoot({ path }, state)
    if (pathKey(root.path) !== key) result.push({ path, targetPath: root.path })
  }
  return result.sort((left, right) => comparePaths(left.path, right.path))
}
