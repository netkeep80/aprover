import { describe, expect, it } from 'vitest'

import {
  environmentAt,
  parseCanonicalExpression,
  parseOpeningTarget,
  verifyDefinitionOpeningPath,
  type DefinitionScopeSnapshot,
  type OpeningPathEdge,
} from '../../src/core/definitionOpeningPath'

function scopes(definitions: readonly string[]): DefinitionScopeSnapshot[] {
  return [{ path: [], parent: null, definitions }]
}

function edge(target: string, ordinal: number, body: string): OpeningPathEdge {
  return {
    target: parseOpeningTarget(target),
    definitionId: { scopePath: [], ordinal },
    body: parseCanonicalExpression(body, 'edge.body'),
  }
}

function verify(
  definitions: readonly string[],
  startTarget: string,
  edges: readonly OpeningPathEdge[],
  finalBody: string
) {
  const snapshot = scopes(definitions)
  return verifyDefinitionOpeningPath(
    {
      startTarget: parseOpeningTarget(startTarget),
      edges,
      finalBody: parseCanonicalExpression(finalBody, 'finalBody'),
    },
    environmentAt(snapshot, [])
  )
}

describe('DefinitionOpeningPath canonical verifier', () => {
  it('accepts one and two exact opening edges', () => {
    expect(verify(['a : b'], 'a', [edge('a', 0, 'b')], 'b')).toEqual({ accepted: true })
    expect(
      verify(['a : b', 'b : c'], 'a', [edge('a', 0, 'b'), edge('b', 1, 'c')], 'c')
    ).toEqual({ accepted: true })
  })

  it('accepts the finite canonical self-cycle witness', () => {
    expect(verify(['a : a'], 'a', [edge('a', 0, 'a')], 'a')).toEqual({ accepted: true })
  })

  it('accepts the finite canonical mutual-cycle witness', () => {
    expect(
      verify(['a : b', 'b : a'], 'a', [edge('a', 0, 'b'), edge('b', 1, 'a')], 'a')
    ).toEqual({ accepted: true })
  })

  it('rejects a repeated DefinitionId instead of looping', () => {
    const result = verify(
      ['a : b', 'b : a'],
      'a',
      [edge('a', 0, 'b'), edge('b', 1, 'a'), edge('a', 0, 'b')],
      'b'
    )
    expect(result).toEqual({ accepted: false, failure: 'repeated-definition-id' })
  })

  it('allows a non-Form final body but cannot continue through it', () => {
    expect(verify(['a : b = c'], 'a', [edge('a', 0, 'b = c')], 'b = c')).toEqual({
      accepted: true,
    })

    const result = verify(
      ['a : b = c', 'x : y'],
      'a',
      [edge('a', 0, 'b = c'), edge('x', 1, 'y')],
      'y'
    )
    expect(result).toEqual({ accepted: false, failure: 'previous-body-not-form' })
  })

  it('does not confuse non-addressable Form with non-Form', () => {
    const result = verify(
      ['a : {◁ = x}'],
      'a',
      [
        edge('a', 0, '{◁ = x}'),
        {
          target: parseOpeningTarget('{ ◁ = x }'),
          definitionId: { scopePath: [], ordinal: 1 },
          body: parseCanonicalExpression('z', 'edge.body'),
        },
      ],
      'z'
    )
    expect(result).toEqual({ accepted: false, failure: 'opening-not-match' })
  })

  it('rejects forged DefinitionId, body and final body', () => {
    expect(verify(['a : b'], 'a', [edge('a', 9, 'b')], 'b')).toEqual({
      accepted: false,
      failure: 'definition-id-mismatch',
    })
    expect(verify(['a : b'], 'a', [edge('a', 0, 'c')], 'c')).toEqual({
      accepted: false,
      failure: 'body-mismatch',
    })
    expect(verify(['a : b'], 'a', [edge('a', 0, 'b')], 'c')).toEqual({
      accepted: false,
      failure: 'final-body-mismatch',
    })
  })
})
