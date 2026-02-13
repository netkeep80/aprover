/**
 * Prover kernel for МТС (Meta-Theory of Links)
 *
 * The prover implements a minimal kernel based on:
 * - Modus Ponens: if P and (P -> Q) then Q
 * - Structural unification for equality checking
 * - Built-in axioms from МТС v0.1
 */

import type {
  ASTNode, LinkExpr, DefExpr, EqExpr, NeqExpr,
  MaleExpr, FemaleExpr, NotExpr, SetExpr, InfinityExpr,
  NumExpr, IdentExpr
} from './ast';
import {
  isLinkExpr, isDefExpr, isEqExpr, isNeqExpr,
  isMaleExpr, isFemaleExpr, isNotExpr, isSetExpr,
  isInfinityExpr, isNumExpr, isIdentExpr, isBracketExpr
} from './ast';
import { parseExpr } from './parser';
import { normalize, toCanonicalString, astEqual } from './normalizer';

/** Substitution: maps variable names to AST nodes */
export type Substitution = Map<string, ASTNode>;

/** Proof result */
export interface ProofResult {
  success: boolean;
  message: string;
  steps?: string[];
  substitution?: Substitution;
}

/** Prover state */
export interface ProverState {
  /** Built-in axioms as (P -> Q) links */
  axioms: ASTNode[];
  /** User-defined definitions: s : F */
  definitions: Map<string, ASTNode>;
  /** Proven facts (canonical string form) */
  facts: Set<string>;
  /** Proof trace for debugging */
  trace: string[];
}

/**
 * Create initial prover state with built-in axioms
 */
export function createProverState(): ProverState {
  const state: ProverState = {
    axioms: [],
    definitions: new Map(),
    facts: new Set(),
    trace: []
  };

  // Add built-in axioms from МТС v0.1

  // А0. Definition: (s : F) -> (s = F)
  // This is a meta-axiom, handled specially

  // А1. Identity reflexivity: x = x
  state.facts.add('(x=x)');

  // А4. Смысл (акорень): ∞ : (∞ -> ∞)
  state.definitions.set('∞', parseAndNormalize('∞ -> ∞'));

  // А5. Самозамыкание начала: ♂x : (♂x -> x)
  // Schema: for any x, ♂x = (♂x -> x)

  // А6. Самозамыкание конца: x♀ : (x -> x♀)
  // Schema: for any x, x♀ = (x -> x♀)

  // А7. Инверсия: various rules
  // !(a -> b) = (b -> a) - handled by normalizer
  // !!x = x - handled by normalizer
  // !∞ = ∞
  addAxiomEq(state, '!∞', '∞');

  // А8. Единица смысла: 1 : (♂∞ -> ∞♀)
  state.definitions.set('1', parseAndNormalize('♂∞ -> ∞♀'));

  // А9. Нуль смысла: 0 : !1
  state.definitions.set('0', parseAndNormalize('!1'));

  // А10. Абиты
  state.definitions.set('[', parseAndNormalize('♂∞'));
  state.definitions.set(']', parseAndNormalize('∞♀'));

  // А11. Левоассоциативность: (a -> b -> c) = ((a -> b) -> c)
  // This is built into the parser

  return state;
}

/** Helper to parse and normalize expression */
function parseAndNormalize(input: string): ASTNode {
  return normalize(parseExpr(input));
}

/** Helper to add equality axiom */
function addAxiomEq(state: ProverState, left: string, right: string): void {
  const l = parseAndNormalize(left);
  const r = parseAndNormalize(right);
  const eq: EqExpr = {
    type: 'Equality',
    left: l,
    right: r
  };
  state.facts.add(toCanonicalString(eq));
}

/**
 * Try to unify two AST nodes
 * Returns substitution if successful, null if failed
 */
