/**
 * Prover kernel for МТС (Meta-Theory of Links)
 *
 * The prover implements a minimal kernel based on:
 * - Modus Ponens: if P and (P -> Q) then Q
 * - Structural unification for equality checking
 * - Built-in axioms from МТС v0.1
 */

import type { ASTNode, LinkExpr, EqExpr } from './ast'
import {
  isLinkExpr,
  isDefExpr,
  isEqExpr,
  isNeqExpr,
  isMaleExpr,
  isFemaleExpr,
  isNotExpr,
  isSetExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isBracketExpr,
} from './ast'
import { parseExpr } from './parser'
import { normalize, toCanonicalString, astEqual } from './normalizer'

/** Substitution: maps variable names to AST nodes */
export type Substitution = Map<string, ASTNode>

/**
 * Axiom identifiers for МТС v0.1
 */
export type AxiomId =
  | 'A0' // Definition: (s : F) -> (s = F)
  | 'A1' // Identity: x = x, symmetry, transitivity
  | 'A2' // Congruence: {(a = c), (b = d)} -> ((a -> b) = (c -> d))
  | 'A3' // Link: be : (b -> e)
  | 'A4' // Смысл (акорень): ∞ : (∞ -> ∞)
  | 'A5' // Самозамыкание начала: ♂x : (♂x -> x)
  | 'A6' // Самозамыкание конца: x♀ : (x -> x♀)
  | 'A7' // Инверсия: !(a -> b) = (b -> a), !(♂x) = x♀, !(x♀) = ♂x, !∞ = ∞, !!x = x
  | 'A8' // Единица смысла: 1 : (♂∞ -> ∞♀)
  | 'A9' // Нуль смысла: 0 : !1
  | 'A10' // Абиты: '[' : ♂∞, ']' : ∞♀, '1' : 1, '0' : 0
  | 'A11' // Левоассоциативность: (a -> b -> c) = ((a -> b) -> c)

/**
 * Axiom information for display
 */
export interface AxiomInfo {
  id: AxiomId
  name: string
  formula: string
  description: string
}

/**
 * All axioms with their descriptions
 */
export const AXIOMS: Record<AxiomId, AxiomInfo> = {
  A0: {
    id: 'A0',
    name: 'Определение',
    formula: '(s : F) → (s = F)',
    description: 'Знак как запрос по форме',
  },
  A1: {
    id: 'A1',
    name: 'Тождественность',
    formula: 'x = x',
    description: 'Рефлексивность, симметрия, транзитивность',
  },
  A2: {
    id: 'A2',
    name: 'Конгруэнция',
    formula: '{(a = c), (b = d)} → ((a → b) = (c → d))',
    description: 'Структурная прозрачность',
  },
  A3: {
    id: 'A3',
    name: 'Связь',
    formula: 'be : (b → e)',
    description: 'Базовый конструктор',
  },
  A4: {
    id: 'A4',
    name: 'Смысл (акорень)',
    formula: '∞ : (∞ → ∞)',
    description: 'Полное самозамыкание',
  },
  A5: {
    id: 'A5',
    name: 'Самозамыкание начала',
    formula: '♂x : (♂x → x)',
    description: 'Начало замкнуто на связь',
  },
  A6: {
    id: 'A6',
    name: 'Самозамыкание конца',
    formula: 'x♀ : (x → x♀)',
    description: 'Конец замкнут на связь',
  },
  A7: {
    id: 'A7',
    name: 'Инверсия',
    formula: '!(a → b) = (b → a), !(♂x) = x♀, !(x♀) = ♂x, !∞ = ∞, !!x = x',
    description: 'Дуальность',
  },
  A8: {
    id: 'A8',
    name: 'Единица смысла',
    formula: '1 : (♂∞ → ∞♀)',
    description: 'Направленная связь',
  },
  A9: {
    id: 'A9',
    name: 'Нуль смысла',
    formula: '0 : !1',
    description: 'Инверсия единицы',
  },
  A10: {
    id: 'A10',
    name: 'Абиты',
    formula: "'[' : ♂∞, ']' : ∞♀, '1' : 1, '0' : 0",
    description: 'Четверичная система',
  },
  A11: {
    id: 'A11',
    name: 'Левоассоциативность',
    formula: '(a → b → c) = ((a → b) → c)',
    description: 'Порядок группировки',
  },
}

