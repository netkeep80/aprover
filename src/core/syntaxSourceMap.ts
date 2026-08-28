import type { LinkHandle } from '@mts/core'
import type { SourceLocation } from './sourceProvenance'
import type { SyntaxAsetParseResult } from './syntaxAsetDirectEmitter'

export interface SyntaxSourceSelection {
  readonly occurrence: LinkHandle
  readonly location: SourceLocation
}

function sourceSelections(syntax: SyntaxAsetParseResult): SyntaxSourceSelection[] {
  const selections: SyntaxSourceSelection[] = []
  for (const node of syntax.read.occurrences) {
    const location = syntax.provenance.get(node.occurrence)
    if (location !== undefined) selections.push({ occurrence: node.occurrence, location })
  }
  return selections
}

function spanSize(location: SourceLocation): number {
  return location.end.offset - location.start.offset
}

/**
 * Presentation-only cursor lookup. Nested syntax occurrences are resolved to
 * the smallest containing source span. Equal-span ties retain SyntaxAset reader
 * order only to keep the UI deterministic; neither order nor source offsets are
 * semantic/proof identity.
 */
export function selectSyntaxOccurrenceAtOffset(
  syntax: SyntaxAsetParseResult,
  offset: number
): SyntaxSourceSelection | null {
  let selected: SyntaxSourceSelection | null = null

  for (const candidate of sourceSelections(syntax)) {
    const { location } = candidate
    if (location.start.offset > offset || offset >= location.end.offset) continue
    if (selected === null || spanSize(location) < spanSize(selected.location)) selected = candidate
  }

  return selected
}

/** Revalidate a legacy/presentation span against canonical SyntaxAset provenance. */
export function selectSyntaxOccurrenceBySourceSpan(
  syntax: SyntaxAsetParseResult,
  sourceSpan: SourceLocation
): SyntaxSourceSelection | null {
  for (const candidate of sourceSelections(syntax)) {
    if (
      candidate.location.start.offset === sourceSpan.start.offset &&
      candidate.location.end.offset === sourceSpan.end.offset
    ) {
      return candidate
    }
  }
  return null
}

/** Ordinary editor status derived from SyntaxAset, never from the legacy AST sidecar. */
export function countSyntaxStatements(syntax: SyntaxAsetParseResult): number {
  return syntax.read.occurrences.filter(
    occurrence => occurrence.kind === syntax.vocabulary.kinds.Statement
  ).length
}
