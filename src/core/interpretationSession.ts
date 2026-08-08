import type { ASTNode } from './ast'
import {
  interpretConstraints,
  type ContextFrame,
  type InterpretationResult,
  type LinkRef,
} from './interpreter'
import { ExplicitMemoryView, type DistinguishedLink } from './memoryView'

export interface InterpretationSessionConfig {
  readonly context: ContextFrame
  readonly symbols?: Readonly<Record<string, LinkRef>>
  readonly links: readonly DistinguishedLink[]
}

/**
 * Application boundary around canonical MTS v0.2 interpretation.
 *
 * The session owns only immutable input state: an explicit read-only memory
 * snapshot, a context frame and symbol bindings. It exposes no realize/delete
 * operations, so UI code cannot accidentally turn interpretation into memory
 * mutation.
 */
export class InterpretationSession {
  readonly context: ContextFrame
  readonly symbols: Readonly<Record<string, LinkRef>>
  readonly memory: ExplicitMemoryView

  constructor(config: InterpretationSessionConfig) {
    this.context = config.context
    this.symbols = Object.freeze({ ...(config.symbols ?? {}) })
    this.memory = new ExplicitMemoryView(config.links)
  }

  interpret(expression: ASTNode): InterpretationResult {
    return interpretConstraints(expression, this.context, this.memory, this.symbols)
  }

  /** Stable diagnostic snapshot for UI/tests; interpretation never changes it. */
  memorySnapshot(): ReturnType<ExplicitMemoryView['entries']> {
    return this.memory.entries()
  }
}
