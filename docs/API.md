# aprover API

`aprover` — application/library consumer нормативной МТС из [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs). Текущая семантическая authority приложения — **exact-pinned accepted MTS v0.10 через `@mts/core`**, а не локальная реализация МТС.

Machine pin хранится в `contracts/mts-core-consumer-lock.json`:

```text
anum_docs commit = 957c818d82bd3211f2a59547fff28e8ed0ec4331
MTS contract     = mts-contract/v0.10
package          = @mts/core@0.10.0
```

`contracts/anum_docs-v0.6/**` сохраняется только как исторический/differential corpus для ещё не мигрированных regression paths. Это не current semantic dependency.

## Public application entry point

`src/core/index.ts` публикует consumer-only syntax/presentation/I/O API и тонкий ANUM adapter над exact `@mts/core` v0.10.

Он **не** публикует legacy local interpreter/memory/value-bundle/proof-v0.3/v0.4 replay/search как current MTS API.

## Syntax and canonical presentation

```ts
import { parse, parseExpr, parseWithRecovery, toCanonicalString } from '../src/core/index'

const file = parse('∞ : {◁ = ∞, ▷ = ∞}')
const expression = parseExpr('[] = ◁')
console.log(toCanonicalString(expression))

const recovered = parseWithRecovery('[] = ◁')
console.log(recovered.file, recovered.error)
```

Эти parser/AST/normalizer surfaces являются application/editor/import boundary. Сам факт успешного parse/normalize не является доказательством и не задаёт нормативную семантику МТС.

## `.anum`: transport presentation vs semantic execution

`quatAnum.ts` — lossless transport/presentation adapter:

```ts
import { describeRawCarrier } from '../src/core/index'

const transport = describeRawCarrier('1110')
console.log(transport.raw) // 1110
```

Его `node.id` — только source-position/presentation coordinates. Это не semantic Link identity.

Текущая ANUM-семантика выполняется только через exact-pinned `@mts/core`:

```ts
import { deserializeAnumStream, semanticLink } from '../src/core/index'

const denotation = deserializeAnumStream('[10]')
console.log(denotation.result)

semanticLink('R', 'R') // R
```

`anumDenotation.ts` не реализует собственный MTS runtime: он адаптирует upstream result к application presentation/diagnostics.

Алфавит transport layer остаётся `[ ] 1 0`; lexical transport acceptance и semantic execution — разные границы.

## Legacy local semantic path

Следующие модули пока сохраняются как historical/compatibility implementation для regression/UI migration, но **не являются current accepted MTS semantics**:

```text
src/core/interpreter.ts
src/core/memoryView.ts
src/core/interpretationSession.ts
src/core/valueBundle.ts
src/core/definitionEnvironment.ts
src/core/definitionOpeningPath.ts
src/core/proofReplayV03.ts
src/core/proofReplayV04.ts
src/core/proofSearch.ts
```

В частности:

```text
LinkRef = number
ExplicitMemoryView
mts-proof/v0.3
mts-proof/v0.4
mts-contract/v0.4
```

относятся к legacy aprover path. Они не должны импортироваться через `src/core/index.ts` и не могут использоваться как current theorem authority.

## Legacy proof replay and search

`mts-proof/v0.4` — historical aprover artifact format. `checkProofV04()` может использоваться прямым legacy import для regression/compatibility replay, но его результат означает только:

```text
LEGACY REPLAY MATCHED | LEGACY REPLAY REJECTED
```

Он **не** означает:

```text
accepted MTS v0.10 theorem proof
```

Аналогично `searchInterpretProof()` — untrusted legacy candidate generator. Search success никогда не является proof acceptance.

Current/future generic mathematical proof acceptance должен опираться на accepted upstream proof-calculus semantics (`anum_docs#779`) и отдельный trusted aprover boundary (`aprover#156`), а не на переименование `mts-proof/v0.4` в новый current format.

## Memory and semantic identity

Current MTS Memory/Link identity принадлежит `@mts/core` v0.10. Application numeric IDs, graph IDs, source positions и legacy `LinkRef = number` не являются semantic Link identity.

Правило consumer boundary:

```text
accepted @mts/core evidence -> application presentation
```

не наоборот:

```text
UI / graph / numeric id -> semantic truth
```

## File formats

```text
.mtl   application MTS source/editor format
.astr  application UTF-8 adapter
.anum  application Anum transport adapter + @mts/core semantic execution
```

## Authority summary

```text
CURRENT ACCEPTED MTS SEMANTICS
  exact @mts/core@0.10.0
  exact anum_docs@957c818d82bd3211f2a59547fff28e8ed0ec4331

CONSUMER-ONLY
  syntax / presentation / file I/O / visualization adapters

LEGACY / HISTORICAL
  local v0.2 interpreter/session/memory/value-bundle
  mts-proof/v0.3/v0.4 replay and search
```

Если current consumer capability отсутствует в public `@mts/core` facade, это `UPSTREAM_GAP`: его надо фиксировать upstream, а не закрывать deep import или новой локальной MTS-семантикой.
