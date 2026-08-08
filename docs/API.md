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

The parser consumes the v0.2 surface, including atomic `◁`/`▷`, separate `↑`, occurrence-local `[]`, `♀F` and `F♂`. Canonical link/inversion/inequality spellings are `⟼`, `¬F`, `!=`; legacy aliases are not a compatibility language.

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

`InterpretationSession` owns an immutable `ExplicitMemoryView`. Interpretation cannot `realize` or delete links. Anonymous forms are identified by occurrence paths, not display labels.

## Trusted proof replay and untrusted search

The trusted boundary is `mts-proof/v0.2` replay.

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

console.log(checkProof(proof))
```

`searchInterpretProof()` is an **untrusted constructor/search API**. Its output becomes trusted only after independent `checkProof()` replay. Search never extends the trusted rule set.

Historical A0–A11 tables, lowercase metavariables, global substitution/rewrite, implicit symmetry/transitivity/congruence, Modus Ponens and legacy proof caches are not MTS v0.2 APIs.

## Memory view

```ts
import { ExplicitMemoryView } from '../src/core/index'

const memory = new ExplicitMemoryView([{ id: 30, start: 2, end: 3 }])
memory.poles(30)
memory.findLink(2, 3)
```

Duplicate IDs and ambiguous `(start,end) -> LinkRef` identities are rejected.

## Visual graph

```ts
import { parse, projectStatementsToGraph } from '../src/core/index'

const file = parse('[] = []')
const graph = projectStatementsToGraph(file.statements)
```

Graph node identity is occurrence-safe. Equal display labels are not automatically merged.

## `.astr` application adapter

`.astr` is not a second MTS grammar. A UTF-8 line is represented through the shared AST as `Link(Infinity, StringLit)` and presentation source uses canonical `⟼`:

```ts
import { stringAnumToFormal } from '../src/core/index'

stringAnumToFormal('hello') // (∞ ⟼ "hello")
```

## `.anum` raw-carrier adapter

The `.anum` application path consumes `anum-raw-carrier/v0.2`. It does **not** define abit denotation locally.

```ts
import { describeRawCarrier } from '../src/core/index'

describeRawCarrier('01')
// {
//   kind: 'raw-carrier',
//   raw: '01',
//   nodes: [
//     { id: 0, start: { role: 'root' }, end: { role: 'abit:0' } },
//     { id: 1, start: { node: 0 }, end: { role: 'abit:1' } },
//   ],
//   root: { node: 1 }
// }
```

Raw bracket balance is intentionally not required: `][` is a valid transport carrier. Structural denotation belongs to the separately pinned `anum-denotation`, `anum-pair-denotation` and `anum-recursive-denotation` contracts.

Removed APIs such as local `ABIT_DEFINITIONS`, `parseAbitToAST()` or `quatAnumToFormal()` are not compatibility exports.

## File formats

The browser application accepts:

```text
.mtl   canonical MTS formal-notation source
.astr  application UTF-8 adapter
.anum  application Anum raw-carrier adapter
```

File I/O and adapters do not create a competing theory or trusted proof semantics.

## Public entry point

Use `src/core/index.ts`. It exports canonical AST/parser/runtime/replay APIs, untrusted proof search, and application adapters bound to the pinned contracts.
