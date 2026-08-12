/**
 * Current raw/channel stack engine for accepted dual-input ANUM deserialization.
 *
 * Normative behavior is pinned from `anum_docs` as
 * `anum-deserialization/v0.4`. Carrier input is decoded separately and delegates here. The operation is pure: semantic Link
 * identity is determined only by ordered poles; source positions, stack
 * frames and runtime objects are not Link identities. No MemoryView or
 * materialization API is reachable from this module.
 */

export const ANUM_DESERIALIZATION_SCHEMA = 'anum-deserialization/v0.4' as const

export type AnumStreamOperation = 'OPEN' | 'CLOSE' | 'VALUE'
export type AnumResolvedValue = 'L' | 'U'
export type SemanticLinkExpression = string

export interface AnumStreamDenotation {
  readonly kind: 'semantic-link'
  readonly raw: string
  readonly result: SemanticLinkExpression
  readonly resolvedValues: readonly AnumResolvedValue[]
  readonly operations: readonly AnumStreamOperation[]
  readonly maxDepth: number
}

export type AnumStreamErrorCode = 'unexpected-close' | 'unclosed-open' | 'non-abit'

export class AnumStreamDeserializationError extends Error {
  constructor(
    readonly code: AnumStreamErrorCode,
    readonly offset: number,
    readonly token?: string
  ) {
    super(
      `ANUM stream error ${code} at position ${offset}${token === undefined ? '' : `: ${JSON.stringify(token)}`}`
    )
    this.name = 'AnumStreamDeserializationError'
  }
}

interface Frame {
  started: boolean
  current: SemanticLinkExpression
}

const ROOT_LINKS: Readonly<Record<string, SemanticLinkExpression>> = {
  'R\u0000R': 'R',
  'O\u0000R': 'O',
  'R\u0000C': 'C',
  'O\u0000C': 'L',
  'C\u0000O': 'U',
}

/** Canonical semantic constructor by ordered poles. */
export function semanticLink(
  start: SemanticLinkExpression,
  end: SemanticLinkExpression
): SemanticLinkExpression {
  return ROOT_LINKS[`${start}\u0000${end}`] ?? `(${start}⟼${end})`
}

function appendValue(frame: Frame, value: SemanticLinkExpression): void {
  if (!frame.started) {
    frame.current = value
    frame.started = true
    return
  }
  frame.current = semanticLink(frame.current, value)
}

/**
 * Execute the accepted v0.4 raw/channel stack machine.
 *
 * - root frame and every nested frame start at R;
 * - `1` resolves to the one canonical L, `0` to the one canonical U;
 * - empty `[]` returns R;
 * - non-empty close returns Link(R, inner);
 * - returned nested result is one VALUE in the parent;
 * - no operation here reads or writes memory.
 */
export function deserializeAnumStream(raw: string): AnumStreamDenotation {
  const frames: Frame[] = [{ started: false, current: 'R' }]
  const operations: AnumStreamOperation[] = []
  const resolvedValues: AnumResolvedValue[] = []
  let maxDepth = 0

  for (let offset = 0; offset < raw.length; offset++) {
    const token = raw[offset]

    if (token === '[') {
      frames.push({ started: false, current: 'R' })
      maxDepth = Math.max(maxDepth, frames.length - 1)
      operations.push('OPEN')
      continue
    }

    if (token === ']') {
      if (frames.length === 1) {
        throw new AnumStreamDeserializationError('unexpected-close', offset, token)
      }
      const inner = frames.pop()!
      const returned = inner.started ? semanticLink('R', inner.current) : 'R'
      appendValue(frames[frames.length - 1], returned)
      operations.push('CLOSE')
      continue
    }

    if (token === '1' || token === '0') {
      const value: AnumResolvedValue = token === '1' ? 'L' : 'U'
      resolvedValues.push(value)
      appendValue(frames[frames.length - 1], value)
      operations.push('VALUE')
      continue
    }

    throw new AnumStreamDeserializationError('non-abit', offset, token)
  }

  if (frames.length !== 1) {
    throw new AnumStreamDeserializationError('unclosed-open', raw.length)
  }

  const root = frames[0]
  return {
    kind: 'semantic-link',
    raw,
    result: root.started ? root.current : 'R',
    resolvedValues,
    operations,
    maxDepth,
  }
}
