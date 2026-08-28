import { Memory, type LinkHandle } from '@mts/core'
import {
  SyntaxAsetBuilder,
  materializeSyntaxAsetVocabulary,
  readSyntaxAset,
  type SyntaxAsetRead,
  type SyntaxAsetToolingVocabulary,
} from '@mts/core/tooling/syntax-aset'
import type {
  ASTNode,
  AbitLitExpr,
  ContextPronounExpr,
  DefExpr,
  EqExpr,
  File,
  IdentExpr,
  LinkExpr,
  LiteralExpr,
  MaleExpr,
  FemaleExpr,
  NeqExpr,
  NotExpr,
  NumExpr,
  RoundExpr,
  SequenceExpr,
  SetExpr,
  SquareExpr,
  Statement,
  StringLitExpr,
} from './ast'
import { parse } from './parser'
import type { SourceLocation } from './sourceProvenance'

export interface SyntaxAsetOracleResult {
  readonly memory: Memory
  readonly vocabulary: SyntaxAsetToolingVocabulary
  readonly aset: LinkHandle
  readonly read: SyntaxAsetRead
  readonly provenance: ReadonlyMap<LinkHandle, SourceLocation>
}

/**
 * Transitional A1 migration oracle only.
 *
 * Delete this bridge once the direct parser -> SyntaxAset path is
 * differential-equivalent on the supported corpus. Source coordinates remain
 * external provenance and never participate in Link identity.
 */
