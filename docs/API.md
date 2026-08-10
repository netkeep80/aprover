# aprover API

`aprover` — application/library consumer нормативной МТС из [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs). Текущий release pin приложения — `mts-contract/v0.5`; этот документ описывает только application API и не определяет теорию МТС.

## Canonical source

```ts
import { parse, parseExpr, parseWithRecovery, toCanonicalString } from '../src/core/index'

const file = parse('∞ : {◁ = ∞, ▷ = ∞}')
const expression = parseExpr('[] = ◁')
console.log(toCanonicalString(expression))

const recovered = parseWithRecovery('[] = ◁')
console.log(recovered.ast, recovered.errors)
```

Canonical link/inversion/inequality spellings are `⟼`, `¬F`, `!=`; legacy aliases are not a compatibility language.

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

`InterpretationSession` owns an immutable `ExplicitMemoryView`. Interpretation cannot materialize or delete links.

## Trusted proof replay

Единственный публичный proof format — `mts-proof/v0.4`.

```ts
import {
  MTS_PROOF_CONTRACT_VERSION_V04,
  MTS_PROOF_SCHEMA_V04,
  checkProofV04,
  type MtsProofObjectV04,
} from '../src/core/index'

const proof: MtsProofObjectV04 = {
  proofVersion: MTS_PROOF_SCHEMA_V04,
  contractVersion: MTS_PROOF_CONTRACT_VERSION_V04,
  judgments: [
    {
      relation: 'ContextuallySatisfies',
      expression: '[] = ◁',
      context: { start: 10, end: 12, parent: null },
      symbols: [],
      memory: [],
      expected: {
        substitutions: [{ path: [0], link: 10 }],
        aliases: [],
      },
    },
  ],
}

console.log(checkProofV04(proof))
```

Public replay accepts only:

```text
proofVersion    = mts-proof/v0.4
contractVersion = mts-contract/v0.4
```

The application-level release pin is `mts-contract/v0.5`; its upstream contract explicitly requires this v0.4 proof schema/version pair.

`mts-proof/v0.2` and `mts-proof/v0.3` are not compatibility APIs. Legacy artifacts fail closed at the current replay boundary.

## Untrusted proof search

`searchInterpretProof()` constructs a current `mts-proof/v0.4` candidate containing a `ContextuallySatisfies` judgment. Search does not extend the trusted relation set and its result becomes accepted only after independent `checkProofV04()` replay.

```ts
import { checkProofV04, searchInterpretProof } from '../src/core/index'

const found = searchInterpretProof({
  expression: '[] = ◁',
  context: { start: 10, end: 12 },
})

if (found.status === 'proven') {
  console.log(checkProofV04(found.proof))
}
```

No generic transitivity, symmetry, congruence, Modus Ponens, global substitution or implicit realization is added by the consumer.

## Memory view

```ts
import { ExplicitMemoryView } from '../src/core/index'

const memory = new ExplicitMemoryView([{ id: 30, start: 2, end: 3 }])
memory.poles(30)
memory.findLink(2, 3)
```

Application memory handles are technical references; display labels are not semantic identity.

## Visual graph

```ts
import { parse, projectStatementsToGraph } from '../src/core/index'

const file = parse('[] = []')
const graph = projectStatementsToGraph(file.statements)
```

The graph is a presentation of source structure, not a second semantic identity model.

## `.astr` adapter

`.astr` is not a second MTS grammar. UTF-8 input is represented through the shared AST and canonical `⟼` syntax.

```ts
import { stringAnumToFormal } from '../src/core/index'

stringAnumToFormal('hello')
```

## `.anum` adapter

ANUM has its own versioned L3 contracts in `anum_docs`. Their schema versions are independent from the public proof version of `aprover`.

```ts
import { describeRawCarrier } from '../src/core/index'

describeRawCarrier('01')
```

The application must not invent local abit denotation or silently reinterpret current ANUM contracts merely to make their version number match `mts-contract/v0.5`.

## File formats

```text
.mtl   MTS formal-notation source
.astr  application UTF-8 adapter
.anum  application Anum transport adapter
```

## Public entry point

Use `src/core/index.ts`. It exports canonical AST/parser/runtime, the single current `mts-proof/v0.4` replay API, untrusted current-format proof search, and application adapters. Historical proof APIs are intentionally absent.
