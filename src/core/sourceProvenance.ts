/**
 * Source coordinates for parser/editor provenance.
 *
 * These coordinates describe source occurrences only. They never participate
 * in SyntaxAset occurrence identity, semantic Link identity, proof identity,
 * or accepted MTS semantics.
 */
export interface SourcePoint {
  line: number
  column: number
  offset: number
}

export interface SourceLocation {
  start: SourcePoint
  end: SourcePoint
}