/**
 * Single proof step with detailed information
 */
export interface ProofStep {
  /** Step number (1-based) */
  index: number
  /** Description of the action performed */
  action: string
  /** Expression before transformation (optional) */
  before?: string
  /** Expression after transformation (optional) */
  after?: string
  /** Applied axiom (if any) */
  axiom?: AxiomInfo
  /** Additional details */
  details?: string
}

/**
 * Hint for failed verification
 */
export interface VerificationHint {
  /** Type of hint */
  type: 'structural' | 'definition' | 'axiom' | 'suggestion'
  /** Hint message */
  message: string
  /** Related axiom (if any) */
  relatedAxiom?: AxiomId
}

/** Proof result */
export interface ProofResult {
  success: boolean
  message: string
  /** Legacy steps (string array) for backward compatibility */
  steps?: string[]
  /** Detailed proof steps */
  proofSteps?: ProofStep[]
  /** Applied axioms */
  appliedAxioms?: AxiomInfo[]
  /** Hints for failed verification */
  hints?: VerificationHint[]
  substitution?: Substitution
}

/** Prover state */
export interface ProverState {
  /** Built-in axioms as (P -> Q) links */
  axioms: ASTNode[]
  /** User-defined definitions: s : F */
  definitions: Map<string, ASTNode>
  /** Proven facts (canonical string form) */
  facts: Set<string>
  /** Proof trace for debugging */
  trace: string[]
}

/**
 * Create initial prover state with built-in axioms
 */
export function createProverState(): ProverState {
  const state: ProverState = {
    axioms: [],
    definitions: new Map(),
    facts: new Set(),
    trace: [],
  }

  // Add built-in axioms from МТС v0.1

  // А0. Definition: (s : F) -> (s = F)
  // This is a meta-axiom, handled specially

  // А1. Identity reflexivity: x = x
  state.facts.add('(x=x)')

  // А4. Смысл (акорень): ∞ : (∞ -> ∞)
  state.definitions.set('∞', parseAndNormalize('∞ -> ∞'))

  // А5. Самозамыкание начала: ♂x : (♂x -> x)
  // Schema: for any x, ♂x = (♂x -> x)

  // А6. Самозамыкание конца: x♀ : (x -> x♀)
  // Schema: for any x, x♀ = (x -> x♀)

  // А7. Инверсия: various rules
  // !(a -> b) = (b -> a) - handled by normalizer
  // !!x = x - handled by normalizer
  // !∞ = ∞
  addAxiomEq(state, '!∞', '∞')

  // А8. Единица смысла: 1 : (♂∞ -> ∞♀)
  state.definitions.set('1', parseAndNormalize('♂∞ -> ∞♀'))

  // А9. Нуль смысла: 0 : !1
  state.definitions.set('0', parseAndNormalize('!1'))

  // А10. Абиты
  state.definitions.set('[', parseAndNormalize('♂∞'))
  state.definitions.set(']', parseAndNormalize('∞♀'))

  // А11. Левоассоциативность: (a -> b -> c) = ((a -> b) -> c)
  // This is built into the parser

  return state
}

/** Helper to parse and normalize expression */
function parseAndNormalize(input: string): ASTNode {
  return normalize(parseExpr(input))
}

/** Helper to add equality axiom */
function addAxiomEq(state: ProverState, left: string, right: string): void {
  const l = parseAndNormalize(left)
  const r = parseAndNormalize(right)
  const eq: EqExpr = {
    type: 'Equality',
    left: l,
    right: r,
  }
  state.facts.add(toCanonicalString(eq))
}

/**
 * Try to unify two AST nodes
 * Returns substitution if successful, null if failed
 */
