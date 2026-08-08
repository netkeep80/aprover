# `.anum` в aprover

> **Статус:** consumer `anum-raw-carrier/v0.2`. Нормативная denotation находится только в `anum_docs`.

`aprover` не определяет собственную семантику абит и не разворачивает `0`, `1`, `[`, `]` в локальные формулы МТС. Канонические contracts закреплены в `contracts/anum_docs-v0.2/` вместе с provenance.

## Raw carrier

На transport-уровне `.anum` использует четыре символа:

```text
0  1  [  ]
```

Accepted contract `anum-raw-carrier/v0.2` задаёт для них protocol roles:

```text
role:abit:0
role:abit:1
role:abit:[
role:abit:]
```

Конструкция carrier-а:

```text
current = role:root
for each raw abit x:
    node[i] = Link(current, role:abit:x)
    current = node[i]
```

Identity узлов occurrence-local и последовательная. Display glyph не является persistent/global identity.

## Raw carrier не равен denotation

Это принципиальная граница v0.2:

```text
raw carrier  ≠  denotation
```

Поэтому application layer **не** вводит таблицу вроде:

```text
[ = ...
] = ...
1 = ...
0 = ...
```

и не реализует отдельную recursive semantics.

Следующие pinned artifacts принадлежат upstream `anum_docs`:

- `anum-raw-carrier-v0.2.json`;
- `anum-boundary-projection-v0.2.json`;
- `anum-denotation-v0.2.json`;
- `anum-pair-denotation-v0.2.json`;
- `anum-recursive-denotation-v0.2.json`;
- соответствующие conformance corpora.

`aprover` обязан потреблять их, а не реконструировать правила независимо.

## Важное следствие: баланс скобок

Баланс `[`/`]` **не является raw-carrier invariant**. Например:

```text
][
```

— допустимая последовательность transport abits. Имеет ли она структурную denotation и какую именно — вопрос более позднего contracted L3 layer.

Следовательно, `src/core/quatAnum.ts` на raw-уровне проверяет только:

- алфавит `0`, `1`, `[`, `]`;
- whitespace/comments как presentation noise.

Он не пытается интерпретировать скобки.

## Поведение UI

Для существующего редактора `.anum` показывается lossless как `AbitLit`:

```text
01   →   '01'
][   →   ']['
```

Это **presentation bridge**, а не перевод carrier-а в L2 denotation. Поэтому такой вывод не содержит `⟼`, `♀` или `♂` и не претендует на доказательство структуры raw Anum.

Панель conversion показывает последовательное построение raw carrier:

```text
node 0: role:root → role:abit:0
node 1: node 0    → role:abit:1
```

## Исполняемая проверка

`tests/unit/quatAnum.test.ts` выполняет vendored `anum-raw-carrier-conformance-v0.2.json` напрямую. Это veto против расхождения application adapter и upstream contract.

## Что намеренно отсутствует

В `aprover` нет локальных:

- `ABIT_DEFINITIONS`;
- `quatAnumToFormal()` с собственной MTS semantics;
- `parseAbitToAST()` с hard-coded denotation;
- implicit `realize`;
- второго parser-а для MTS;
- assumptions о global identity абит.

Если приложению понадобится полноценная recursive denotation `.anum`, она должна быть реализована как consumer pinned L3 conformance, отдельным integration slice, без копирования теории.

## См. также

- [`docs/mts/README.md`](../README.md) — граница теории и приложения;
- [`03-string-anum.md`](03-string-anum.md) — `.astr` application adapter;
- [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs) — нормативная теория и L3 contracts.
