# aprover API

`aprover` is an application/library consumer of the canonical MTS v0.2 contracts published by [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs). This document describes application APIs only; it does not define MTS theory.

## Canonical source

```ts
import { parse, parseExpr, parseWithRecovery, toCanonicalString } from '../src/core/index'

const file = parse('∞ : {◁ = ∞, ▷ = ∞}')
const expression = parseExpr('[] = ◁')
console.log(toCanonicalString(expression))

const recovered = parseWithRecovery('[] = ◁')
console.log(recovered.file, recovered.error)
```

The parser consumes the v0.2 surface, including atomic `◁`/`▷`, separate `↑`, occurrence-local `[]`, `♀F` and `F♂`. The rejected projection grammar `♂F / F♀` is not a compatibility language.

## Contextual interpretation

```ts
import { InterpretationSession, parseExpr } from '../src/core/index'

const session = new InterpretationSession({
  context: { start: 10, end: 12 },
  symbols: { x: 30 },
  links: [{ id: 30, start: 2, end: 3 }],
})

const result = session.interpret(parseExpr('[] = ◁'))
```

`InterpretationSession` owns an immutable `ExplicitMemoryView`. Interpretation cannot `realize` or delete links.

`InterpretationResult` contains:

```ts
interface InterpretationResult {
  success: boolean
  substitutions: readonly { path: readonly number[]; link: number }[]
  aliases: readonly { path: readonly number[]; targetPath: readonly number[] }[]
  trace: readonly string[]
}
```

Occurrence paths, not display labels, identify anonymous forms.

## Trusted proof replay

The current proof contract is candidate `mts-proof/v0.2`. The only trusted rule is `interpret` replay.

```ts
import {
  MTS_CONTRACT_VERSION,
  MTS_PROOF_SCHEMA,
  checkProof,
  type MtsProofObjectV02,
} from '../src/core/index'

const proof: MtsProofObjectV02 = {
  schema: MTS_PROOF_SCHEMA,
  contractVersion: MTS_CONTRACT_VERSION,
  steps: [
    {
      rule: 'interpret',
      expression: '[] = ◁',
      context: { start: 10, end: 12 },
      expected: {
        success: true,
        substitutions: [{ path: [0], link: 10 }],
        aliases: [],
      },
    },
  ],
}

console.log(checkProof(proof)) // true
```

The checker independently parses the expression, reconstructs immutable distinguished memory and replays the canonical interpreter. It rejects unknown rules, wrong contract versions, forged substitutions/aliases and claims requiring implicit materialization.

The following historical aprover mechanisms are intentionally **not** trusted MTS v0.2 APIs and were removed in Phase E:

```text
A0-A11 built-in axiom table
lowercase single-letter metavariables
global textual substitution
global equality rewrite
symmetry / transitivity / congruence as implicit rules
Modus Ponens
legacy interactive proof strategy
legacy proof cache / metrics / export path
```

Future proof search belongs above `checkProof`; search output must be replayed by the independent checker.

## Memory view

```ts
import { ExplicitMemoryView } from '../src/core/index'

const memory = new ExplicitMemoryView([
  { id: 30, start: 2, end: 3 },
])

memory.poles(30)          // [2, 3]
memory.findLink(2, 3)    // 30
```

Duplicate IDs and ambiguous `(start,end) -> LinkRef` identities are rejected.

## Interpretation presentation

```ts
import { presentInterpretation } from '../src/core/index'

const presentation = presentInterpretation(result)
```

This layer formats substitutions, aliases and trace for UI. It does not parse, interpret or mutate memory.

## Visual graph

```ts
import { parse, projectStatementsToGraph, toCytoscapeElements } from '../src/core/index'

const file = parse('[] = []')
const graph = projectStatementsToGraph(file.statements)
const elements = toCytoscapeElements(graph)
```

Graph node identity is occurrence-safe. Equal display labels are not automatically merged.

## File formats

The browser application accepts:

```text
.mtl   canonical MTS formal-notation source
.astr  application string-Anum carrier
.anum  application quaternary-Anum carrier
```

File I/O exports source/AST data only. The removed v0.1 `ProofResult` format is not a compatibility API.

## Public entry point

Use `src/core/index.ts`. It exports canonical AST/parser/runtime/replay APIs and deliberately does not export a competing prover semantics.
