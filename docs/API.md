# aprover API

`aprover` — application/library consumer нормативной МТС из [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs). Текущая семантическая authority приложения — **exact-pinned accepted MTS v0.10 через `@mts/core`**, а не локальная реализация МТС.

Machine pin хранится в `contracts/mts-core-consumer-lock.json`:

```text
anum_docs commit = 957c818d82bd3211f2a59547fff28e8ed0ec4331
MTS contract     = mts-contract/v0.10
MTS conformance  = mts-conformance/v0.10
package          = @mts/core@0.10.0
```

## Public application entry point

`src/core/index.ts` публикует canonical SyntaxAset structured-source boundary, consumer-only presentation/I/O/visualization API и тонкий ANUM adapter над exact `@mts/core` v0.10.

Current tree не содержит legacy local interpreter/memory/value-bundle/proof replay/search API. Completed AST также не публикуется как current compatibility API.

## Syntax and canonical presentation

```ts
import { normalizeSyntaxAset, parseSyntaxAset } from '../src/core/index'

const syntax = parseSyntaxAset('∞ : {◁ = ∞, ▷ = ∞}')
const normalized = normalizeSyntaxAset(syntax)
console.log(normalized.canonical)
```

`parseSyntaxAset()` возвращает текущий structured-source product вместе с external source provenance. `normalizeSyntaxAset()` читает канонический SyntaxAset напрямую. Временные parser reduction objects являются private host state и не current public compatibility API.

Успешный parse или normalize не является доказательством и не задаёт нормативную семантику МТС.

## `.anum`: transport presentation vs semantic execution

`quatAnum.ts` — lossless transport/presentation adapter:

```ts
import { describeRawCarrier } from '../src/core/index'

const transport = describeRawCarrier('1110')
console.log(transport.raw)
```

Его `node.id` — только source-position/presentation coordinate. Это не semantic Link identity.

Текущая ANUM-семантика выполняется только через exact-pinned `@mts/core`:

```ts
import { deserializeAnumStream, semanticLink } from '../src/core/index'

const denotation = deserializeAnumStream('[10]')
console.log(denotation.result)

semanticLink('R', 'R') // R
```

`anumDenotation.ts` не реализует собственный MTS runtime: он вызывает public upstream ANUM boundary и добавляет application diagnostics.

## Semantic identity

Current MTS Memory/Link identity принадлежит `@mts/core` v0.10. Application numeric IDs, graph IDs, source positions и JavaScript object identity не являются semantic Link identity.

Consumer boundary направлена только так:

```text
accepted @mts/core structures/evidence -> application presentation
```

а не наоборот:

```text
UI / graph / source id -> semantic truth
```

## Proof API status

В current tree нет старого `mts-proof/v0.3` / `mts-proof/v0.4` replay и нет старого `proofSearch`.

Новый mathematical proof boundary не маскируется compatibility wrapper'ом. Он строится отдельно:

```text
#156 generic trusted approver
  accepted upstream derivation semantics
  -> deterministic ACCEPT / REJECT

#157 theorem library + untrusted multi-step search
  candidate derivation
  -> #156 independent approval
```

Пока #156 не реализован, `aprover` не публикует current theorem-acceptance API.

## Current-only repository policy

История старых implementation/transport formats остаётся в Git history/issues/PRs. Она не переносится в current runtime tree.

```text
current working tree -> current architecture only
Git history          -> historical implementations/evidence
```

Если historical importer когда-либо понадобится, он должен быть отдельной untrusted boundary и выдавать данные, которые затем заново проверяются current semantics.

## File formats

```text
.mtl   application MTS source/editor format
.astr  application UTF-8 adapter
.anum  application ANUM transport adapter + @mts/core semantic execution
```

## Authority summary

```text
CURRENT ACCEPTED MTS SEMANTICS
  exact @mts/core@0.10.0
  exact anum_docs@957c818d82bd3211f2a59547fff28e8ed0ec4331

CONSUMER-ONLY
  SyntaxAset syntax/provenance / presentation / file I/O / visualization / ANUM diagnostics

NOT A CURRENT PUBLIC COMPATIBILITY API
  completed AST product / AST parser result / AST normalizer facade

NOT PRESENT IN CURRENT TREE
  local legacy interpreter/memory/value-bundle semantics
  mts-proof/v0.3/v0.4 replay
  legacy proof search
  vendored anum_docs-v0.6 snapshot
```

Если нужной current semantic capability нет в public `@mts/core` facade, это `UPSTREAM_GAP`: его надо фиксировать upstream, а не закрывать deep import или новой локальной MTS-семантикой.
