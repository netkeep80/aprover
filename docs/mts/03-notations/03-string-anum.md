# `.astr` в aprover

> **Статус:** application-specific adapter. Это не нормативная нотация МТС и не отдельная теория ачисел.

Каноническая формальная нотация, accepted contracts и semantic runtime определяются в [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs). Current semantic authority `aprover` — exact-pinned `@mts/core` v0.10; `.astr` не вводит собственной MTS semantics.

## Назначение

`.astr` — удобный UTF-8 формат приложения: каждая содержательная строка рассматривается как одно строковое значение и проецируется в **тот же application AST**, который использует `.mtl`.

Текущая presentation-проекция одной строки `s`:

```text
(∞ ⟼ "s")
```

Для пустого значения используется `∞`.

Это правило — API/UI convention `aprover`, а не утверждение, что каждый UTF-8 символ является отдельной онтологической сущностью МТС. Приложение не вводит посимвольную цепочку, отдельные аксиомы символов или второй semantic runtime.

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
- создаёт shared `LinkExpr(Infinity, StringLit)` для presentation;
- умеет восстановить строковое значение из этого узкого application shape;
- генерирует canonical MTS source для presentation;
- не содержит собственной MTS semantics.

Публичные функции доступны через `src/core/index.ts`.

## Граница доверия

`.astr` сам по себе не участвует в theorem acceptance. Parse/presentation остаются consumer-only операциями. Если результат должен участвовать в семантической проверке или доказательстве, authority должна исходить из current accepted `@mts/core` и будущего generic approver (#156), а не из `.astr` adapter.

## См. также

- [`docs/mts/README.md`](../README.md) — архитектурная граница `anum_docs → aprover`;
- [`04-quaternary.md`](04-quaternary.md) — `.anum` transport/presentation adapter;
- [`netkeep80/anum_docs`](https://github.com/netkeep80/anum_docs) — нормативная теория и contracts.