export function unify(a: ASTNode, b: ASTNode, subst: Substitution = new Map()): Substitution | null {
  // Apply existing substitutions
  a = applySubstitution(a, subst);
  b = applySubstitution(b, subst);

  // Identical nodes
  if (toCanonicalString(a) === toCanonicalString(b)) {
    return subst;
  }

  // Variable unification
  if (isIdentExpr(a) && isVariable(a.name)) {
    return unifyVar(a.name, b, subst);
  }
  if (isIdentExpr(b) && isVariable(b.name)) {
    return unifyVar(b.name, a, subst);
  }

  // Structural unification
  if (isLinkExpr(a) && isLinkExpr(b)) {
    const s1 = unify(a.left, b.left, subst);
    if (!s1) return null;
    return unify(a.right, b.right, s1);
  }

  if (isMaleExpr(a) && isMaleExpr(b)) {
    return unify(a.operand, b.operand, subst);
  }

  if (isFemaleExpr(a) && isFemaleExpr(b)) {
    return unify(a.operand, b.operand, subst);
  }

  if (isNotExpr(a) && isNotExpr(b)) {
    return unify(a.operand, b.operand, subst);
  }

  if (isSetExpr(a) && isSetExpr(b)) {
    if (a.elements.length !== b.elements.length) return null;
    let s = subst;
    for (let i = 0; i < a.elements.length; i++) {
      const s1 = unify(a.elements[i], b.elements[i], s);
      if (!s1) return null;
      s = s1;
    }
    return s;
  }

  if (isEqExpr(a) && isEqExpr(b)) {
    const s1 = unify(a.left, b.left, subst);
    if (!s1) return null;
    return unify(a.right, b.right, s1);
  }

  if (isNeqExpr(a) && isNeqExpr(b)) {
    const s1 = unify(a.left, b.left, subst);
    if (!s1) return null;
    return unify(a.right, b.right, s1);
  }

  if (isDefExpr(a) && isDefExpr(b)) {
    const s1 = unify(a.name, b.name, subst);
    if (!s1) return null;
    return unify(a.form, b.form, s1);
  }

  // Constants must be equal
  if (isInfinityExpr(a) && isInfinityExpr(b)) {
    return subst;
  }

  if (isNumExpr(a) && isNumExpr(b) && a.value === b.value) {
    return subst;
  }

  if (isBracketExpr(a) && isBracketExpr(b) && a.side === b.side) {
    return subst;
  }

  return null;
}

/** Check if name is a variable (lowercase single letter) */
function isVariable(name: string): boolean {
  return /^[a-z]$/.test(name);
}

/** Unify variable with term */
function unifyVar(varName: string, term: ASTNode, subst: Substitution): Substitution | null {
  // Check if already bound
  if (subst.has(varName)) {
    return unify(subst.get(varName)!, term, subst);
  }

  // Occurs check
  if (occursIn(varName, term)) {
    return null;
  }

  // Bind variable
  const newSubst = new Map(subst);
  newSubst.set(varName, term);
  return newSubst;
}

/** Check if variable occurs in term */
function occursIn(varName: string, term: ASTNode): boolean {
  if (isIdentExpr(term)) {
    return term.name === varName;
  }

  if (isLinkExpr(term)) {
    return occursIn(varName, term.left) || occursIn(varName, term.right);
  }

  if (isMaleExpr(term) || isFemaleExpr(term) || isNotExpr(term)) {
    return occursIn(varName, term.operand);
  }

  if (isSetExpr(term)) {
    return term.elements.some(el => occursIn(varName, el));
  }

  if (isEqExpr(term) || isNeqExpr(term)) {
    return occursIn(varName, term.left) || occursIn(varName, term.right);
  }

  if (isDefExpr(term)) {
    return occursIn(varName, term.name) || occursIn(varName, term.form);
  }

  return false;
}

