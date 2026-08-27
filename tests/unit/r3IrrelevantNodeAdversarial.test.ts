import { describe, expect, it } from 'vitest'
import {
  Memory,
  createStructuralProofProducer,
  ensureRootBasis,
  exportPortableStructuralDerivation,
  type LinkHandle,
  type StructuralDerivationNodeEvidence,
} from '@mts/core'

interface Fixture {
  readonly memory: Memory
  readonly theory: LinkHandle
  readonly producer: ReturnType<typeof createStructuralProofProducer>
  readonly interpreter: LinkHandle
  readonly dictionary: LinkHandle
  readonly grammar: LinkHandle
  readonly role: LinkHandle
  readonly roleDictionary: LinkHandle
  readonly claim: LinkHandle
  readonly fresh: () => LinkHandle
}

function fixture(): Fixture {
  const memory = new Memory()
  const { R, U } = ensureRootBasis(memory)
  let cursor = U
  const fresh = (): LinkHandle => (cursor = memory.ensure(cursor, R))
  const dictionary = fresh()
  const grammar = fresh()
  const theory = fresh()
  const role = fresh()
  const claim = fresh()
  const producer = createStructuralProofProducer(memory)
  const interpreter = producer.defineInterpreter(dictionary, grammar, theory)
  const roleDictionary = producer.defineRoleDictionary([role])
  return {
    memory,
    theory,
    producer,
    interpreter,
    dictionary,
    grammar,
    role,
    roleDictionary,
    claim,
    fresh,
  }
}

function node(
  fx: Fixture,
  premiseOccurrences: readonly LinkHandle[],
): StructuralDerivationNodeEvidence {
  const context = fx.producer.defineContext(fx.fresh(), fx.fresh())
  const rule = fx.producer.defineRule(fx.roleDictionary, fx.role)
  const act = fx.producer.defineAct(fx.interpreter, fx.roleDictionary, context)
  fx.producer.defineActField(act, fx.role, fx.claim)
  const occurrence = fx.producer.defineProofOccurrence(act, fx.claim)
  const derivationRule = fx.producer.defineDerivationRule(
    rule,
    premiseOccurrences.map(() => fx.role),
  )
  return {
    occurrence,
    judgment: {
      application: {
        act,
        rule,
        ruleAdmission: fx.producer.admitRule(fx.theory, rule),
        claimedBody: fx.claim,
        expectedInterpreter: {
          dictionary: fx.dictionary,
          grammar: fx.grammar,
          theory: fx.theory,
        },
        expectedAfterContext: context,
      },
      judgment: { theory: fx.theory, context, claim: fx.claim },
    },
    derivationRule,
    derivationRuleAdmission: fx.producer.admitDerivationRule(fx.theory, derivationRule),
    premiseOccurrenceSequence: fx.producer.definePremiseOccurrenceSequence(premiseOccurrences),
  }
}

describe('R3 irrelevant-node adversarial readiness', () => {
  it('fails closed before approval when a valid node is outside the target dependency closure', () => {
    const fx = fixture()
    const premise = node(fx, [])
    const target = node(fx, [premise.occurrence])
    const irrelevant: StructuralDerivationNodeEvidence = {
      ...premise,
      occurrence: fx.producer.defineProofOccurrence(premise.judgment.application.act, fx.claim),
    }

    expect(() =>
      exportPortableStructuralDerivation(fx.memory, {
        theory: fx.theory,
        targetOccurrence: target.occurrence,
        nodes: [premise, irrelevant, target],
      }),
    ).toThrowError('noncanonical-node-order')
  })
})
