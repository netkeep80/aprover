import type { LinkRef, MemoryView } from './interpreter'
import { deserializeAnumStream, type AnumStreamDenotation } from './anumDenotation'

export type AnumCarrierErrorCode = 'invalid-vocabulary' | 'not-rooted-sequence' | 'non-abit'

export class AnumCarrierInputError extends Error {
  constructor(readonly code: AnumCarrierErrorCode) {
    super(`ANUM carrier error ${code}`)
    this.name = 'AnumCarrierInputError'
  }
}

export interface AnumCarrierVocabulary {
  readonly root: LinkRef
  readonly opening: LinkRef
  readonly closing: LinkRef
  readonly linked: LinkRef
  readonly unlinked: LinkRef
}

function samePoles(actual: readonly [LinkRef, LinkRef], start: LinkRef, end: LinkRef): boolean {
  return actual[0] === start && actual[1] === end
}

function validateVocabulary(memory: MemoryView, vocabulary: AnumCarrierVocabulary): void {
  const refs = [
    vocabulary.root,
    vocabulary.opening,
    vocabulary.closing,
    vocabulary.linked,
    vocabulary.unlinked,
  ]
  if (new Set(refs).size !== 5) throw new AnumCarrierInputError('invalid-vocabulary')

  const expected: readonly (readonly [LinkRef, LinkRef, LinkRef])[] = [
    [vocabulary.root, vocabulary.root, vocabulary.root],
    [vocabulary.opening, vocabulary.opening, vocabulary.root],
    [vocabulary.closing, vocabulary.root, vocabulary.closing],
    [vocabulary.linked, vocabulary.opening, vocabulary.closing],
    [vocabulary.unlinked, vocabulary.closing, vocabulary.opening],
  ]

  try {
    for (const [ref, start, end] of expected) {
      if (!samePoles(memory.poles(ref), start, end)) {
        throw new AnumCarrierInputError('invalid-vocabulary')
      }
    }
  } catch (cause) {
    if (cause instanceof AnumCarrierInputError) throw cause
    throw new AnumCarrierInputError('invalid-vocabulary')
  }
}

/**
 * Read an explicitly selected existing Link as one finite R-rooted sequence.
 *
 * The carrier role is explicit. Equality with a root vocabulary link never
 * implies singleton semantics: the selected Link is always unfolded through
 * start poles until R. No find/materialize operation is used.
 */
export function decodeAnumCarrier(
  memory: MemoryView,
  carrier: LinkRef,
  vocabulary: AnumCarrierVocabulary
): string {
  validateVocabulary(memory, vocabulary)

  const reversed: LinkRef[] = []
  const visited = new Set<LinkRef>()
  let current = carrier

  while (current !== vocabulary.root) {
    if (visited.has(current)) throw new AnumCarrierInputError('not-rooted-sequence')
    visited.add(current)
    try {
      const [start, end] = memory.poles(current)
      reversed.push(end)
      current = start
    } catch {
      throw new AnumCarrierInputError('not-rooted-sequence')
    }
  }

  const tokens = new Map<LinkRef, string>([
    [vocabulary.opening, '['],
    [vocabulary.closing, ']'],
    [vocabulary.linked, '1'],
    [vocabulary.unlinked, '0'],
  ])

  const forward = reversed.reverse()
  return forward
    .map(ref => {
      const token = tokens.get(ref)
      if (token === undefined) throw new AnumCarrierInputError('non-abit')
      return token
    })
    .join('')
}

export function deserializeAnumCarrier(
  memory: MemoryView,
  carrier: LinkRef,
  vocabulary: AnumCarrierVocabulary
): AnumStreamDenotation {
  return deserializeAnumStream(decodeAnumCarrier(memory, carrier, vocabulary))
}