export function unify(
  a: ASTNode,
  b: ASTNode,
  subst: Substitution = new Map()
): Substitution | null {
  // Apply existing substitutions
  a = applySubstitution(a, subst)
  b = applySubstitution(b, subst)

  // Identical nodes
  if (toCanonicalString(a) === toCanonicalString(b)) {
    return subst
  }

  // Variable unification
  if (isIdentExpr(a) && isVariable(a.name)) {
    return unifyVar(a.name, b, subst)
  }
  if (isIdentExpr(b) && isVariable(b.name)) {
    return unifyVar(b.name, a, subst)
  }

  // Structural unification
  if (isLinkExpr(a) && isLinkExpr(b)) {
    const s1 = unify(a.left, b.left, subst)
    if (!s1) return null
    return unify(a.right, b.right, s1)
  }

  if (isMaleExpr(a) && isMaleExpr(b)) {
    return unify(a.operand, b.operand, subst)
  }

  if (isFemaleExpr(a) && isFemaleExpr(b)) {
    return unify(a.operand, b.operand, subst)
  }

  if (isNotExpr(a) && isNotExpr(b)) {
    return unify(a.operand, b.operand, subst)
  }

  if (isSetExpr(a) && isSetExpr(b)) {
    if (a.elements.length !== b.elements.length) return null
    let s = subst
    for (let i = 0; i < a.elements.length; i++) {
      const s1 = unify(a.elements[i], b.elements[i], s)
      if (!s1) return null
      s = s1
    }
    return s
  }

  if (isEqExpr(a) && isEqExpr(b)) {
    const s1 = unify(a.left, b.left, subst)
    if (!s1) return null
    return unify(a.right, b.right, s1)
  }

  if (isNeqExpr(a) && isNeqExpr(b)) {
    const s1 = unify(a.left, b.left, subst)
    if (!s1) return null
    return unify(a.right, b.right, s1)
  }

  if (isDefExpr(a) && isDefExpr(b)) {
    const s1 = unify(a.name, b.name, subst)
    if (!s1) return null
    return unify(a.form, b.form, s1)
  }

  // Constants must be equal
  if (isInfinityExpr(a) && isInfinityExpr(b)) {
    return subst
  }

  if (isNumExpr(a) && isNumExpr(b) && a.value === b.value) {
    return subst
  }

  if (isBracketExpr(a) && isBracketExpr(b) && a.side === b.side) {
    return subst
  }

  return null
}

/** Check if name is a variable (lowercase single letter) */
function isVariable(name: string): boolean {
  return /^[a-z]$/.test(name)
}

/** Unify variable with term */
function unifyVar(varName: string, term: ASTNode, subst: Substitution): Substitution | null {
  // Check if already bound
  if (subst.has(varName)) {
    return unify(subst.get(varName)!, term, subst)
  }

  // Occurs check
  if (occursIn(varName, term)) {
    return null
  }

  // Bind variable
  const newSubst = new Map(subst)
  newSubst.set(varName, term)
  return newSubst
}

/** Check if variable occurs in term */
function occursIn(varName: string, term: ASTNode): boolean {
  if (isIdentExpr(term)) {
    return term.name === varName
  }

  if (isLinkExpr(term)) {
    return occursIn(varName, term.left) || occursIn(varName, term.right)
  }

  if (isMaleExpr(term) || isFemaleExpr(term) || isNotExpr(term)) {
    return occursIn(varName, term.operand)
  }

  if (isSetExpr(term)) {
    return term.elements.some(el => occursIn(varName, el))
  }

  if (isEqExpr(term) || isNeqExpr(term)) {
    return occursIn(varName, term.left) || occursIn(varName, term.right)
  }

  if (isDefExpr(term)) {
    return occursIn(varName, term.name) || occursIn(varName, term.form)
  }

  return false
}