export function buildSyntaxAsetOracle(source: string): SyntaxAsetOracleResult {
  const file = parse(source)
  const memory = new Memory()
  const vocabularySeed = memory.ensureEndSelfClosed(memory.root)
  const vocabulary = materializeSyntaxAsetVocabulary(memory, vocabularySeed)
  const builder = new SyntaxAsetBuilder(memory, vocabulary)
  const provenance = new Map<LinkHandle, SourceLocation>()

  const carrierScope = memory.ensureEndSelfClosed(vocabulary.tag)
  const zero = memory.ensureStartSelfClosed(carrierScope)
  const one = memory.ensureEndSelfClosed(carrierScope)
  const textScope = memory.ensure(carrierScope, one)
  const encoder = new TextEncoder()

  const encodeTextCarrier = (value: string): LinkHandle => {
    let cursor = textScope
    for (const byte of encoder.encode(value)) {
      let encodedByte = carrierScope
      for (let bit = 7; bit >= 0; bit -= 1) {
        encodedByte = memory.ensure(encodedByte, (byte & (1 << bit)) === 0 ? zero : one)
      }
      cursor = memory.ensure(cursor, encodedByte)
    }
    return memory.ensureStartSelfClosed(cursor)
  }

  const add = (
    kind: LinkHandle,
    fields: readonly { role: LinkHandle; value: LinkHandle }[],
    loc?: SourceLocation
  ): LinkHandle => {
    const occurrence = builder.addOccurrence(kind, fields)
    if (loc !== undefined) provenance.set(occurrence, loc)
    return occurrence
  }

  const literal = (tag: string, value: string, loc?: SourceLocation): LinkHandle =>
    add(
      vocabulary.kinds.Literal,
      [{ role: vocabulary.roles.value, value: encodeTextCarrier(`${tag}\u0000${value}`) }],
      loc
    )

  const visit = (node: ASTNode): LinkHandle => {
    switch (node.type) {
      case 'File': {
        const fileNode = node as File
        return add(
          vocabulary.kinds.File,
          fileNode.statements.map((statement) => ({
            role: vocabulary.roles.item,
            value: visit(statement),
          })),
          node.loc
        )
      }
      case 'Statement': {
        const statement = node as Statement
        return add(
          vocabulary.kinds.Statement,
          [{ role: vocabulary.roles.expression, value: visit(statement.expr) }],
          node.loc
        )
      }
      case 'Link': {
        const link = node as LinkExpr
        const start = visit(link.left)
        const end = visit(link.right)
        return add(
          vocabulary.kinds.Link,
          [
            { role: vocabulary.roles.start, value: start },
            { role: vocabulary.roles.end, value: end },
          ],
          node.loc
        )
      }
      case 'Definition': {
        const definition = node as DefExpr
        const name = visit(definition.name)
        const body = visit(definition.form)
        return add(
          vocabulary.kinds.Definition,
          [
            { role: vocabulary.roles.name, value: name },
            { role: vocabulary.roles.body, value: body },
          ],
          node.loc
        )
      }
      case 'Equality': {
        const equality = node as EqExpr
        const left = visit(equality.left)
        const right = visit(equality.right)
        return add(
          vocabulary.kinds.Equality,
          [
            { role: vocabulary.roles.left, value: left },
            { role: vocabulary.roles.right, value: right },
          ],
          node.loc
        )
      }
      case 'Inequality': {
        const inequality = node as NeqExpr
        const left = visit(inequality.left)
        const right = visit(inequality.right)
        return add(
          vocabulary.kinds.Inequality,
          [
            { role: vocabulary.roles.left, value: left },
            { role: vocabulary.roles.right, value: right },
          ],
          node.loc
        )
      }
      case 'Sequence': {
        const sequence = node as SequenceExpr
        return add(
          vocabulary.kinds.Sequence,
          sequence.items.map((item) => ({ role: vocabulary.roles.item, value: visit(item) })),
          node.loc
        )
      }
      case 'Set': {
        const set = node as SetExpr
        return add(
          vocabulary.kinds.Set,
          set.elements.map((item) => ({ role: vocabulary.roles.item, value: visit(item) })),
          node.loc
        )
      }
      case 'Round': {
        const round = node as RoundExpr
        const fields =
          round.content === null
            ? []
            : [{ role: vocabulary.roles.expression, value: visit(round.content) }]
        return add(vocabulary.kinds.Round, fields, node.loc)
      }
      case 'Square': {
        const square = node as SquareExpr
        const fields =
          square.content === null
            ? []
            : [{ role: vocabulary.roles.expression, value: visit(square.content) }]
        return add(vocabulary.kinds.Square, fields, node.loc)
      }
      case 'Not':
      case 'Female':
      case 'Male': {
        const unary = node as NotExpr | FemaleExpr | MaleExpr
        const operand = visit(unary.operand)
        const kind =
          node.type === 'Not'
            ? vocabulary.kinds.Not
            : node.type === 'Female'
              ? vocabulary.kinds.Female
              : vocabulary.kinds.Male
        return add(kind, [{ role: vocabulary.roles.operand, value: operand }], node.loc)
      }
      case 'ContextPronoun': {
        const pronoun = node as ContextPronounExpr
        return add(
          vocabulary.kinds.ContextPronoun,
          [
            {
              role: vocabulary.roles.value,
              value: encodeTextCarrier(`ContextPronoun\u0000${pronoun.pole}\u0000${pronoun.up}`),
            },
          ],
          node.loc
        )
      }
      case 'Infinity':
        return literal('Infinity', '∞', node.loc)
      case 'Num': {
        const number = node as NumExpr
        return literal('Num', String(number.value), node.loc)
      }
      case 'Identifier': {
        const identifier = node as IdentExpr
        return literal('Identifier', identifier.name, node.loc)
      }
      case 'AbitLit': {
        const abit = node as AbitLitExpr
        return literal('AbitLit', abit.value, node.loc)
      }
      case 'StringLit': {
        const string = node as StringLitExpr
        return literal('StringLit', string.value, node.loc)
      }
      case 'Literal': {
        const operator = node as LiteralExpr
        return literal('Literal', operator.value, node.loc)
      }
      default:
        throw new Error(`Unsupported AST node in SyntaxAset oracle: ${node.type}`)
    }
  }

  const root = visit(file)
  const aset = builder.finish(root)
  const read = readSyntaxAset(memory, aset, vocabulary)

  return Object.freeze({
    memory,
    vocabulary,
    aset,
    read,
    provenance,
  })
}
