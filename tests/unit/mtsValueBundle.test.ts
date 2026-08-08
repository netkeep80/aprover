import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { ASTNode, SetExpr, SequenceExpr } from '../../src/core/ast'
import { parseExpr } from '../../src/core/parser'
import { ExplicitMemoryView } from '../../src/core/memoryView'
import {
  BundleElaborationError,
  elaborateBundles,
  evaluateFlatValueBundle,
  expandBundleQuery,
  resolveCorpusForm,
  valuesEqual,
  type BundleValue,
  type ExpectedBundleRole,
  type LinkValue,
} from '../../src/core/valueBundle'

interface ElaborationCase {
  id: string
  source: string
  context?: string
  bundlePath?: number[]
  expectedRole: 'ConstraintBundle' | 'ValueBundle'
}

interface RejectionCase {
  id: string
  source: string
  context?: string
  error: string
}

interface EqualityCase {
  id: string
  left: string
  right: string
  symbols: Record<string, number>
  leftHoles: Record<string, number>
  rightHoles: Record<string, number>
  leftSet: number[]
  rightSet: number[]
  equal: boolean
}

interface CrossKindCase {
  id: string
  bundle: string
  scalar: string
  symbols: Record<string, number>
  bundleSet: number[]
  scalarIdentity: number
  equal: boolean
  notEqual: boolean
  context?: string
}

interface ExpansionCase {
  id: string
  source: string
  expectedLinks: number[]
}

interface Corpus {
  schema: string
  status: string
  contract: string
  accepted: boolean
  elaboration: ElaborationCase[]
  staticRejections: RejectionCase[]
  valueEquality: EqualityCase[]
  crossKindComparison: CrossKindCase[]
  expansionMemory: {
    links: Record<string, [number, number]>
    symbols: Record<string, number>
  }
  expansion: ExpansionCase[]
  veto: Record<string, boolean>
}

const corpus = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'contracts/anum_docs-v0.2/mts-value-bundle-conformance-v0.2.json'),
    'utf8'
  )
) as Corpus

function entryFor(context?: string): ExpectedBundleRole {
  if (context === 'constraint-entry') return 'constraint'
  if (context === 'form-required' || context === 'value-entry') return 'value'
  return 'none'
}

function samePath(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function setValue(
  source: string,
  symbols: Record<string, number>,
  holes: Record<string, number>
): BundleValue {
  const ast = parseExpr(source)
  expect(ast.type).toBe('Set')
  const set = ast as SetExpr
  const elaboration = elaborateBundles(set, set.elements.length === 0 ? 'value' : 'none')
  return evaluateFlatValueBundle(set, [], elaboration, (form, path) =>
    resolveCorpusForm(form, path, symbols, holes)
  )
}

describe('принятый корпус плоских пучков МТС v0.2', () => {
  it('потребляет именно принятый upstream-корпус', () => {
    expect(corpus.schema).toBe('mts-value-bundle-conformance/v0.2')
    expect(corpus.contract).toBe('mts-value-bundle/v0.2')
    expect(corpus.status).toBe('accepted')
    expect(corpus.accepted).toBe(true)
  })

  for (const testCase of corpus.elaboration) {
    it(`уточняет роль: ${testCase.id}`, () => {
      const ast = parseExpr(testCase.source)
      const elaboration = elaborateBundles(ast, entryFor(testCase.context))
      const path = testCase.bundlePath ?? []
      const actual = elaboration.roles.find(item => samePath(item.path, path))
      expect(actual?.role).toBe(testCase.expectedRole)
    })
  }

  for (const testCase of corpus.staticRejections) {
    it(`статически отвергает: ${testCase.id}`, () => {
      const ast = parseExpr(testCase.source)
      try {
        elaborateBundles(ast, entryFor(testCase.context))
        throw new Error('ожидалась статическая ошибка пучка')
      } catch (error) {
        expect(error).toBeInstanceOf(BundleElaborationError)
        expect((error as BundleElaborationError).code).toBe(testCase.error)
      }
    })
  }

  for (const testCase of corpus.valueEquality) {
    it(`сравнивает после разрешения: ${testCase.id}`, () => {
      const left = setValue(testCase.left, testCase.symbols, testCase.leftHoles)
      const right = setValue(testCase.right, testCase.symbols, testCase.rightHoles)

      expect(left.identities).toEqual(testCase.leftSet)
      expect(right.identities).toEqual(testCase.rightSet)
      expect(valuesEqual(left, right)).toBe(testCase.equal)
    })
  }

  for (const testCase of corpus.crossKindComparison) {
    it(`не смешивает пучок и одиночную связь: ${testCase.id}`, () => {
      const bundle = setValue(testCase.bundle, testCase.symbols, {})
      const scalar: LinkValue = { kind: 'link', identity: testCase.scalarIdentity }
      expect(bundle.identities).toEqual(testCase.bundleSet)
      expect(valuesEqual(bundle, scalar)).toBe(testCase.equal)
      expect(!valuesEqual(bundle, scalar)).toBe(testCase.notEqual)
    })
  }

  it('выполняет всё раскрытие только через существующие связи', () => {
    const links = Object.entries(corpus.expansionMemory.links).map(([id, poles]) => ({
      id: Number(id),
      start: poles[0],
      end: poles[1],
    }))
    const memory = new ExplicitMemoryView(links)
    const before = memory.entries()

    for (const testCase of corpus.expansion) {
      const ast = parseExpr(testCase.source)
      expect(ast.type).toBe('Sequence')
      const sequence = ast as SequenceExpr
      const elaboration = elaborateBundles(sequence)
      const value = expandBundleQuery(
        sequence,
        [],
        elaboration,
        (form: ASTNode, path) =>
          resolveCorpusForm(form, path, corpus.expansionMemory.symbols, {}),
        memory
      )
      expect(value.identities, testCase.id).toEqual(testCase.expectedLinks)
      expect(memory.entries(), `${testCase.id}: память должна остаться неизменной`).toEqual(before)
    }
  })

  it('сохраняет запреты на скрытые расширения семантики', () => {
    expect(corpus.veto.rootDefinitionsChanged).toBe(false)
    expect(corpus.veto.constraintBundleBehaviorChanged).toBe(false)
    expect(corpus.veto.deduplicateSourceOccurrences).toBe(false)
    expect(corpus.veto.nestedValueBundleAccepted).toBe(false)
    expect(corpus.veto.bundleValuedDefinitionAccepted).toBe(false)
    expect(corpus.veto.scalarOperatorLiftingAccepted).toBe(false)
    expect(corpus.veto.interpretMayRealize).toBe(false)
    expect(corpus.veto.interpretMayDelete).toBe(false)
    expect(corpus.veto.globalRewrite).toBe(false)
  })
})

describe('соположение в единственном parser МТС', () => {
  it('разбирает двухполюсные формы раскрытия как Sequence', () => {
    expect(parseExpr('a{b,c}').type).toBe('Sequence')
    expect(parseExpr('{a,b}c').type).toBe('Sequence')
    expect(parseExpr('{a,b}{c,d}').type).toBe('Sequence')
    expect(parseExpr('{}{}').type).toBe('Sequence')
  })

  it('даёт соположению больший приоритет, чем ⟼', () => {
    const ast = parseExpr('a{b,c} ⟼ z') as ASTNode & { left: ASTNode }
    expect(ast.type).toBe('Link')
    expect(ast.left.type).toBe('Sequence')
  })
})
