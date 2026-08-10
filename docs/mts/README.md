# МТС в aprover

`aprover` не является нормативным источником теории МТС. Каноническое изложение, root definitions и machine-readable contracts находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

Приложение потребляет текущий accepted release `mts-contract/v0.5`; единственный публичный proof format — `mts-proof/v0.4`. Собственные аксиомы или compatibility proof semantics здесь не вводятся.

## Что документируется здесь

Этот каталог описывает только application integration и границы:

- `03-notations/03-string-anum.md` — `.astr` как UTF-8 application adapter;
- `03-notations/04-quaternary.md` — `.anum` как ANUM transport consumer.

Историю удалённых prover/version pages хранит Git; они не сохраняются как активная compatibility documentation.

## Runtime boundary

```text
anum_docs current accepted release
  mts-contract/v0.5
  mts-proof/v0.4
  opening-path + direct-deixis contracts
  ANUM L3 contracts
        │ exact pin
        ▼
aprover
  lexer/parser + canonical AST
  ContextFrame + read-only MemoryView
  InterpretationSession
  untrusted proof search
  independent mts-proof/v0.4 replay
```

Ключевые application invariants:

- `◁` и `▷` задают роли текущего контекста, `↑` — подъём к внешнему контексту;
- canonical link/inversion/inequality spellings: `⟼`, `¬F`, `!=`;
- interpretation read-only и не выполняет implicit materialization;
- display label и технический `LinkRef` не создают отдельную semantic identity;
- `.anum` transport не получает локальную придуманную denotation;
- proof search не является trusted semantics: его current `mts-proof/v0.4` output обязан проходить independent replay;
- `mts-proof/v0.2` и `mts-proof/v0.3` не поддерживаются как compatibility formats;
- legacy implementation после миграции удаляется из рабочего дерева.

## Нормативное определение

См. `netkeep80/anum_docs`. Pinned contracts в `aprover` — dependency/provenance boundary, а не отдельное определение МТС.