/** Apply substitution to AST node */
export function applySubstitution(node: ASTNode, subst: Substitution): ASTNode {
  if (subst.size === 0) return node

  if (isIdentExpr(node)) {
    if (subst.has(node.name)) {
      return applySubstitution(subst.get(node.name)!, subst)
    }
    return node
  }

  if (isLinkExpr(node)) {
    return {
      ...node,
      left: applySubstitution(node.left, subst),
      right: applySubstitution(node.right, subst),
    }
  }

  if (isMaleExpr(node)) {
    return {
      ...node,
      operand: applySubstitution(node.operand, subst),
    }
  }

  if (isFemaleExpr(node)) {
    return {
      ...node,
      operand: applySubstitution(node.operand, subst),
    }
  }

  if (isNotExpr(node)) {
    return {
      ...node,
      operand: applySubstitution(node.operand, subst),
    }
  }

  if (isSetExpr(node)) {
    return {
      ...node,
      elements: node.elements.map(el => applySubstitution(el, subst)),
    }
  }

  if (isEqExpr(node)) {
    return {
      ...node,
      left: applySubstitution(node.left, subst),
      right: applySubstitution(node.right, subst),
    }
  }

  if (isNeqExpr(node)) {
    return {
      ...node,
      left: applySubstitution(node.left, subst),
      right: applySubstitution(node.right, subst),
    }
  }

  if (isDefExpr(node)) {
    return {
      ...node,
      name: applySubstitution(node.name, subst),
      form: applySubstitution(node.form, subst),
    }
  }

  return node
}

/**
 * Expand definitions in AST node
 */
export function expandDefinitions(node: ASTNode, state: ProverState): ASTNode {
  if (isIdentExpr(node)) {
    if (state.definitions.has(node.name)) {
      return expandDefinitions(state.definitions.get(node.name)!, state)
    }
    return node
  }

  if (isLinkExpr(node)) {
    return {
      ...node,
      left: expandDefinitions(node.left, state),
      right: expandDefinitions(node.right, state),
    }
  }

  if (isMaleExpr(node)) {
    return {
      ...node,
      operand: expandDefinitions(node.operand, state),
    }
  }

  if (isFemaleExpr(node)) {
    return {
      ...node,
      operand: expandDefinitions(node.operand, state),
    }
  }

  if (isNotExpr(node)) {
    return {
      ...node,
      operand: expandDefinitions(node.operand, state),
    }
  }

  if (isSetExpr(node)) {
    return {
      ...node,
      elements: node.elements.map(el => expandDefinitions(el, state)),
    }
  }

  if (isEqExpr(node)) {
    return {
      ...node,
      left: expandDefinitions(node.left, state),
      right: expandDefinitions(node.right, state),
    }
  }

  if (isNeqExpr(node)) {
    return {
      ...node,
      left: expandDefinitions(node.left, state),
      right: expandDefinitions(node.right, state),
    }
  }

  return node
}

/**
 * Apply axiom schema: ♂x : (♂x -> x)
 */
function applyMaleAxiom(node: ASTNode): ASTNode | null {
  if (isMaleExpr(node)) {
    const x = node.operand
    return {
      type: 'Link',
      left: node,
      right: x,
    } as LinkExpr
  }
  return null
}

/**
 * Apply axiom schema: x♀ : (x -> x♀)
 */
function applyFemaleAxiom(node: ASTNode): ASTNode | null {
  if (isFemaleExpr(node)) {
    const x = node.operand
    return {
      type: 'Link',
      left: x,
      right: node,
    } as LinkExpr
  }
  return null
}

/**
 * Generate hints for failed equality verification
 */
function generateEqualityHints(
  left: ASTNode,
  right: ASTNode,
  expLeft: ASTNode,
  expRight: ASTNode
): VerificationHint[] {
  const hints: VerificationHint[] = []

  // Check for structural differences
  if (left.type !== right.type) {
    hints.push({
      type: 'structural',
      message: `Разные типы выражений: ${left.type} ≠ ${right.type}`,
    })
  }

  // Check if one side is Male and the other is Female
  if (
    (isMaleExpr(expLeft) && isFemaleExpr(expRight)) ||
    (isFemaleExpr(expLeft) && isMaleExpr(expRight))
  ) {
    hints.push({
      type: 'suggestion',
      message: '♂ и ♀ операторы дуальны, но не взаимозаменяемы',
      relatedAxiom: 'A7',
    })
  }

  // Check if Male expression could use A5
  if (isMaleExpr(expLeft) || isMaleExpr(expRight)) {
    hints.push({
      type: 'axiom',
      message: 'Попробуйте применить аксиому А5: ♂x = (♂x → x)',
      relatedAxiom: 'A5',
    })
  }

  // Check if Female expression could use A6
  if (isFemaleExpr(expLeft) || isFemaleExpr(expRight)) {
    hints.push({
      type: 'axiom',
      message: 'Попробуйте применить аксиому А6: x♀ = (x → x♀)',
      relatedAxiom: 'A6',
    })
  }

  // Check if Infinity expression could use A4
  if (isInfinityExpr(expLeft) || isInfinityExpr(expRight)) {
    hints.push({
      type: 'axiom',
      message: 'Попробуйте применить аксиому А4: ∞ = (∞ → ∞)',
      relatedAxiom: 'A4',
    })
  }

  // Check for Link expressions
  if (isLinkExpr(expLeft) && isLinkExpr(expRight)) {
    hints.push({
      type: 'suggestion',
      message: 'Проверьте структуру связей: левая и правая части должны совпадать',
    })
  }

  // Generic hint if no specific hints were generated
  if (hints.length === 0) {
    hints.push({
      type: 'suggestion',
      message: 'Выражения имеют разную структуру и не могут быть унифицированы',
    })
  }

  return hints
}

