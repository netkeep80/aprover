# `.anum` в aprover

> **Статус:** application transport/presentation adapter с semantic execution через exact-pinned `@mts/core` v0.10.

`aprover` не определяет собственную семантику абит. Current semantic authority закреплена `contracts/mts-core-consumer-lock.json` и public `@mts/core` API.

## Четыре абита и неявный корень

Transport-алфавит ровно:

```text
[ ] 1 0
```

`R = ∞` не является пятым передаваемым абитом. Каждый deserialization context автоматически начинается с `R`.

Current regression boundary сохраняет:

```text
des(ε)  = R
des([]) = R
R = R ⟼ R
```

`1` разрешается в canonical `L`, `0` — в canonical `U`. Повтор transport-позиции не создаёт новую semantic link:

```text
1110 -> [L, L, L, U]
```

## Semantic execution

`src/core/anumDenotation.ts` вызывает public `deserializeStream(..., symbolicStackAlgebra)` из exact `@mts/core` v0.10.

`aprover` добавляет только presentation-level данные:

```text
raw input
maximum nesting depth
diagnostic offset/token for rejected input
```

Link construction, stack transitions, resolved semantic values и denotation принадлежат upstream runtime и не реализуются повторно локально.

Незакрытая `[` и неожиданная `]` отвергаются upstream semantic execution.

## Semantic identity

Source offset, stack frame, JavaScript object и UI transport node id не создают semantic Link identity.

`deserializeAnumStream()` не имеет собственного Memory/materialization layer; это тонкий consumer adapter над public upstream operation.

## Transport presentation в UI

`src/core/quatAnum.ts` намеренно уже семантики: это lossless application adapter, который очищает whitespace/comments и сохраняет исходную последовательность четырёх абитов для редактора/визуализации.

Его `RawCarrierNode.id` — только позиционный presentation id. Lexical preservation не означает успешную semantic deserialization.

```text
transport presentation != semantic Link identity
lexical preservation     != semantic acceptance
```

## Исполняемая проверка

`tests/unit/anumDenotation.test.ts` содержит небольшой **current regression corpus** и для каждого semantic case сверяет application adapter непосредственно с public `@mts/core` v0.10 result. Тест не читает historical vendored MTS snapshot.

`tests/unit/quatAnum.test.ts` отдельно проверяет только lossless transport/presentation boundary.

## Version policy

Публичный ANUM schema tag, который сейчас экспонирует consumer adapter, — `anum-deserialization/v0.4`. Номер transport schema не означает наличие отдельного v0.4 runtime: semantic authority приложения остаётся exact `@mts/core@0.10.0` под MTS contract v0.10.

Исторические ANUM implementations и snapshots хранятся в Git history, а не как compatibility mode текущего приложения.
