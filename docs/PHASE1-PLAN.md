# План разработки: Фаза 1

Этот документ содержит детальный план первой фазы разработки aprover.

## Этап 1.1: Инициализация проекта (Week 1)

- [x] Создать репозиторий с CLAUDE.md
- [x] Инициализировать Vue.js 3 + TypeScript + Vite проект
- [x] Настроить ESLint + Prettier
- [x] Настроить GitHub Actions для CI/CD
- [x] Настроить GitHub Pages деплой

**Критерии успеха:**
- `npm run dev` запускает локальный сервер
- `npm run build` создает production сборку
- Автодеплой на GitHub Pages при push в main

## Этап 1.2: Лексер формальной нотации (Week 1-2)

Реализовать лексер согласно EBNF из [спецификации МТС v0.1](mts/specification-v0.1.md):

```typescript
// Типы токенов
type TokenType =
  | 'ARROW'        // ->
  | 'NOT_ARROW'    // !->
  | 'DEFINE'       // :
  | 'EQUAL'        // =
  | 'NOT_EQUAL'    // != | ≠ | ¬=
  | 'MALE'         // ♂
  | 'FEMALE'       // ♀
  | 'NOT'          // ! | ¬
  | 'POWER'        // ^
  | 'INFINITY'     // ∞
  | 'ZERO'         // 0
  | 'ONE'          // 1
  | 'LPAREN'       // (
  | 'RPAREN'       // )
  | 'LBRACE'       // {
  | 'RBRACE'       // }
  | 'LBRACKET'     // [
  | 'RBRACKET'     // ]
  | 'COMMA'        // ,
  | 'DOT'          // .
  | 'CHAR_LIT'     // 'c'
  | 'ID'           // идентификатор
  | 'NAT'          // натуральное число
  | 'EOF'
```

**Критерии успеха:**
- Лексер корректно токенизирует все примеры из `tests/mtl_formulas.mtc`
- Unit-тесты покрывают граничные случаи

## Этап 1.3: Парсер формальной нотации (Week 2-3)

Реализовать рекурсивный спуск согласно EBNF:

```typescript
// AST узлы
interface ASTNode {
  type: string;
  loc: SourceLocation;
}

interface LinkExpr extends ASTNode {
  type: 'Link';
  left: ASTNode;
  right: ASTNode;
}

interface DefExpr extends ASTNode {
  type: 'Definition';
  name: ASTNode;
  form: ASTNode;
}

interface EqExpr extends ASTNode {
  type: 'Equality';
  left: ASTNode;
  right: ASTNode;
  negated: boolean;
}

interface MaleExpr extends ASTNode {
  type: 'Male';
  operand: ASTNode;
}

interface FemaleExpr extends ASTNode {
  type: 'Female';
  operand: ASTNode;
}

interface NotExpr extends ASTNode {
  type: 'Not';
  operand: ASTNode;
}

interface PowerExpr extends ASTNode {
  type: 'Power';
  base: ASTNode;
  exponent: number;
}

interface SetExpr extends ASTNode {
  type: 'Set';
  elements: ASTNode[];
}

interface InfinityExpr extends ASTNode {
  type: 'Infinity';
}

interface IdentExpr extends ASTNode {
  type: 'Identifier';
  name: string;
}
```

**Ключевые правила парсинга:**
- Левоассоциативность `->` и `!->`
- Правоассоциативность `♂`
- Левоассоциативность `♀`
- Приоритет: `()` > `^` > `♀` > `♂` / `!` / `¬` > `->` / `!->` > `:` / `=` / `!=`

**Критерии успеха:**
- Парсер строит корректное AST для всех примеров из `tests/mtl_formulas.mtc`
- Сообщения об ошибках с позицией в исходном коде

## Этап 1.4: Нормализация и проверка well-formedness (Week 3)

Реализовать:

1. **Десахаризация:**
   - `¬` → `!` (синоним)
   - `a !-> b` → `!(a -> b)`
   - `a^n` → `(...((a -> a) -> a) ... -> a)` (n раз)

2. **Проверка guarded recursion:**
   - В `s : F` рекурсивное упоминание `s` в `F` разрешено только под `->`

3. **Каноническая форма:**
   - Приведение вложенных `!!x` к `x`
   - Приведение `!(♂x)` к `x♀` и `!(x♀)` к `♂x`

