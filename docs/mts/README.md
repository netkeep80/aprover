# МТС в aprover

`aprover` не является нормативным источником теории МТС. Каноническое изложение, accepted contracts и semantic runtime находятся в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs).

Текущая consumer authority закреплена `contracts/mts-core-consumer-lock.json`:

```text
anum_docs commit = 957c818d82bd3211f2a59547fff28e8ed0ec4331
MTS contract     = mts-contract/v0.10
MTS conformance  = mts-conformance/v0.10
@mts/core        = 0.10.0
```

## Что документируется здесь

Этот каталог описывает только application integration и границы:

- `03-notations/03-string-anum.md` — `.astr` как UTF-8 application adapter;
- `03-notations/04-quaternary.md` — `.anum` как transport presentation с semantic execution через public `@mts/core`.

Историю удалённых runtime/proof/version surfaces хранит Git; она не поддерживается параллельным compatibility code.

## Runtime boundary

```text
accepted anum_docs / exact @mts/core v0.10
                    │
                    ▼
                 aprover
  lexer/parser/AST + canonical presentation
  file/transport adapters
  ANUM presentation diagnostics
  visualization
```

Application invariants:

- parser/AST/UI не являются semantic authority;
- canonical link/inversion/inequality spellings: `⟼`, `¬F`, `!=`;
- display label, source position и graph id не создают semantic Link identity;
- ANUM transport имеет ровно четыре абита `[ ] 1 0`;
- current raw ANUM execution делегируется public `@mts/core` API;
- `.anum` transport-position ids отделены от semantic denotation;
- старый local interpreter/memory/value-bundle runtime отсутствует;
- старый `mts-proof/v0.3`/`v0.4` replay и proof search отсутствуют.

## Proof boundary

После R1.3 текущего theorem-acceptance API ещё нет. Новый trusted approver должен быть построен поверх accepted upstream derivation semantics в `aprover#156`. Multi-step search и theorem library принадлежат следующему слою `aprover#157` и остаются untrusted относительно approver.

```text
candidate search/import
        │
        ▼
future generic approver (#156)
        │
        ▼
accepted @mts/core / MTS semantics
```

## Current-only policy

```text
current tree -> current architecture only
Git history  -> historical implementation/evidence
```

Vendored historical semantic snapshots и executable compatibility runtimes не являются частью текущей архитектуры.

## Нормативное определение

См. `netkeep80/anum_docs`. `contracts/mts-core-consumer-lock.json` — dependency/provenance boundary, а не отдельное определение МТС.
