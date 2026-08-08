# aprover

Веб-приложение для разбора, визуализации, contextual interpretation и дальнейшей проверки доказательств в формальной нотации Метатеории Связей (МТС).

Публичная версия: <https://netkeep80.github.io/aprover/>

## Архитектурная граница

`aprover` — **consumer**, а не второй нормативный источник МТС.

Каноническое изложение теории, formal-language contract, root definitions и conformance corpus находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

```text
anum_docs
├── каноническая теория МТС
├── единая формальная нотация
├── mts-contract/v0.2
├── mts-conformance/v0.2
└── минимальное reference core
        │
        ▼
aprover
├── Vue/TypeScript application
├── pinned contract consumer
├── lexer / parser / canonical AST
├── read-only contextual interpreter
├── visual occurrence graph
├── substitutions / aliases / trace presentation
└── proof search / proof checker application layer
```

Локальная копия contract/conformance хранится в `contracts/anum_docs-v0.2/` вместе с provenance. CI проверяет Git blob SHA, поэтому локальная семантика не может незаметно разойтись с upstream.

## Канонический язык МТС v0.2

Ключевые правила, которые приложение **потребляет** из upstream contract:

```text
◁  — начало текущего бинарного контекста
▷  — конец текущего бинарного контекста
↑  — подъём к внешнему контексту
[] — occurrence-local anonymous form

♀F — форма начала F
F♂ — форма конца F
```

Квадратные скобки не являются context-address syntax. Display label не является semantic identity. `interpret` выполняется read-only и не материализует отсутствующие связи.

Подробности теории следует читать в `anum_docs`, а не выводить из application implementation.

## Реализованный v0.2 runtime

На текущем этапе в `aprover` есть:

- pinned `mts-contract/v0.2` и executable conformance corpus;
- canonical lexer/parser без compatibility grammar `♂F / F♀`;
- AST с `Round`, `Square`, `Literal`, `ContextPronoun`;
- structural occurrence identity для одинаково отображаемых форм;
- `ContextFrame(start, end, parent)`;
- immutable `ExplicitMemoryView`;
- `InterpretationSession` как application boundary;
- прямое исполнение upstream lexing/canonicalization/interpretation vectors;
- presentation model/component для substitutions, aliases и resolution trace;
- visual link graph, editor, file operations и proof-related UI.

## Важный текущий переход

Старое proof machinery проекта исторически содержало собственную v0.1 semantics: hard-coded A0–A11, lowercase metavariables и дополнительные equality/congruence/transitivity assumptions.

Эта semantics **не является МТС v0.2**. Она удаляется в Phase E по [`#107`](https://github.com/netkeep80/aprover/issues/107) по мере миграции consumers; отдельный `proverV2` или compatibility implementation не создаётся.

## Структура

```text
src/core/
  ast.ts                       canonical AST
  lexer.ts                     lexer
  parser.ts                    parser
  normalizer.ts                canonicalization
  mtsContract.ts               pinned upstream contract boundary
  interpreter.ts               read-only contextual interpreter
  memoryView.ts                immutable application memory adapter
  interpretationSession.ts     application session
  interpretationPresentation.ts presentation view model
  linkGraph.ts                 occurrence-safe visual graph
  prover.ts                    legacy proof machinery being migrated in Phase E

src/components/
  InterpretationPanel.vue      substitutions / aliases / trace
  LinkGraphViewer.vue          visual graph
  ProverPanel.vue              proof UI
  Editor.vue                   editor

contracts/anum_docs-v0.2/
  mts-contract-v0.2.json
  mts-conformance-v0.2.json
  provenance.json
```

`docs/mts/README.md` описывает только границу документации приложения. Нормативные теоретические документы находятся upstream.

## Разработка

Требуется Node.js/npm.

```bash
npm install
npm run dev
```

Основные проверки:

```bash
npm run lint:check
npm run type-check
npm test
npm run build
npm run test:e2e
```

CI выполняет lint, type-check, unit tests, production build и Playwright E2E.

## Форматы файлов приложения

- `.mtl` — текст canonical formal notation, разбираемый parser-ом;
- `.astr` — прикладной строковый anum format;
- `.anum` — прикладной четверичный anum format.

Документация `.astr/.anum` может жить в `aprover`, поскольку это implementation/application surface. Определение самой формальной нотации МТС остаётся в `anum_docs`.

## Roadmap

Текущая интеграционная программа ведётся в [`aprover#107`](https://github.com/netkeep80/aprover/issues/107):

- Phase A — pinned canonical contract: завершена;
- Phase B — occurrence-safe identity: завершена;
- Phase C — canonical lexer/AST/parser: завершена;
- Phase D — contextual interpreter/runtime/presentation: завершена;
- Phase E — удаление старой независимой prover semantics: выполняется;
- Phase F — replayable proof objects и trusted checker поверх canonical contract.

Историю старых теоретических документов и реализаций хранит Git; после миграции consumers legacy не сохраняется как параллельный production path.
