# aprover

Веб-приложение и consumer-библиотека для разбора, представления и визуализации формальной нотации Метатеории Связей (МТС).

Публичная версия: <https://netkeep80.github.io/aprover/>

## Архитектурная граница

`aprover` — **consumer**, а не второй нормативный источник МТС. Каноническая теория, accepted contracts и семантический runtime находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

Current semantic authority закреплена единственным machine lock:

```text
contracts/mts-core-consumer-lock.json

anum_docs commit = 957c818d82bd3211f2a59547fff28e8ed0ec4331
MTS contract     = mts-contract/v0.10
MTS conformance  = mts-conformance/v0.10
package          = @mts/core@0.10.0
```

```text
accepted anum_docs / @mts/core v0.10
                │ exact immutable consumer lock
                ▼
             aprover
   ├── lexer / direct SyntaxAset parser + source provenance
   ├── Aset-native normalization / canonical presentation
   ├── file and transport adapters
   ├── ANUM presentation adapter
   └── visualization
```

Parser host state, display labels, source positions и graph IDs не являются theorem authority. Канонический structured-source product приложения — SyntaxAset; completed AST не является current public compatibility surface.

## Current-only policy

Рабочее дерево содержит только текущую архитектуру. Исторические реализации и форматы хранятся в Git history, issues и PR, а не как параллельный runtime.

Поэтому в current tree нет локальных compatibility implementations для старых MTS/proof releases:

```text
no local v0.2 interpreter/memory/value-bundle runtime
no mts-proof/v0.3 or mts-proof/v0.4 replay runtime
no legacy proofSearch runtime
no vendored anum_docs-v0.6 semantic snapshot
```

Если когда-либо понадобится импорт исторического формата, это должна быть отдельно обоснованная untrusted migration boundary, результат которой проверяется текущей семантикой.

## Формальная нотация

Application parser поддерживает текущую canonical presentation, включая:

```text
◁  — начало текущего контекста
▷  — конец текущего контекста
↑  — подъём к внешнему контексту
[] — anonymous form
```

Canonical binary LinkForm использует `⟼`; inversion — `¬F`; inequality — `!=`. Compatibility spellings `->`, `!->`, bare `!`, `¬=`, `≠`, binary `↛` и `^` не входят в application grammar.

Эти syntax/presentation rules не подменяют accepted MTS semantics.

## ANUM

`.anum` transport layer использует ровно четыре абита:

```text
[ ] 1 0
```

Текущая semantic execution raw ANUM делегируется публичному API exact-pinned `@mts/core` v0.10 через `src/core/anumDenotation.ts`. `aprover` добавляет только presentation diagnostics.

Ключевые regression-инварианты current adapter:

```text
des(ε)  = R
des([]) = R
R = R ⟼ R
```

`src/core/quatAnum.ts` остаётся lossless transport/presentation adapter. Его позиционные node ids не являются semantic Link identity.

## Proof boundary

После удаления старого v0.3/v0.4 proof stack в current tree пока **нет нового trusted mathematical approver API**.

Следующий этап разработки:

- [#156](https://github.com/netkeep80/aprover/issues/156) — generic trusted approver поверх accepted upstream derivation semantics;
- [#157](https://github.com/netkeep80/aprover/issues/157) — theorem library и untrusted multi-step search поверх trusted approver.

Будущий search может только строить candidate evidence. Утверждать theorem acceptance сможет только current trusted approver, независимо воспроизводящий derivation через accepted MTS semantics.

## Public application core

`src/core/index.ts` экспортирует canonical `parseSyntaxAset()` / `normalizeSyntaxAset()` boundary, consumer-only presentation/I/O/visualization surfaces и тонкий ANUM adapter над `@mts/core`.

Completed AST больше не публикуется как current compatibility API. Временные AST-shaped reduction objects внутри parser/emitter остаются implementation detail до отдельного A8.3b cutover и не являются долговременной domain authority.

Если нужной semantic capability нет в public `@mts/core` facade, это `UPSTREAM_GAP`: её следует исправлять в `anum_docs`, а не закрывать deep import или локальной копией MTS semantics.

## Разработка

```bash
npm install
npm run dev
```

Полный application gate:

```bash
npm run lint:check
npm run type-check
npm test
npm run build
npm run test:e2e
```

Нормативную МТС следует читать в `anum_docs`, а не выводить из implementation `aprover`.
