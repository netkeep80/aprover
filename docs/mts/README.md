# МТС в aprover

`aprover` не является нормативным источником теории МТС.

Каноническое изложение теории, формальная нотация, root definitions и machine-readable contracts находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

Приложение потребляет pinned MTS v0.2 contract и conformance corpus из `anum_docs` и не должно вводить собственные аксиомы, грамматику или интерпретацию как конкурирующий канон.

## Что относится к aprover

В этом каталоге остаётся только документация, необходимая для самого приложения:

- `03-notations/03-string-anum.md` — прикладной формат `.astr`;
- `03-notations/04-quaternary.md` — прикладной формат `.anum`;
- `05-prover/` — техническая документация UI/proof machinery приложения.

Формальная нотация МТС в коде определяется pinned contract, а не prose-файлами `aprover`.

## Канонический runtime boundary

```text
anum_docs
  theory + formal notation
  mts-contract/v0.2
  mts-conformance/v0.2
        │
        ▼
aprover
  lexer/parser consumer
  canonical AST
  ContextFrame + read-only MemoryView
  InterpretationSession
  substitutions / aliases / resolution trace UI
  proof search/check application layer
```

Ключевые правила границы:

- `[]` имеет occurrence-local structural identity;
- `◁` и `▷` — роли текущего бинарного контекста, `↑` — подъём к внешнему контексту;
- canonical projection syntax: `♀F` и `F♂`;
- `interpret` read-only и не выполняет implicit `realize`;
- display label не является semantic identity;
- после миграции consumers legacy implementation удаляется, а не сохраняется как compatibility path.

## Где искать нормативное определение

См. `netkeep80/anum_docs`, в первую очередь опубликованные versioned contract/conformance artifacts и активную теоретическую документацию. Историю удалённых v0.1-текстов `aprover` при необходимости хранит Git.
