import { Memory, type LinkHandle } from '@mts/core'
import {
  SyntaxAsetBuilder,
  materializeSyntaxAsetVocabulary,
  readSyntaxAset,
  type SyntaxAsetRead,
  type SyntaxAsetToolingVocabulary,
} from '@mts/core/tooling/syntax-aset'
import type { SourceLocation } from './sourceProvenance'

export interface SyntaxAsetParseResult {
  readonly memory: Memory
  readonly vocabulary: SyntaxAsetToolingVocabulary
  readonly aset: LinkHandle
  readonly read: SyntaxAsetRead
  readonly provenance: ReadonlyMap<LinkHandle, SourceLocation>
}

/**
 * Temporary parser/emitter plumbing only. This reference is deliberately
 * opaque: it carries no syntax kind, child graph, semantic identity or proof
 * identity beyond the occurrence handle needed to wire the parent production.
 */
export interface SyntaxAsetReductionRef {
  readonly occurrence: LinkHandle
  readonly loc: SourceLocation
}

type UnaryProduction = 'Not' | 'Female' | 'Male'
type BinaryProduction = 'Link' | 'Definition' | 'Equality' | 'Inequality'
type ContainerProduction = 'Round' | 'Square'
type LiteralTag = 'Infinity' | 'Num' | 'Identifier' | 'AbitLit' | 'StringLit' | 'Literal'

/**
 * Online A2 emitter used by the parser while grammar productions are reduced.
 * Parent occurrences consume only already-emitted child occurrence handles;
 * no completed syntax-domain object graph is constructed or retained.
 */
export class SyntaxAsetDirectEmitter {
  readonly memory = new Memory()
  readonly vocabulary: SyntaxAsetToolingVocabulary
  readonly provenance = new Map<LinkHandle, SourceLocation>()

  private readonly builder: SyntaxAsetBuilder
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

  private add(
    kind: LinkHandle,
    fields: readonly { role: LinkHandle; value: LinkHandle }[],
    loc: SourceLocation
  ): SyntaxAsetReductionRef {
    const occurrence = this.builder.addOccurrence(kind, fields)
    this.provenance.set(occurrence, loc)
    return Object.freeze({ occurrence, loc })
  }

  emitLiteral(
    tag: LiteralTag,
    value: string,
    loc: SourceLocation
  ): SyntaxAsetReductionRef {
    return this.add(
      this.vocabulary.kinds.Literal,
      [
        {
          role: this.vocabulary.roles.value,
          value: this.encodeTextCarrier(`${tag}\u0000${value}`),
        },
      ],
      loc
    )
  }

  emitContextPronoun(
    pole: 'start' | 'end',
    up: number,
    loc: SourceLocation
  ): SyntaxAsetReductionRef {
    return this.add(
      this.vocabulary.kinds.ContextPronoun,
      [
        {
          role: this.vocabulary.roles.value,
          value: this.encodeTextCarrier(`ContextPronoun\u0000${pole}\u0000${up}`),
        },
      ],
      loc
    )
  }

  emitUnary(
    production: UnaryProduction,
    operand: SyntaxAsetReductionRef,
    loc: SourceLocation
  ): SyntaxAsetReductionRef {
    const kind =
      production === 'Not'
        ? this.vocabulary.kinds.Not
        : production === 'Female'
          ? this.vocabulary.kinds.Female
          : this.vocabulary.kinds.Male

    return this.add(
      kind,
      [{ role: this.vocabulary.roles.operand, value: operand.occurrence }],
      loc
    )
  }

  emitBinary(
    production: BinaryProduction,
    left: SyntaxAsetReductionRef,
    right: SyntaxAsetReductionRef,
    loc: SourceLocation
  ): SyntaxAsetReductionRef {
    const kinds = this.vocabulary.kinds
    const roles = this.vocabulary.roles

    if (production === 'Link') {
      return this.add(
        kinds.Link,
        [
          { role: roles.start, value: left.occurrence },
          { role: roles.end, value: right.occurrence },
        ],
        loc
      )
    }

    if (production === 'Definition') {
      return this.add(
        kinds.Definition,
        [
          { role: roles.name, value: left.occurrence },
          { role: roles.body, value: right.occurrence },
        ],
        loc
      )
    }

    const kind = production === 'Equality' ? kinds.Equality : kinds.Inequality
    return this.add(
      kind,
      [
        { role: roles.left, value: left.occurrence },
        { role: roles.right, value: right.occurrence },
      ],
      loc
    )
  }

  emitSequence(
    items: readonly SyntaxAsetReductionRef[],
    loc: SourceLocation
  ): SyntaxAsetReductionRef {
    return this.add(
      this.vocabulary.kinds.Sequence,
      items.map((item) => ({
        role: this.vocabulary.roles.item,
        value: item.occurrence,
      })),
      loc
    )
  }

  emitSet(
    items: readonly SyntaxAsetReductionRef[],
    loc: SourceLocation
  ): SyntaxAsetReductionRef {
    return this.add(
      this.vocabulary.kinds.Set,
      items.map((item) => ({
        role: this.vocabulary.roles.item,
        value: item.occurrence,
      })),
      loc
    )
  }

  emitContainer(
    production: ContainerProduction,
    content: SyntaxAsetReductionRef | null,
    loc: SourceLocation
  ): SyntaxAsetReductionRef {
    return this.add(
      production === 'Round' ? this.vocabulary.kinds.Round : this.vocabulary.kinds.Square,
      content === null
        ? []
        : [{ role: this.vocabulary.roles.expression, value: content.occurrence }],
      loc
    )
  }

  emitStatement(
    expression: SyntaxAsetReductionRef,
    loc: SourceLocation
  ): SyntaxAsetReductionRef {
    return this.add(
      this.vocabulary.kinds.Statement,
      [{ role: this.vocabulary.roles.expression, value: expression.occurrence }],
      loc
    )
  }

  finish(
    statements: readonly SyntaxAsetReductionRef[],
    fileLoc: SourceLocation
  ): SyntaxAsetParseResult {
    const file = this.add(
      this.vocabulary.kinds.File,
      statements.map((statement) => ({
        role: this.vocabulary.roles.item,
        value: statement.occurrence,
      })),
      fileLoc
    )
    const aset = this.builder.finish(file.occurrence)
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
