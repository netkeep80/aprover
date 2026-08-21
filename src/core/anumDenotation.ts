import {
  StreamError,
  deserializeStream,
  symbolicStackAlgebra,
  type StackOperation,
} from '@mts/core'

/**
 * Historical transport tag kept for presentation/backward compatibility only.
 * Current semantic authority is the exact-pinned accepted @mts/core v0.10 package.
 */
export const ANUM_DESERIALIZATION_SCHEMA = 'anum-deserialization/v0.4' as const

export type AnumStreamOperation = StackOperation
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

/** Compatibility helper; semantic construction is owned by @mts/core. */
export function semanticLink(
  start: SemanticLinkExpression,
  end: SemanticLinkExpression
): SemanticLinkExpression {
  return symbolicStackAlgebra.link(start, end)
}

function maxPresentationDepth(raw: string): number {
  let depth = 0
  let maxDepth = 0
  for (const token of raw) {
    if (token === '[') {
      depth += 1
      maxDepth = Math.max(maxDepth, depth)
    } else if (token === ']') {
      depth -= 1
    }
  }
  return maxDepth
}

/**
 * Reconstruct only presentation diagnostics after @mts/core has rejected input.
 * This pass cannot accept input and therefore has no semantic authority.
 */
function locateRejectedInput(raw: string, code: AnumStreamErrorCode): { offset: number; token?: string } {
  if (code === 'non-abit') {
    for (let offset = 0; offset < raw.length; offset++) {
      const token = raw[offset]
      if (token !== '[' && token !== ']' && token !== '1' && token !== '0') return { offset, token }
    }
    return { offset: raw.length }
  }

  if (code === 'unexpected-close') {
    let depth = 0
    for (let offset = 0; offset < raw.length; offset++) {
      const token = raw[offset]
      if (token === '[') depth += 1
      else if (token === ']') {
        if (depth === 0) return { offset, token }
        depth -= 1
      }
    }
  }

  return { offset: raw.length }
}

function asResolvedValues(values: readonly string[]): readonly AnumResolvedValue[] {
  return values.map(value => {
    if (value !== 'L' && value !== 'U') {
      throw new Error(`@mts/core symbolic ANUM algebra returned unexpected value ${JSON.stringify(value)}`)
    }
    return value
  })
}

/**
 * Execute raw ANUM through the accepted @mts/core public boundary.
 *
 * aprover only adds presentation fields (`raw`, `maxDepth`) and preserves its
 * historical error shape. Link construction, stack transitions and denotation
 * are not implemented locally.
 */
export function deserializeAnumStream(raw: string): AnumStreamDenotation {
  try {
    const upstream = deserializeStream(raw, symbolicStackAlgebra)
    return {
      kind: 'semantic-link',
      raw,
      result: upstream.denotation,
      resolvedValues: asResolvedValues(upstream.resolvedValues),
      operations: upstream.operations,
      maxDepth: maxPresentationDepth(raw),
    }
  } catch (cause) {
    if (cause instanceof StreamError) {
      const diagnostic = locateRejectedInput(raw, cause.code)
      throw new AnumStreamDeserializationError(cause.code, diagnostic.offset, diagnostic.token)
    }
    throw cause
  }
}