**Критерии успеха:**
- Нормализатор преобразует AST в каноническую форму
- Диагностика ошибок guarded recursion

## Этап 1.5: Ядро прувера (Week 4)

Минимальное ядро доказательств:

```typescript
interface ProverState {
  axioms: Map<string, ASTNode>;      // Встроенные аксиомы
  definitions: Map<string, ASTNode>; // Определения s : F
  facts: Set<string>;                // Доказанные факты (каноническая форма)
}

// Единственный фундаментальный шаг вывода:
// (MP) если доказано P и существует (P -> Q), то доказано Q
function modusPonens(state: ProverState, p: ASTNode, pToQ: ASTNode): ASTNode | null;

// Проверка равенства через структурную унификацию
function unify(a: ASTNode, b: ASTNode): Substitution | null;

// Применение подстановки
function applySubstitution(node: ASTNode, subst: Substitution): ASTNode;

// Резолюция запроса
function resolve(state: ProverState, query: ASTNode): ASTNode | null;
```

**Критерии успеха:**
- Прувер может проверить равенства из `tests/mtl_formulas.mtc`
- Сообщения о причинах успеха/неудачи проверки

## Этап 1.6: Веб-интерфейс (Week 4-5)

Компоненты Vue:

1. **Editor** — CodeMirror/Monaco редактор с подсветкой синтаксиса `.mtl`
2. **ASTViewer** — визуализация AST в виде дерева
3. **ProverPanel** — интерактивный вывод доказательств
4. **ErrorPanel** — отображение ошибок парсинга/проверки

**Критерии успеха:**
- Интерактивный редактор с подсветкой синтаксиса
- Визуализация AST при изменении кода
- Пошаговый вывод доказательств

## Этап 1.7: Тестирование и документация (Week 5-6)

1. **Unit-тесты:**
   - Лексер: все типы токенов
   - Парсер: все конструкции EBNF
   - Нормализатор: все правила преобразования
   - Прувер: все аксиомы, modus ponens, унификация

2. **Интеграционные тесты:**
   - Полный цикл: текст → AST → нормализация → проверка
   - Все примеры из `tests/mtl_formulas.mtc`

3. **E2E тесты:**
   - Playwright тесты веб-интерфейса

**Критерии успеха:**
- Покрытие тестами >= 80%
- Все тесты проходят в CI

---

## Ход работ

### 2026-02-13: Фаза 1 — Основная реализация

**Этап 1.1: Инициализация проекта** — Завершено
- Создан план первой фазы реализации
- Определена архитектура системы
- Подготовлена структура проекта (Vue.js 3 + TypeScript + Vite)
- Настроен ESLint + Prettier для форматирования кода
- Настроен GitHub Actions для CI/CD
- Настроен GitHub Pages деплой

**Этап 1.2: Лексер** — Завершено
- Реализован лексический анализатор для формальной нотации МТС
- Поддержаны все типы токенов (операторы, символы, идентификаторы)
- Написаны unit-тесты (29 тестов)

**Этап 1.3: Парсер** — Завершено
- Реализован парсер рекурсивного спуска
- Поддержаны все конструкции EBNF
- Корректная обработка приоритетов и ассоциативности
- Написаны unit-тесты (29 тестов)

**Этап 1.4: Нормализатор** — Завершено
- Десахаризация (!->, ^n)
- Приведение к канонической форме (!!x → x, !♂x → x♀)
- Проверка guarded recursion
- Написаны unit-тесты (19 тестов)

**Этап 1.5: Ядро прувера** — Завершено
- Modus Ponens
- Структурная унификация
- Аксиомы МТС v0.1
- Написаны unit-тесты (27 тестов)

**Этап 1.6: Веб-интерфейс** — Базовая версия
- Простой редактор (textarea)
- Отображение результатов проверки
- Подсветка успешных/неуспешных результатов

**Этап 1.7: Тестирование и документация** — В процессе
- Интеграционные тесты для полного цикла (текст → AST → нормализация → проверка)
- Тестирование формул из `tests/mtl_formulas.mtc`
- Создан файл примеров `examples/basic.mtl`
- Задокументированы ограничения текущей реализации

**Итого:** 137 тестов проходят успешно (104 unit + 33 интеграционных)
