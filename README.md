# aprover

Веб-приложение для разбора, визуализации, contextual interpretation и trusted replay формальной нотации Метатеории Связей (МТС).

Публичная версия: <https://netkeep80.github.io/aprover/>

## Архитектурная граница

`aprover` — **consumer**, а не второй нормативный источник МТС.

Каноническая теория, root definitions и machine-readable contracts находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

```text
anum_docs
├── каноническая теория МТС
├── mts-contract/v0.2
├── mts-conformance/v0.2
├── mts-proof/v0.2
└── minimal reference core/checker
        │
        ▼
aprover
├── Vue/TypeScript application
├── pinned upstream artifacts + provenance
├── canonical lexer / parser / AST
├── read-only contextual interpreter
├── immutable ExplicitMemoryView
├── occurrence-safe visual graph
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

Display label не является semantic identity. `interpret` выполняется read-only и не материализует отсутствующие связи.

## Trusted proof boundary

После Phase E старый независимый prover удалён. В production path больше нет hard-coded A0–A11, lowercase metavariables, global equality rewrite, symmetry/transitivity/congruence или Modus Ponens как неявно trusted правил.

Текущий proof contract — candidate `mts-proof/v0.2`. Его trusted rule set содержит только:

```text
interpret
```

`src/core/proofReplay.ts` независимо повторяет заявленный proof step через canonical parser + `InterpretationSession` + immutable `ExplicitMemoryView` и сверяет:

```text
contractVersion
rule
success
substitutions
aliases
```

Unknown rules, forged substitutions, неверная provenance/version и implicit realization отвергаются.

Proof search намеренно отсутствует до Phase F: search не должен определять trusted semantics.

## Реализованный runtime

- canonical lexer/parser без compatibility grammar `♂F / F♀`;
- AST с `Round`, `Square`, `Literal`, `ContextPronoun`;
- occurrence identity по structural AST path;
- `ContextFrame(start, end, parent)`;
- immutable `ExplicitMemoryView`;
- `InterpretationSession`;
- upstream lexing/canonicalization/interpretation conformance;
- substitutions / aliases / trace presentation model;
- occurrence-safe link graph;
- `mts-proof/v0.2` replay checker;
- editor и `.mtl/.astr/.anum` file workflow.

Главный web screen сейчас честно выполняет parse/visualize. Он не показывает старые «proof verdicts» до появления нового proof UI поверх trusted checker.

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
  interpretationPresentation.ts
  proofReplay.ts
  linkGraph.ts

src/components/
  Editor.vue
  ASTViewer.vue
  LinkGraphViewer.vue
  InterpretationPanel.vue

contracts/anum_docs-v0.2/
  mts-contract-v0.2.json
  mts-conformance-v0.2.json
  mts-proof-v0.2.json
  provenance.json
```

Историю удалённого v0.1 prover machinery хранит Git; compatibility implementation в текущем дереве не сохраняется.

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

## Форматы приложения

- `.mtl` — canonical formal notation;
- `.astr` — прикладной строковый Anum carrier;
- `.anum` — прикладной четверичный Anum carrier.

Подробности нормативной МТС следует читать в `anum_docs`, а не выводить из implementation `aprover`.

## Roadmap

Программа миграции: [`aprover#107`](https://github.com/netkeep80/aprover/issues/107).

- Phase A — pinned canonical contract: завершена;
- Phase B — occurrence-safe identity: завершена;
- Phase C — canonical lexer/AST/parser: завершена;
- Phase D — contextual interpreter/runtime/presentation: завершена;
- Phase E — trusted replay + удаление independent prover semantics: текущий merge gate;
- Phase F — visual proof objects/search UI поверх independent trusted checker.
