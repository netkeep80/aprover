# aprover

Веб-приложение для разбора, визуализации, contextual interpretation, untrusted proof search и independent trusted replay формальной нотации Метатеории Связей (МТС).

Публичная версия: <https://netkeep80.github.io/aprover/>

## Архитектурная граница

`aprover` — **consumer**, а не второй нормативный источник МТС. Каноническая теория, root definitions и machine-readable contracts находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

Текущий MTS release pin — `mts-contract/v0.6`. Единственный публичный proof format приложения — `mts-proof/v0.4` с `contractVersion = mts-contract/v0.4`, как требует upstream v0.5 umbrella. Текущий raw/channel ANUM surface — `anum-deserialization/v0.4`.

```text
anum_docs current accepted surface
├── mts-contract/v0.6
├── mts-proof/v0.4
├── mts-opening-path/v0.4
├── mts-direct-deixis/v0.5
├── anum-deserialization/v0.4
└── current transitive conformance/value-bundle dependencies
        │ exact pinned dependency
        ▼
aprover
├── canonical lexer / parser / AST
├── read-only contextual interpreter
├── immutable ExplicitMemoryView
├── pure ANUM stream deserializer
├── untrusted proof search
└── independent mts-proof/v0.4 replay
```

Исторические proof/ANUM surfaces не являются compatibility API. История форматов хранится Git/PR/issues, а не параллельными runtime-paths.

## Формальная нотация

Текущий application parser сохраняет принятую форму контекстной нотации:

```text
◁  — начало текущего контекста
▷  — конец текущего контекста
↑  — подъём к внешнему контексту
[] — anonymous form
```

Canonical binary LinkForm использует `⟼`; inversion — `¬F`; inequality — `!=`. Compatibility spellings `->`, `!->`, bare `!`, `¬=`, `≠`, binary `↛` и `^` не входят в application grammar.

Display label не является semantic identity. Интерпретация read-only: поиск/проверка не материализуют отсутствующие связи.

## Trusted proof boundary

`src/core/proofReplayV04.ts` — единственная публичная proof boundary. Она принимает только:

```text
proofVersion    = mts-proof/v0.4
contractVersion = mts-contract/v0.4
```

Trusted relations задаются upstream contract: `ContextuallySatisfies`, `Opens`, `NoVisibleDefinition`, `DefinitionConflict`, `NonAddressableDefinitionTarget`, `DefinitionOpeningPath`.

Порядок judgments сам по себе не создаёт dependency/composition semantics. Generic transitivity, symmetry, congruence, Modus Ponens, global substitution и implicit realization не добавляются приложением.

`src/core/proofSearch.ts` находится **над** trusted checker. Search может построить candidate `mts-proof/v0.4`, но acceptance определяется только независимым replay.

## ANUM

`src/core/anumDenotation.ts` потребляет accepted `anum-deserialization/v0.4` из `anum_docs`.

Ключевая граница:

```text
des(ε)  = R
des([]) = R
R = R ⟼ R
```

Алфавит ровно `[ ] 1 0`; `R=∞` не является пятым абитом. Каждый новый stack context начинается с `R`. Непустой вложенный context возвращает `R ⟼ inner` как одно значение внешнему context. Повтор `1110` использует один и тот же semantic `L` в трёх позициях, а не три экземпляра связи.

`semanticLink(A,B)` — чистый semantic constructor по ordered poles. Source positions, stack frames и transport node ids не являются semantic Link identity. `deserializeAnumStream()` не имеет доступа к `MemoryView`, `realize` или `delete`.

`src/core/quatAnum.ts` остаётся только lossless transport-presentation adapter для `.anum`; его позиционные node ids служат UI/transport-представлению и не задают семантику.

## Current pinned snapshot

Все необходимые upstream artifacts лежат в одном каталоге `contracts/anum_docs-v0.6/`. Некоторые **транзитивные текущие dependencies** сохраняют собственный schema id `v0.2`, потому что именно так их публикует текущий upstream release:

- `mts-conformance/v0.2` — base corpus, требуемый current conformance umbrella;
- `mts-value-bundle/v0.2` и его corpus — accepted flat ValueBundle, явно сохраняемый `mts-contract/v0.6`.

Это не legacy runtime mode и не compatibility implementation. Отдельного `contracts/anum_docs-v0.2/` после cutover нет.

## Реализованный runtime

- canonical lexer/parser/AST без legacy compatibility grammar;
- `ContextFrame(start, end, parent)`;
- immutable `ExplicitMemoryView` и `InterpretationSession`;
- substitutions / aliases presentation;
- occurrence-safe визуальная проекция синтаксиса;
- current `mts-proof/v0.4` replay checker и untrusted proof search;
- current ANUM stream v0.3 deserializer;
- current v0.5 upstream snapshot с exact provenance;
- editor и `.mtl/.astr/.anum` workflow.

## Разработка

```bash
npm install
npm run dev
```

Полный gate:

```bash
npm run lint:check
npm run type-check
npm test
npm run build
npm run test:e2e
```

Нормативную МТС следует читать в `anum_docs`, а не выводить из implementation `aprover`.
