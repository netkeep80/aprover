# `.astr` в aprover

> **Статус:** application-specific adapter. Это не нормативная нотация МТС и не отдельная теория ачисел.

Каноническая формальная нотация, root definitions и machine-readable contracts определяются в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs). `aprover` не выводит из `.astr` новых аксиом и не использует собственную grammar/semantics поверх МТС v0.2.

## Назначение

`.astr` — удобный UTF-8 формат приложения: каждая содержательная строка рассматривается как одно строковое значение и проецируется в **тот же canonical AST**, который использует `.mtl`.

Текущая presentation-проекция одной строки `s`:

```text
(∞ ⟼ "s")
```

Для пустого значения используется `∞`.

Это правило — API/UI convention `aprover`, а не утверждение, что каждый UTF-8 символ является отдельной онтологической сущностью МТС. В частности, приложение не вводит посимвольную цепочку, отдельные аксиомы символов или второй parser.

## Пример

Вход:

```text
связь
Hello, мир!
```

Presentation в редакторе:

```mtl
(∞ ⟼ "связь").
(∞ ⟼ "Hello, мир!").
```

Используется только canonical link glyph `⟼`. ASCII `->` не является compatibility spelling.

## Реализация

`src/core/stringAnum.ts`:

- читает line-oriented UTF-8 application data;
- создаёт shared `LinkExpr(Infinity, StringLit)`;
- умеет восстановить строковое значение из этого узкого application shape;
- генерирует canonical MTS source для presentation;
- не содержит собственной MTS semantics.

Публичные функции доступны через `src/core/index.ts`.

## Граница доверия

`.astr` не участвует в trusted proof semantics сам по себе. После проекции дальнейшие parse/interpret/replay выполняются обычным canonical runtime `aprover`, закреплённым на contracts из `anum_docs`.

## См. также

- [`docs/mts/README.md`](../README.md) — архитектурная граница `anum_docs → aprover`;
- [`04-quaternary.md`](04-quaternary.md) — `.anum` как raw-carrier adapter;
- [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs) — нормативная теория и contracts.
