/**
 * Source coordinates for parser/editor provenance.
 *
 * These coordinates describe source occurrences only. They never participate
 * in SyntaxAset occurrence identity, semantic Link identity, proof identity,
 * or accepted MTS semantics.
 */
export interface SourceLocation {
  start: { line: number; column: number; offset: number }
  end: { line: number; column: number; offset: number }
}
