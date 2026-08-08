# aprover

Веб-приложение для разбора, визуализации, contextual interpretation, untrusted proof search и independent trusted replay формальной нотации Метатеории Связей (МТС).

Публичная версия: <https://netkeep80.github.io/aprover/>

## Архитектурная граница

`aprover` — **consumer**, а не второй нормативный источник МТС.

Каноническая теория, root definitions и machine-readable contracts находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

```text
anum_docs
├── каноническая теория МТС
├── mts-contract/v0.2 + conformance
├── Anum L3 contracts + conformance
├── mts-proof/v0.2
└── minimal reference core/checker
        │
        ▼
aprover
├── pinned upstream artifacts + provenance
├── canonical lexer / parser / AST
├── read-only contextual interpreter
├── immutable ExplicitMemoryView
├── occurrence-safe visual graph
├── untrusted proof construction/search
└── independent proof replay checker
```

Локальные copies в `contracts/anum_docs-v0.2/` закреплены Git blob SHA. Они являются pinned dependencies, а не fork теории.

## Канонический язык МТС v0.2

```text
◁  — начало текущего контекста
▷  — конец текущего контекста
↑  — подъём к внешнему контексту
[] — occurrence-local anonymous form

♀F — форма начала F
F♂ — форма конца F
```

Canonical binary LinkForm использует `⟼`; inversion — `¬F`; inequality — `!=`. Compatibility spellings `->`, `!->`, bare `!`, `¬=`, `≠`, binary `↛` и `^` не входят в application grammar.

Display label не является semantic identity. `interpret` выполняется read-only и не материализует отсутствующие связи.

## Trusted proof boundary

Старый независимый prover удалён. В production path нет hard-coded A0–A11, lowercase metavariables, global equality rewrite, symmetry/transitivity/congruence или Modus Ponens как неявно trusted правил.

`src/core/proofReplay.ts` независимо проверяет `mts-proof/v0.2` proof objects через canonical parser + `InterpretationSession` + immutable `ExplicitMemoryView`. Unknown rules, forged substitutions/aliases, неверная provenance/version и implicit realization отвергаются.

`src/core/proofSearch.ts` находится **над** trusted checker: он может строить candidate proof object, но результат считается доказательством только после независимого `checkProof()`.

## Реализованный runtime

- canonical lexer/parser/AST без legacy compatibility grammar;
- `Round`, `Square`, `Literal`, `ContextPronoun` и occurrence identity по structural AST path;
- `ContextFrame(start, end, parent)`;
- immutable `ExplicitMemoryView` и `InterpretationSession`;
- upstream lexing/canonicalization/interpretation conformance;
- substitutions / aliases / trace presentation;
- occurrence-safe link graph;
- `mts-proof/v0.2` replay checker + untrusted proof search;
- editor и `.mtl/.astr/.anum` workflow.

## Форматы приложения

- `.mtl` — canonical MTS formal notation;
- `.astr` — application UTF-8 adapter, который проецирует значение в shared AST и canonical `⟼` syntax; это не вторая грамматика МТС;
- `.anum` — raw Anum transport consumer `anum-raw-carrier/v0.2`; raw carrier **не является denotation**. Приложение не содержит локальной таблицы значений абит или отдельной recursive semantics.

Полная Anum denotation принадлежит pinned L3 contracts из `anum_docs` (`anum-denotation`, `anum-pair-denotation`, `anum-recursive-denotation` и их conformance corpora).

## Структура

```text
src/core/
  ast.ts
  lexer.ts
  parser.ts
  normalizer.ts
  mtsContract.ts
  interpreter.ts
  memoryView.ts
  interpretationSession.ts
  proofReplay.ts
  proofSearch.ts
  linkGraph.ts
  stringAnum.ts
  quatAnum.ts

contracts/anum_docs-v0.2/
  mts-contract-v0.2.json
  mts-conformance-v0.2.json
  mts-proof-v0.2.json
  anum-*-v0.2.json
  provenance.json
```

Историю удалённого v0.1 prover/grammar machinery хранит Git; compatibility implementation в текущем дереве не сохраняется.

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

## Roadmap

Программа миграции: [`aprover#107`](https://github.com/netkeep80/aprover/issues/107).

- Phase A — pinned canonical contract: завершена;
- Phase B — occurrence-safe identity: завершена;
- Phase C — canonical lexer/AST/parser: завершена;
- Phase D — contextual interpreter/runtime/presentation: завершена;
- Phase E — trusted replay + удаление independent prover semantics: завершена;
- Phase F — proof-object/search UI и дальнейшая application integration поверх independent checker.

Нормативную МТС следует читать в `anum_docs`, а не выводить из implementation `aprover`.
