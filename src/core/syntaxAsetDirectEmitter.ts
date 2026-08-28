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
import type { SourceLocation } from './sourceProvenance'

export interface SyntaxAsetParseResult {
  readonly memory: Memory
  readonly vocabulary: SyntaxAsetToolingVocabulary
  readonly aset: LinkHandle
  readonly read: SyntaxAsetRead
  readonly provenance: ReadonlyMap<LinkHandle, SourceLocation>
}

/**
 * Online A2 emitter used by the existing parser while grammar productions are
 * reduced. It never walks a completed AST: child occurrences are emitted by
 * the grammar before their parent and are looked up only to wire parent roles.
 */
export class SyntaxAsetDirectEmitter {
  readonly memory = new Memory()
  readonly vocabulary: SyntaxAsetToolingVocabulary
  readonly provenance = new Map<LinkHandle, SourceLocation>()

  private readonly builder: SyntaxAsetBuilder
  private readonly occurrences = new WeakMap<ASTNode, LinkHandle>()
  private readonly carrierScope: LinkHandle
  private readonly zero: LinkHandle
  private readonly one: LinkHandle
  private readonly textScope: LinkHandle
  private readonly encoder = new TextEncoder()

  constructor() {
    const vocabularySeed = this.memory.ensureEndSelfClosed(this.memory.root)
    this.vocabulary = materializeSyntaxAsetVocabulary(this.memory, vocabularySeed)
    this.builder = new SyntaxAsetBuilder(this.memory, this.vocabulary)
    this.carrierScope = this.memory.ensureEndSelfClosed(this.vocabulary.tag)
    this.zero = this.memory.ensureStartSelfClosed(this.carrierScope)
    this.one = this.memory.ensureEndSelfClosed(this.carrierScope)
    this.textScope = this.memory.ensure(this.carrierScope, this.one)
  }

  private encodeTextCarrier(value: string): LinkHandle {
    let cursor = this.textScope
    for (const byte of this.encoder.encode(value)) {
      let encodedByte = this.carrierScope
      for (let bit = 7; bit >= 0; bit -= 1) {
        encodedByte = this.memory.ensure(
          encodedByte,
          (byte & (1 << bit)) === 0 ? this.zero : this.one
        )
      }
      cursor = this.memory.ensure(cursor, encodedByte)
    }
    return this.memory.ensureStartSelfClosed(cursor)
  }

  private child(node: ASTNode): LinkHandle {
    const occurrence = this.occurrences.get(node)
    if (occurrence === undefined) throw new Error(`SyntaxAset child not emitted: ${node.type}`)
    return occurrence
  }

  private add(
    node: ASTNode,
    kind: LinkHandle,
    fields: readonly { role: LinkHandle; value: LinkHandle }[]
  ): void {
    const occurrence = this.builder.addOccurrence(kind, fields)
    this.occurrences.set(node, occurrence)
    if (node.loc !== undefined) this.provenance.set(occurrence, node.loc)
  }

  private literal(node: ASTNode, tag: string, value: string): void {
    this.add(node, this.vocabulary.kinds.Literal, [
      {
        role: this.vocabulary.roles.value,
        value: this.encodeTextCarrier(`${tag}\u0000${value}`),
      },
    ])
  }

