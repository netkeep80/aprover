# aprover API

`aprover` — application/library consumer нормативной МТС из [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs). Текущий release pin приложения — `mts-contract/v0.6`; этот документ описывает только application API и не определяет теорию МТС.

## Canonical source

```ts
import { parse, parseExpr, parseWithRecovery, toCanonicalString } from '../src/core/index'

const file = parse('∞ : {◁ = ∞, ▷ = ∞}')
const expression = parseExpr('[] = ◁')
console.log(toCanonicalString(expression))

const recovered = parseWithRecovery('[] = ◁')
console.log(recovered.file, recovered.error)
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

`mts-proof/v0.2` и `mts-proof/v0.3` не являются compatibility APIs. Legacy artifacts fail closed at the current replay boundary.

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

## `.anum`: transport presentation vs semantic deserialization

`.anum` has two deliberately separate application layers.

`quatAnum.ts` is a lossless **transport presentation** adapter:

```ts
import { describeRawCarrier } from '../src/core/index'

const transport = describeRawCarrier('1110')
console.log(transport.raw) // 1110
```

Its `node.id` values are source-position/presentation ids only. They are not MTS Link identities.

Semantic execution belongs exclusively to accepted `anum-deserialization/v0.4`:

```ts
import { deserializeAnumStream, semanticLink } from '../src/core/index'

deserializeAnumStream('').result       // R
deserializeAnumStream('[]').result     // R
deserializeAnumStream('10').result     // (L⟼U)
deserializeAnumStream('[10]').result   // (R⟼(L⟼U))
deserializeAnumStream('1110').resolvedValues // ['L', 'L', 'L', 'U']

semanticLink('R', 'R') // R
```

The alphabet is exactly `[ ] 1 0`; `R` is not a fifth abit. `semanticLink()` is a pure constructor by ordered semantic poles. `deserializeAnumStream()` never reads or writes `MemoryView` and exposes no materialization operation.

Lexical transport acceptance and semantic stack validity are separate. For example `describeRawCarrier('][')` can preserve the raw bytes for presentation, while `deserializeAnumStream('][')` rejects with `unexpected-close`.

Removed v0.2 occurrence-tree APIs (`denotateAnum`, `canonicalAnum`, `validateAnumDenotation` and structural node-id IR) are intentionally not compatibility exports.

## `.astr` adapter

`.astr` is not a second MTS grammar. UTF-8 input is represented through the shared AST and canonical `⟼` syntax.

```ts
import { stringAnumToFormal } from '../src/core/index'

stringAnumToFormal('hello')
```

## Current vendor snapshot

Use only `contracts/anum_docs-v0.6/` as the pinned dependency directory. It contains current MTS/proof/ANUM artifacts plus byte-exact transitive schemas still required by current upstream (`mts-conformance/v0.2`, flat `mts-value-bundle/v0.2` and its corpus). The schema suffix does not create a legacy runtime mode.

## File formats

```text
.mtl   MTS formal-notation source
.astr  application UTF-8 adapter
.anum  application Anum transport adapter + current v0.3 semantic deserializer
```

## Public entry point

Use `src/core/index.ts`. It exports canonical AST/parser/runtime, the single current `mts-proof/v0.4` replay API, untrusted current-format proof search, current ANUM v0.3 semantic deserialization, and application adapters. Historical proof/ANUM APIs are intentionally absent.
