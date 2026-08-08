# МТС в aprover

`aprover` не является нормативным источником теории МТС.

Каноническое изложение теории, формальная нотация, root definitions и machine-readable contracts находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

Приложение потребляет pinned MTS v0.2 artifacts из `anum_docs` и не вводит собственные аксиомы, грамматику или proof semantics как конкурирующий канон.

## Что относится к aprover

В этом каталоге остаётся только документация application-specific форматов и границ. Например:

- `03-notations/03-string-anum.md` — прикладной формат `.astr`;
- `03-notations/04-quaternary.md` — прикладной формат `.anum`.

Старый каталог `05-prover/` удалён в Phase E вместе с A0–A11/MP implementation. Его историю хранит Git.

## Канонический runtime boundary

```text
anum_docs
  theory + formal notation
  mts-contract/v0.2
  mts-conformance/v0.2
  mts-proof/v0.2
        │
        ▼
aprover
  lexer/parser consumer
  canonical AST
  ContextFrame + read-only MemoryView
  InterpretationSession
  substitutions / aliases / trace presentation
  trusted proof replay checker
```

Ключевые правила:

- `[]` имеет occurrence-local structural identity;
- `◁` и `▷` — роли текущего контекста, `↑` — подъём к внешнему контексту;
- canonical projection syntax: `♀F` и `F♂`;
- `interpret` read-only и не выполняет implicit `realize`;
- display label не является semantic identity;
- trusted `mts-proof/v0.2` rule set сейчас содержит только replay `interpret`;
- proof search, когда появится, обязан выдавать proof object для независимой проверки;
- legacy implementation после миграции не сохраняется как compatibility path.

## Нормативное определение

См. `netkeep80/anum_docs`. В `aprover` pinned contracts являются dependency/provenance boundary, а не отдельным определением МТС.
