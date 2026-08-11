# `.anum` в aprover

> **Статус:** consumer accepted `anum-stream-deserialization/v0.3` из `anum_docs`.

`aprover` не определяет собственную семантику абит. Нормативный raw/channel stream contract закреплён byte-exact в единственном current snapshot `contracts/anum_docs-v0.5/`.

## Четыре абита и неявный корень

Transport-алфавит ровно:

```text
[ ] 1 0
```

`R = ∞` не является пятым передаваемым абитом. Каждый deserialization context автоматически начинается с `R`.

Обязательные следствия current contract:

```text
des(ε)  = R
des([]) = R
R = R ⟼ R
```

`1` разрешается в единственную canonical `L`, `0` — в единственную canonical `U`. Повтор позиции не создаёт новую semantic link:

```text
1110 -> [L, L, L, U]
```

Три позиции `1` используют один semantic `L`.

## Stream interpreter

В **этом конкретном raw/channel interpreter** символы имеют операционные роли:

```text
[ -> OPEN
] -> CLOSE
1 -> VALUE(L)
0 -> VALUE(U)
```

Это не объявляет `[` и `]` универсальными opcodes всей МТС.

Каждый frame хранит `started` и `current`, начально `false` и `R`. Первый `VALUE(v)` делает `current=v`; последующие значения сворачиваются слева через `Link(current,v)`. Пустой `CLOSE` возвращает `R`; непустой возвращает `Link(R,inner)`. Вложенный результат поступает во внешний frame как одно значение.

Примеры:

```text
""       -> R
"1"      -> L
"10"     -> L ⟼ U
"[]"     -> R
"[10]"   -> R ⟼ (L ⟼ U)
"[[10]]" -> R ⟼ (R ⟼ (L ⟼ U))
```

Незакрытая `[` и неожиданная `]` являются ошибками semantic stream execution.

## Semantic identity

`Link(A,B)` в deserializer — чистый semantic constructor:

```text
Link(A,B) = Link(C,D) iff A=C and B=D
```

Поэтому `Link(R,R)=R`. Source offset, stack frame, JavaScript object и UI transport node id не создают вторую связь.

`deserializeAnumStream()` не имеет доступа к `MemoryView`, `realize` или `delete`. Поиск/denotation и materialization остаются разными операциями.

## Transport presentation в UI

`src/core/quatAnum.ts` намеренно уже семантики: это lossless application adapter, который очищает whitespace/comments и сохраняет исходную последовательность четырёх абитов для редактора/визуализации.

Его `RawCarrierNode.id` — только позиционный presentation id. Например `][` можно сохранить как raw transport input, но `deserializeAnumStream('][')` затем отвергнет его как `unexpected-close`.

То есть:

```text
transport presentation != semantic Link identity
lexical preservation     != successful deserialization
```

## Поведение UI

Панель `Anum stream deserialization v0.3` показывает для каждой строки:

- semantic result;
- resolved `L/U` values;
- последовательность `OPEN/CLOSE/VALUE`;
- максимальную глубину stack.

Occurrence-tree node ids, quote/relative modes и canonical inverse из старого ANUM v0.2 API удалены, а не сохранены как compatibility mode.

## Исполняемая проверка

`tests/unit/anumDenotation.test.ts` непосредственно исполняет embedded conformance vectors vendored `anum-stream-deserialization/v0.3`. `tests/unit/quatAnum.test.ts` отдельно проверяет только lossless transport-presentation boundary.

## Deferred boundary

Current v0.3 принимает raw/channel stream input. Вход из уже существующей связи-носителя асети и доказательство его эквивалентности stream execution остаются отдельной задачей `anum_docs#333`; `aprover` не изобретает эту семантику локально.
