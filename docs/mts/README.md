# МТС в aprover

`aprover` не является нормативным источником теории МТС. Каноническое изложение, root definitions и machine-readable contracts находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

Приложение потребляет текущий accepted release `mts-contract/v0.6`; единственный публичный proof format — `mts-proof/v0.4`; current raw/channel ANUM surface — `anum-deserialization/v0.4`. Собственные аксиомы или compatibility semantics здесь не вводятся.

## Что документируется здесь

Этот каталог описывает только application integration и границы:

- `03-notations/03-string-anum.md` — `.astr` как UTF-8 application adapter;
- `03-notations/04-quaternary.md` — `.anum` transport presentation + consumer accepted stream v0.3.

Историю удалённых prover/version/ANUM surfaces хранит Git; они не сохраняются как активная compatibility documentation.

## Runtime boundary

```text
anum_docs current accepted release
  mts-contract/v0.6
  mts-proof/v0.4
  opening-path + direct-deixis contracts
  anum-deserialization/v0.4
        │ exact pin
        ▼
aprover
  lexer/parser + canonical AST
  ContextFrame + read-only MemoryView
  InterpretationSession
  pure ANUM stream deserializer
  untrusted proof search
  independent mts-proof/v0.4 replay
```

Ключевые application invariants:

- `◁` и `▷` задают роли текущего контекста, `↑` — подъём к внешнему контексту;
- canonical link/inversion/inequality spellings: `⟼`, `¬F`, `!=`;
- interpretation read-only и не выполняет implicit materialization;
- display label и технический `LinkRef` не создают отдельную semantic identity;
- ANUM имеет ровно четыре абита `[ ] 1 0`, root не является пятым состоянием;
- `des(ε)=R`, `des([])=R`, semantic Link identity задаётся ordered poles;
- `.anum` transport-position ids отделены от semantic denotation;
- proof search не является trusted semantics: его current `mts-proof/v0.4` output обязан проходить independent replay;
- legacy proof/ANUM implementations после миграции удаляются из рабочего дерева.

## Versioned transitive dependencies

Единый current vendor snapshot может содержать schema с собственным старшим номером `v0.2`, если current upstream release явно продолжает её требовать. Сейчас это base `mts-conformance/v0.2` и accepted flat `mts-value-bundle/v0.2`. Это provenance dependency, а не отдельный runtime/version mode.

## Нормативное определение

См. `netkeep80/anum_docs`. Pinned contracts в `aprover` — dependency/provenance boundary, а не отдельное определение МТС.