/** Apply substitution to AST node */
export function applySubstitution(node: ASTNode, subst: Substitution): ASTNode {
  if (subst.size === 0) return node;

  if (isIdentExpr(node)) {
    if (subst.has(node.name)) {
      return applySubstitution(subst.get(node.name)!, subst);
    }
    return node;
  }

  if (isLinkExpr(node)) {
    return {
      ...node,
      left: applySubstitution(node.left, subst),
      right: applySubstitution(node.right, subst)
    };
  }

  if (isMaleExpr(node)) {
    return {
      ...node,
      operand: applySubstitution(node.operand, subst)
    };
  }

  if (isFemaleExpr(node)) {
    return {
      ...node,
      operand: applySubstitution(node.operand, subst)
    };
  }

  if (isNotExpr(node)) {
    return {
      ...node,
      operand: applySubstitution(node.operand, subst)
    };
  }

  if (isSetExpr(node)) {
    return {
      ...node,
      elements: node.elements.map(el => applySubstitution(el, subst))
    };
  }

  if (isEqExpr(node)) {
    return {
      ...node,
      left: applySubstitution(node.left, subst),
      right: applySubstitution(node.right, subst)
    };
  }

  if (isNeqExpr(node)) {
    return {
      ...node,
      left: applySubstitution(node.left, subst),
      right: applySubstitution(node.right, subst)
    };
  }

  if (isDefExpr(node)) {
    return {
      ...node,
      name: applySubstitution(node.name, subst),
      form: applySubstitution(node.form, subst)
    };
  }

  return node;
}

/**
 * Expand definitions in AST node
 */
export function expandDefinitions(node: ASTNode, state: ProverState): ASTNode {
  if (isIdentExpr(node)) {
    if (state.definitions.has(node.name)) {
      return expandDefinitions(state.definitions.get(node.name)!, state);
    }
    return node;
  }

  if (isLinkExpr(node)) {
    return {
      ...node,
      left: expandDefinitions(node.left, state),
      right: expandDefinitions(node.right, state)
    };
  }

  if (isMaleExpr(node)) {
    return {
      ...node,
      operand: expandDefinitions(node.operand, state)
    };
  }

  if (isFemaleExpr(node)) {
    return {
      ...node,
      operand: expandDefinitions(node.operand, state)
    };
  }

  if (isNotExpr(node)) {
    return {
      ...node,
      operand: expandDefinitions(node.operand, state)
    };
  }

  if (isSetExpr(node)) {
    return {
      ...node,
      elements: node.elements.map(el => expandDefinitions(el, state))
    };
  }

  if (isEqExpr(node)) {
    return {
      ...node,
      left: expandDefinitions(node.left, state),
      right: expandDefinitions(node.right, state)
    };
  }

  if (isNeqExpr(node)) {
    return {
      ...node,
      left: expandDefinitions(node.left, state),
      right: expandDefinitions(node.right, state)
    };
  }

  return node;
}

/**
 * Apply axiom schema: ♂x : (♂x -> x)
 */
function applyMaleAxiom(node: ASTNode): ASTNode | null {
  if (isMaleExpr(node)) {
    const x = node.operand;
    return {
      type: 'Link',
      left: node,
      right: x
    } as LinkExpr;
  }
  return null;
}

/**
 * Apply axiom schema: x♀ : (x -> x♀)
 */
function applyFemaleAxiom(node: ASTNode): ASTNode | null {
  if (isFemaleExpr(node)) {
    const x = node.operand;
    return {
      type: 'Link',
      left: x,
      right: node
    } as LinkExpr;
  }
  return null;
}

/**
 * Check if equality holds using axioms and unification
 */
