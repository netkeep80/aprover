# МТС в aprover

`aprover` не является нормативным источником теории МТС.

Каноническое изложение теории, формальная нотация, root definitions и machine-readable contracts находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

Приложение потребляет pinned MTS v0.2 artifacts из `anum_docs` и не вводит собственные аксиомы, грамматику, Anum denotation или proof semantics как конкурирующий канон.

## Что документируется здесь

Этот каталог описывает только application integration и границы:

- `03-notations/03-string-anum.md` — `.astr` как UTF-8 application adapter;
- `03-notations/04-quaternary.md` — `.anum` как consumer `anum-raw-carrier/v0.2`.

Историю удалённых v0.1 theory/prover pages хранит Git; они не сохраняются как активная compatibility documentation.

## Runtime boundary

```text
anum_docs
  theory + formal notation
  mts-contract/v0.2 + conformance
  Anum L3 contracts + conformance
  mts-proof/v0.2
        │
        ▼
aprover
  lexer/parser consumer
  canonical AST
  ContextFrame + read-only MemoryView
  InterpretationSession
  presentation / occurrence-safe graph
  untrusted proof search
  independent trusted proof replay
```

Ключевые правила application boundary:

- `[]` имеет occurrence-local structural identity;
- `◁` и `▷` — роли текущего контекста, `↑` — подъём к внешнему контексту;
- canonical projection syntax: `♀F` и `F♂`;
- canonical link/inversion/inequality spellings: `⟼`, `¬F`, `!=`;
- `interpret` read-only и не выполняет implicit `realize`;
- display label не является semantic identity;
- `.anum` raw carrier не является denotation;
- proof search не является trusted semantics: его output обязан проходить independent `checkProof()`;
- legacy implementation после миграции не сохраняется как compatibility path.

## Нормативное определение

См. `netkeep80/anum_docs`. Pinned contracts в `aprover` являются dependency/provenance boundary, а не отдельным определением МТС.
