import type { InterpretationResult, OccurrencePath } from './interpreter'

export interface InterpretationSubstitutionView {
  readonly occurrence: string
  readonly link: string
}

export interface InterpretationAliasView {
  readonly occurrence: string
  readonly target: string
}

export interface InterpretationPresentation {
  readonly status: 'matched' | 'not-matched'
  readonly substitutions: readonly InterpretationSubstitutionView[]
  readonly aliases: readonly InterpretationAliasView[]
  readonly trace: readonly string[]
}

/** Human-readable structural occurrence label. Empty path denotes the expression root. */
export function formatOccurrencePath(path: OccurrencePath): string {
  return path.length === 0 ? 'root' : path.join('.')
}

/**
 * Convert the canonical interpreter result into immutable UI data.
 *
 * This module intentionally performs no interpretation, matching, memory lookup,
 * or mutation. It is only the presentation boundary for an already-computed result.
 */
export function presentInterpretation(result: InterpretationResult): InterpretationPresentation {
  return {
    status: result.success ? 'matched' : 'not-matched',
    substitutions: result.substitutions.map(item => ({
      occurrence: formatOccurrencePath(item.path),
      link: String(item.link),
    })),
    aliases: result.aliases.map(item => ({
      occurrence: formatOccurrencePath(item.path),
      target: formatOccurrencePath(item.targetPath),
    })),
    trace: [...result.trace],
  }
}