/**
 * Check if equality holds using axioms and unification
 */
export function checkEquality(left: ASTNode, right: ASTNode, state: ProverState): ProofResult {
  // Normalize both sides
  const normLeft = normalize(left)
  const normRight = normalize(right)
  const proofSteps: ProofStep[] = []
  const appliedAxioms: AxiomInfo[] = []

  const leftStr = toCanonicalString(normLeft)
  const rightStr = toCanonicalString(normRight)

  proofSteps.push({
    index: 1,
    action: 'Нормализация выражений',
    before: `${toCanonicalString(left)} = ${toCanonicalString(right)}`,
    after: `${leftStr} = ${rightStr}`,
    details: 'Применены правила нормализации: !!x→x, !(♂x)→x♀, !(x♀)→♂x',
  })

  state.trace.push(`Checking: ${leftStr} = ${rightStr}`)

  // Direct structural equality
  if (astEqual(normLeft, normRight)) {
    appliedAxioms.push(AXIOMS.A1)
    proofSteps.push({
      index: 2,
      action: 'Структурное сравнение',
      details: 'Выражения идентичны после нормализации',
      axiom: AXIOMS.A1,
    })
    return {
      success: true,
      message: 'Структурное равенство (А1: тождественность)',
      steps: ['Direct structural comparison'],
      proofSteps,
      appliedAxioms,
    }
  }

  // Try expanding definitions
  const expLeft = expandDefinitions(normLeft, state)
  const expRight = expandDefinitions(normRight, state)
  const expLeftStr = toCanonicalString(expLeft)
  const expRightStr = toCanonicalString(expRight)

  if (leftStr !== expLeftStr || rightStr !== expRightStr) {
    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Раскрытие определений',
      before: `${leftStr} = ${rightStr}`,
      after: `${expLeftStr} = ${expRightStr}`,
      axiom: AXIOMS.A0,
      details: 'Применена аксиома А0: определения раскрываются по форме',
    })
    appliedAxioms.push(AXIOMS.A0)
  }

  state.trace.push(`After expansion: ${expLeftStr} = ${expRightStr}`)

  if (astEqual(expLeft, expRight)) {
    appliedAxioms.push(AXIOMS.A1)
    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Структурное сравнение после раскрытия',
      details: 'Выражения идентичны после раскрытия определений',
      axiom: AXIOMS.A1,
    })
    return {
      success: true,
      message: 'Равенство после раскрытия определений (А0, А1)',
      steps: ['Expanded definitions', 'Structural comparison'],
      proofSteps,
      appliedAxioms,
    }
  }

  // Try unification
  const subst = unify(expLeft, expRight)
  if (subst) {
    const substEntries = Array.from(subst.entries())
    const substStr = substEntries.map(([k, v]) => `${k} ↦ ${toCanonicalString(v)}`).join(', ')
    appliedAxioms.push(AXIOMS.A1)
    proofSteps.push({
      index: proofSteps.length + 1,
      action: 'Унификация',
      details: substStr ? `Подстановка: {${substStr}}` : 'Прямая унификация',
      axiom: AXIOMS.A1,
    })
    return {
      success: true,
      message: 'Унификация успешна (А1: тождественность)',
      steps: ['Unification'],
      proofSteps,
      appliedAxioms,
      substitution: subst,
    }
  }

  // Apply axiom schemas
  // ♂x = ♂x -> x
  if (isMaleExpr(expLeft)) {
    const maleExp = applyMaleAxiom(expLeft)
    if (maleExp && astEqual(maleExp, expRight)) {
      appliedAxioms.push(AXIOMS.A5)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А5',
        before: expLeftStr,
        after: toCanonicalString(maleExp),
        axiom: AXIOMS.A5,
        details: '♂x раскрывается как (♂x → x)',
      })
      return {
        success: true,
        message: 'Применена аксиома А5: ♂x = (♂x → x)',
        steps: ['♂x : (♂x -> x)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }
  if (isMaleExpr(expRight)) {
    const maleExp = applyMaleAxiom(expRight)
    if (maleExp && astEqual(expLeft, maleExp)) {
      appliedAxioms.push(AXIOMS.A5)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А5 (обратное)',
        before: expRightStr,
        after: toCanonicalString(maleExp),
        axiom: AXIOMS.A5,
        details: '♂x раскрывается как (♂x → x)',
      })
      return {
        success: true,
        message: 'Применена аксиома А5 (обратное направление)',
        steps: ['♂x : (♂x -> x)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }

  // x♀ = x -> x♀
  if (isFemaleExpr(expLeft)) {
    const femaleExp = applyFemaleAxiom(expLeft)
    if (femaleExp && astEqual(femaleExp, expRight)) {
      appliedAxioms.push(AXIOMS.A6)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А6',
        before: expLeftStr,
        after: toCanonicalString(femaleExp),
        axiom: AXIOMS.A6,
        details: 'x♀ раскрывается как (x → x♀)',
      })
      return {
        success: true,
        message: 'Применена аксиома А6: x♀ = (x → x♀)',
        steps: ['x♀ : (x -> x♀)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }
  if (isFemaleExpr(expRight)) {
    const femaleExp = applyFemaleAxiom(expRight)
    if (femaleExp && astEqual(expLeft, femaleExp)) {
      appliedAxioms.push(AXIOMS.A6)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А6 (обратное)',
        before: expRightStr,
        after: toCanonicalString(femaleExp),
        axiom: AXIOMS.A6,
        details: 'x♀ раскрывается как (x → x♀)',
      })
      return {
        success: true,
        message: 'Применена аксиома А6 (обратное направление)',
        steps: ['x♀ : (x -> x♀)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }

  // ∞ = ∞ -> ∞
  if (isInfinityExpr(expLeft)) {
    const infLink: LinkExpr = {
      type: 'Link',
      left: { type: 'Infinity' },
      right: { type: 'Infinity' },
    }
    if (astEqual(infLink, expRight)) {
      appliedAxioms.push(AXIOMS.A4)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А4',
        before: '∞',
        after: '(∞ → ∞)',
        axiom: AXIOMS.A4,
        details: '∞ (акорень) раскрывается как (∞ → ∞)',
      })
      return {
        success: true,
        message: 'Применена аксиома А4: ∞ = (∞ → ∞)',
        steps: ['∞ : (∞ -> ∞)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }
  if (isInfinityExpr(expRight)) {
    const infLink: LinkExpr = {
      type: 'Link',
      left: { type: 'Infinity' },
      right: { type: 'Infinity' },
    }
    if (astEqual(expLeft, infLink)) {
      appliedAxioms.push(AXIOMS.A4)
      proofSteps.push({
        index: proofSteps.length + 1,
        action: 'Применение аксиомы А4 (обратное)',
        before: '(∞ → ∞)',
        after: '∞',
        axiom: AXIOMS.A4,
        details: '(∞ → ∞) сворачивается в ∞ (акорень)',
      })
      return {
        success: true,
        message: 'Применена аксиома А4 (обратное направление)',
        steps: ['∞ : (∞ -> ∞)'],
        proofSteps,
        appliedAxioms,
      }
    }
  }

  // Generate hints for failed verification
  const hints = generateEqualityHints(left, right, expLeft, expRight)

  proofSteps.push({
    index: proofSteps.length + 1,
    action: 'Верификация не удалась',
    details: 'Не найдена последовательность аксиом для доказательства равенства',
  })

  return {
    success: false,
    message: 'Невозможно доказать равенство',
    steps: state.trace,
    proofSteps,
    appliedAxioms,
    hints,
  }
}

/**
 * Check if inequality holds
 */
export function checkInequality(left: ASTNode, right: ASTNode, state: ProverState): ProofResult {
  const eqResult = checkEquality(left, right, state)
  const proofSteps: ProofStep[] = []

  proofSteps.push({
    index: 1,
    action: 'Попытка доказать равенство',
    details: `Проверяем: ${toCanonicalString(left)} = ${toCanonicalString(right)}`,
  })

  if (!eqResult.success) {
    proofSteps.push({
      index: 2,
      action: 'Равенство не доказано',
      details: 'Не найдена последовательность аксиом для доказательства равенства',
    })
    proofSteps.push({
      index: 3,
      action: 'Неравенство выполняется',
      details: 'Если равенство не может быть доказано, неравенство считается истинным',
    })

    return {
      success: true,
      message: 'Неравенство выполняется (равенство не может быть доказано)',
      steps: ['Tried to prove equality', 'Failed', 'Therefore inequality holds'],
      proofSteps,
      appliedAxioms: [],
    }
  }

  proofSteps.push({
    index: 2,
    action: 'Равенство доказано',
    details: eqResult.message,
  })
  proofSteps.push({
    index: 3,
    action: 'Неравенство не выполняется',
    details: 'Поскольку равенство может быть доказано, неравенство ложно',
  })

  const hints: VerificationHint[] = [
    {
      type: 'suggestion',
      message: 'Выражения равны, поэтому неравенство не выполняется',
    },
  ]

  return {
    success: false,
    message: 'Неравенство не выполняется (равенство может быть доказано)',
    steps: eqResult.steps,
    proofSteps,
    appliedAxioms: eqResult.appliedAxioms,
    hints,
  }
}

/**
 * Verify a statement
 */
export function verify(node: ASTNode, state: ProverState): ProofResult {
  const normalized = normalize(node)

  if (isEqExpr(normalized)) {
    return checkEquality(normalized.left, normalized.right, state)
  }

  if (isNeqExpr(normalized)) {
    return checkInequality(normalized.left, normalized.right, state)
  }

  if (isDefExpr(normalized)) {
    // Add definition to state
    if (isIdentExpr(normalized.name)) {
      state.definitions.set(normalized.name.name, normalized.form)
      const proofSteps: ProofStep[] = [
        {
          index: 1,
          action: 'Регистрация определения',
          details: `${normalized.name.name} : ${toCanonicalString(normalized.form)}`,
          axiom: AXIOMS.A0,
        },
      ]
      return {
        success: true,
        message: `Добавлено определение: ${normalized.name.name}`,
        steps: ['Definition registered'],
        proofSteps,
        appliedAxioms: [AXIOMS.A0],
      }
    }
    const hints: VerificationHint[] = [
      {
        type: 'structural',
        message: 'Имя определения должно быть идентификатором',
      },
    ]
    return {
      success: false,
      message: 'Имя определения должно быть идентификатором',
      steps: [],
      proofSteps: [],
      appliedAxioms: [],
      hints,
    }
  }

  const hints: VerificationHint[] = [
    {
      type: 'suggestion',
      message: `Поддерживаемые типы выражений: равенство (=), неравенство (!=), определение (:)`,
    },
  ]

  return {
    success: false,
    message: `Невозможно верифицировать выражение типа: ${node.type}`,
    steps: [],
    proofSteps: [],
    appliedAxioms: [],
    hints,
  }
}

/**
 * Verify all statements in input
 * Note: Use parse() from parser.ts and verify() separately in browser
 */
export function verifyAll(_input: string): { results: ProofResult[]; state: ProverState } {
  // Import is handled by caller in browser context
  throw new Error('verifyAll not available - use parse() and verify() separately')
}
