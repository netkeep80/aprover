# aprover

Веб-приложение для разбора, визуализации, contextual interpretation, untrusted proof search и independent trusted replay формальной нотации Метатеории Связей (МТС).

Публичная версия: <https://netkeep80.github.io/aprover/>

## Архитектурная граница

`aprover` — **consumer**, а не второй нормативный источник МТС. Каноническая теория, root definitions и machine-readable contracts находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

Текущий MTS release pin — `mts-contract/v0.5`. Единственный публичный proof format приложения — `mts-proof/v0.4` с `contractVersion = mts-contract/v0.4`, как требует upstream v0.5 umbrella.

```text
anum_docs current accepted surface
├── mts-contract/v0.5
├── mts-proof/v0.4
├── mts-opening-path/v0.4
├── mts-direct-deixis/v0.5
└── conformance corpora
        │ exact pinned dependency
        ▼
aprover
├── canonical lexer / parser / AST
├── read-only contextual interpreter
├── immutable ExplicitMemoryView
├── untrusted proof search
└── independent mts-proof/v0.4 replay
```

Исторические `mts-proof/v0.2` и `mts-proof/v0.3` не являются compatibility API: current replay их отвергает. История этих форматов хранится Git/PR/issues.

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

Поддерживаемые trusted relations задаются upstream contract и сейчас включают:

- `ContextuallySatisfies`;
- `Opens`;
- `NoVisibleDefinition`;
- `DefinitionConflict`;
- `NonAddressableDefinitionTarget`;
- `DefinitionOpeningPath`.

Порядок judgments сам по себе не создаёт dependency/composition semantics. Generic transitivity, symmetry, congruence, Modus Ponens, global substitution и implicit realization не добавляются приложением.

`src/core/proofSearch.ts` находится **над** trusted checker. Search может построить candidate `mts-proof/v0.4`, но acceptance определяется только независимым replay. Для обычной contextual interpretation Search создаёт `ContextuallySatisfies` judgment, а не старый v0.2 `interpret` step.

## Реализованный runtime

- canonical lexer/parser/AST без legacy compatibility grammar;
- `ContextFrame(start, end, parent)`;
- immutable `ExplicitMemoryView` и `InterpretationSession`;
- substitutions / aliases presentation;
- occurrence-safe визуальная проекция синтаксиса;
- current `mts-proof/v0.4` replay checker и untrusted proof search;
- current v0.5 upstream pin с exact provenance;
- editor и `.mtl/.astr/.anum` workflow.

## ANUM

`.anum` — raw Anum transport consumer. ANUM имеет собственные versioned L3 contracts в `anum_docs`; номер их schema не является версией public proof API `aprover`.

Поэтому proof cutover не должен искусственно переопределять ANUM semantics. Активные ANUM contracts сохраняются как pinned dependencies до их отдельной upstream консолидации, но старые MTS/proof compatibility bundles для этого не нужны.

## Структура

```text
src/core/
  ast.ts
  lexer.ts
  parser.ts
  interpreter.ts
  memoryView.ts
  interpretationSession.ts
  definitionEnvironment.ts
  definitionOpeningPath.ts
  proofReplayV04.ts
  proofSearch.ts
  linkGraph.ts
  stringAnum.ts
  quatAnum.ts

contracts/anum_docs-v0.5/
  mts-contract-v0.5.json
  mts-conformance-v0.5.json
  mts-proof-v0.4.json
  mts-proof-conformance-v0.4.json
  mts-opening-path-v0.4.json
  mts-opening-path-conformance-v0.4.json
  mts-direct-deixis-v0.5.json
  mts-direct-deixis-conformance-v0.5.json
  provenance.json
```

Историю удалённых proof versions и compatibility machinery хранит Git; implementation «на всякий случай» в рабочем дереве не сохраняется.

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