  emit(node: ASTNode): void {
    switch (node.type) {
      case 'File': {
        const file = node as File
        this.add(
          node,
          this.vocabulary.kinds.File,
          file.statements.map(statement => ({
            role: this.vocabulary.roles.item,
            value: this.child(statement),
          }))
        )
        return
      }
      case 'Statement': {
        const statement = node as Statement
        this.add(node, this.vocabulary.kinds.Statement, [
          { role: this.vocabulary.roles.expression, value: this.child(statement.expr) },
        ])
        return
      }
      case 'Link': {
        const link = node as LinkExpr
        this.add(node, this.vocabulary.kinds.Link, [
          { role: this.vocabulary.roles.start, value: this.child(link.left) },
          { role: this.vocabulary.roles.end, value: this.child(link.right) },
        ])
        return
      }
      case 'Definition': {
        const definition = node as DefExpr
        this.add(node, this.vocabulary.kinds.Definition, [
          { role: this.vocabulary.roles.name, value: this.child(definition.name) },
          { role: this.vocabulary.roles.body, value: this.child(definition.form) },
        ])
        return
      }
      case 'Equality': {
        const equality = node as EqExpr
        this.add(node, this.vocabulary.kinds.Equality, [
          { role: this.vocabulary.roles.left, value: this.child(equality.left) },
          { role: this.vocabulary.roles.right, value: this.child(equality.right) },
        ])
        return
      }
      case 'Inequality': {
        const inequality = node as NeqExpr
        this.add(node, this.vocabulary.kinds.Inequality, [
          { role: this.vocabulary.roles.left, value: this.child(inequality.left) },
          { role: this.vocabulary.roles.right, value: this.child(inequality.right) },
        ])
        return
      }
      case 'Sequence': {
        const sequence = node as SequenceExpr
        this.add(
          node,
          this.vocabulary.kinds.Sequence,
          sequence.items.map(item => ({
            role: this.vocabulary.roles.item,
            value: this.child(item),
          }))
        )
        return
      }
      case 'Set': {
        const set = node as SetExpr
        this.add(
          node,
          this.vocabulary.kinds.Set,
          set.elements.map(item => ({
            role: this.vocabulary.roles.item,
            value: this.child(item),
          }))
        )
        return
      }
      case 'Round': {
        const round = node as RoundExpr
        this.add(
          node,
          this.vocabulary.kinds.Round,
          round.content === null
            ? []
            : [{ role: this.vocabulary.roles.expression, value: this.child(round.content) }]
        )
        return
      }
      case 'Square': {
        const square = node as SquareExpr
        this.add(
          node,
          this.vocabulary.kinds.Square,
          square.content === null
            ? []
            : [{ role: this.vocabulary.roles.expression, value: this.child(square.content) }]
        )
        return
      }
      case 'Not':
      case 'Female':
      case 'Male': {
        const unary = node as NotExpr | FemaleExpr | MaleExpr
        const kind =
          node.type === 'Not'
            ? this.vocabulary.kinds.Not
            : node.type === 'Female'
              ? this.vocabulary.kinds.Female
              : this.vocabulary.kinds.Male
        this.add(node, kind, [
          { role: this.vocabulary.roles.operand, value: this.child(unary.operand) },
        ])
        return
      }
      case 'ContextPronoun': {
        const pronoun = node as ContextPronounExpr
        this.add(node, this.vocabulary.kinds.ContextPronoun, [
          {
            role: this.vocabulary.roles.value,
            value: this.encodeTextCarrier(
              `ContextPronoun\u0000${pronoun.pole}\u0000${pronoun.up}`
            ),
          },
        ])
        return
      }
      case 'Infinity':
        this.literal(node, 'Infinity', '∞')
        return
      case 'Num':
        this.literal(node, 'Num', String((node as NumExpr).value))
        return
      case 'Identifier':
        this.literal(node, 'Identifier', (node as IdentExpr).name)
        return
      case 'AbitLit':
        this.literal(node, 'AbitLit', (node as AbitLitExpr).value)
        return
      case 'StringLit':
        this.literal(node, 'StringLit', (node as StringLitExpr).value)
        return
      case 'Literal':
        this.literal(node, 'Literal', (node as LiteralExpr).value)
        return
      default:
        throw new Error(`Unsupported parser node in direct SyntaxAset emitter: ${node.type}`)
    }
  }

  finish(file: File): SyntaxAsetParseResult {
    const root = this.child(file)
    const aset = this.builder.finish(root)
    const read = readSyntaxAset(this.memory, aset, this.vocabulary)
    return Object.freeze({
      memory: this.memory,
      vocabulary: this.vocabulary,
      aset,
      read,
      provenance: this.provenance,
    })
  }
}