export function checkEquality(left: ASTNode, right: ASTNode, state: ProverState): ProofResult {
  // Normalize both sides
  const normLeft = normalize(left);
  const normRight = normalize(right);

  state.trace.push(`Checking: ${toCanonicalString(normLeft)} = ${toCanonicalString(normRight)}`);

  // Direct structural equality
  if (astEqual(normLeft, normRight)) {
    return {
      success: true,
      message: 'Structural equality',
      steps: ['Direct structural comparison']
    };
  }

  // Try expanding definitions
  const expLeft = expandDefinitions(normLeft, state);
  const expRight = expandDefinitions(normRight, state);

  state.trace.push(`After expansion: ${toCanonicalString(expLeft)} = ${toCanonicalString(expRight)}`);

  if (astEqual(expLeft, expRight)) {
    return {
      success: true,
      message: 'Equal after definition expansion',
      steps: ['Expanded definitions', 'Structural comparison']
    };
  }

  // Try unification
  const subst = unify(expLeft, expRight);
  if (subst) {
    return {
      success: true,
      message: 'Unification successful',
      steps: ['Unification'],
      substitution: subst
    };
  }

  // Apply axiom schemas
  // ♂x = ♂x -> x
  if (isMaleExpr(expLeft)) {
    const maleExp = applyMaleAxiom(expLeft);
    if (maleExp && astEqual(maleExp, expRight)) {
      return {
        success: true,
        message: 'Applied ♂ axiom',
        steps: ['♂x : (♂x -> x)']
      };
    }
  }
  if (isMaleExpr(expRight)) {
    const maleExp = applyMaleAxiom(expRight);
    if (maleExp && astEqual(expLeft, maleExp)) {
      return {
        success: true,
        message: 'Applied ♂ axiom (reversed)',
        steps: ['♂x : (♂x -> x)']
      };
    }
  }

  // x♀ = x -> x♀
  if (isFemaleExpr(expLeft)) {
    const femaleExp = applyFemaleAxiom(expLeft);
    if (femaleExp && astEqual(femaleExp, expRight)) {
      return {
        success: true,
        message: 'Applied ♀ axiom',
        steps: ['x♀ : (x -> x♀)']
      };
    }
  }
  if (isFemaleExpr(expRight)) {
    const femaleExp = applyFemaleAxiom(expRight);
    if (femaleExp && astEqual(expLeft, femaleExp)) {
      return {
        success: true,
        message: 'Applied ♀ axiom (reversed)',
        steps: ['x♀ : (x -> x♀)']
      };
    }
  }

  // ∞ = ∞ -> ∞
  if (isInfinityExpr(expLeft)) {
    const infLink: LinkExpr = {
      type: 'Link',
      left: { type: 'Infinity' },
      right: { type: 'Infinity' }
    };
    if (astEqual(infLink, expRight)) {
      return {
        success: true,
        message: 'Applied ∞ axiom',
        steps: ['∞ : (∞ -> ∞)']
      };
    }
  }
  if (isInfinityExpr(expRight)) {
    const infLink: LinkExpr = {
      type: 'Link',
      left: { type: 'Infinity' },
      right: { type: 'Infinity' }
    };
    if (astEqual(expLeft, infLink)) {
      return {
        success: true,
        message: 'Applied ∞ axiom (reversed)',
        steps: ['∞ : (∞ -> ∞)']
      };
    }
  }

  return {
    success: false,
    message: 'Cannot prove equality',
    steps: state.trace
  };
}

/**
 * Check if inequality holds
 */
export function checkInequality(left: ASTNode, right: ASTNode, state: ProverState): ProofResult {
  const eqResult = checkEquality(left, right, state);

  if (!eqResult.success) {
    return {
      success: true,
      message: 'Inequality holds (equality cannot be proven)',
      steps: ['Tried to prove equality', 'Failed', 'Therefore inequality holds']
    };
  }

  return {
    success: false,
    message: 'Inequality does not hold (equality can be proven)',
    steps: eqResult.steps
  };
}

/**
 * Verify a statement
 */
export function verify(node: ASTNode, state: ProverState): ProofResult {
  const normalized = normalize(node);

  if (isEqExpr(normalized)) {
    return checkEquality(normalized.left, normalized.right, state);
  }

  if (isNeqExpr(normalized)) {
    return checkInequality(normalized.left, normalized.right, state);
  }

  if (isDefExpr(normalized)) {
    // Add definition to state
    if (isIdentExpr(normalized.name)) {
      state.definitions.set(normalized.name.name, normalized.form);
      return {
        success: true,
        message: `Added definition: ${normalized.name.name}`,
        steps: ['Definition registered']
      };
    }
    return {
      success: false,
      message: 'Definition name must be an identifier',
      steps: []
    };
  }

  return {
    success: false,
    message: `Cannot verify node of type: ${node.type}`,
    steps: []
  };
}

/**
 * Verify all statements in input
 * Note: Use parse() from parser.ts and verify() separately in browser
 */
export function verifyAll(input: string): { results: ProofResult[]; state: ProverState } {
  // Import is handled by caller in browser context
  throw new Error('verifyAll not available - use parse() and verify() separately');
}
