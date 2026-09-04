# A8.3b Opaque Parser Host-State Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the final parser-internal completed AST domain and AST identity bridge so canonical structured source is produced only as `SyntaxAset`, while preserving accepted grammar, provenance, diagnostics, normalization and application behavior.

**Architecture:** `Parser` continues to own lexer-driven grammar, precedence, associativity and diagnostics, but every grammar production returns only an opaque emitted-occurrence reference `{ occurrence, loc }`. `SyntaxAsetDirectEmitter` remains a separate materialization boundary and creates parent occurrences directly from child occurrence handles; the legacy AST formatter and AST normalizer are deleted after their useful tests are migrated to SyntaxAset-native observations.

**Tech Stack:** TypeScript 5.9, Vitest 4, Vue 3/Vite 7, Playwright 1.58, `@mts/core` SyntaxAset tooling.

**Spec:** `docs/superpowers/specs/2026-09-04-a8-3b-parser-host-state-design.md`

## Global Constraints

- Implementation issue: `#237`; parent P2 authority: `#233`.
- Accepted MTS semantics remain exactly `v0.11`.
- Active semantic candidate remains `NONE`; this work must not imply `v0.12`.
- No grammar redesign and no parser-generator migration.
- Ordinary parser host state remains allowed: tokens, cursor/position, lookahead, arrays/stacks/parse frames, source locations, `ParseError`, diagnostics and opaque occurrence handles.
- The reduction reference carries only occurrence handle + source location; it has no node-kind hierarchy, recursive child graph, visitor API or completed `File`/`Statement`/`Expr` product.
- `SyntaxAsetDirectEmitter` remains separate from `Parser`; do not move `SyntaxAsetBuilder` wholesale into the parser.
- No replacement `WeakMap` or other map keyed by a renamed recursive syntax object.
- `LinkHandle`, source offset, `VisualKey` or occurrence identity must not become proof identity.
- Do not change `src/core/proofApproval.ts`, `contracts/**`, consumer locks, `repo-policy.json`, `.github/**`, `package.json` or `package-lock.json`.
- Do not change `@mts/visual` authority or accepted trusted-proof behavior.
- Do not absorb A8.4 anti-regression governance into this transaction.
- Stay inside the exact ChangeIntent of #237. The prerequisite out-of-scope provenance test dependency was already removed by #239 / PR #240.
- First implementation commit is test-only and intentionally RED on the current architecture.

---

## File Structure

### Core files

- `src/core/parser.ts` — grammar and diagnostics only; grammar reductions become opaque occurrence references; public completed-AST parser APIs disappear.
- `src/core/syntaxAsetDirectEmitter.ts` — owns SyntaxAset vocabulary, carrier encoding, occurrence creation, provenance and final assembly; exposes narrow production-oriented operations to `Parser`.
- `src/core/normalizer.ts` — retains only SyntaxAset-native structural normalization/equality and guarded-recursion validation.
- Delete `src/core/ast.ts` — completed AST domain is removed, not archived as current code.
- Delete `src/core/astHelpers.ts` — no helper layer may reconstruct a second recursive syntax object model.
- Delete `src/core/mtsSource.ts` — AST-only source formatter is retired; current structural evidence is SyntaxAset-native.

### Tests

- `tests/unit/a8AstCompatibilityBoundary.test.ts` — first RED and final architectural boundary.
- `tests/unit/parser.test.ts` — grammar behavior observed through `parseSyntaxAset()` and `normalizeSyntaxAset()` or raw SyntaxAset occurrences.
- `tests/unit/mtsCompatibilityRemoval.test.ts` — removed spellings stay rejected; accepted spellings stay accepted without AST imports.
- `tests/unit/mtsCanonicalizationConformance.test.ts` — canonical structural output through SyntaxAset-native normalization.
- `tests/unit/quatAnum.test.ts` — `.anum` generated source parseability through `parseSyntaxAset()`.
- `tests/unit/normalizer.test.ts` — SyntaxAset-native normalization/equality/guarded-recursion only; delete AST-cache tests.
- `tests/unit/syntaxAsetDirectParser.test.ts` — retain direct parsing, provenance, distinct occurrences and fail-closed malformed-source evidence.

### Historical experiments

- Delete `experiments/test-error-location.ts`.
- Delete `experiments/test-error-location-detailed.ts`.

---

### Task 1: Commit a real architectural RED

**Files:**
- Modify: `tests/unit/a8AstCompatibilityBoundary.test.ts`

**Interfaces:**
- Consumes: current repository architecture after PR #240.
- Produces: deletion-driven assertions that fail specifically because the residual completed AST bridge still exists.

- [ ] **Step 1: Add the A8.3b architectural assertions**

Keep the existing A8.3a public-boundary tests and add this separate describe block:

```ts
describe('A8.3b parser-internal AST retirement', () => {
  it('has no completed AST domain files', () => {
    for (const path of [
      'src/core/ast.ts',
      'src/core/astHelpers.ts',
      'src/core/mtsSource.ts',
    ]) {
      expect(existsSync(repoPath(path)), path).toBe(false)
    }
  })

  it('has no completed-AST parser product or import', () => {
    const parser = readFileSync(repoPath('src/core/parser.ts'), 'utf8')

    expect(parser).not.toContain("from './ast'")
    expect(parser).not.toContain('export interface ParseResult')
    expect(parser).not.toContain('export function parse(')
    expect(parser).not.toContain('export function parseWithRecovery(')
    expect(parser).not.toContain('export function parseExpr(')
  })

  it('emits parent occurrences without AST object identity', () => {
    const emitter = readFileSync(repoPath('src/core/syntaxAsetDirectEmitter.ts'), 'utf8')

    expect(emitter).not.toContain("from './ast'")
    expect(emitter).not.toContain('ASTNode')
    expect(emitter).not.toContain('WeakMap<')
  })

  it('has no legacy AST normalization surface', () => {
    const normalizer = readFileSync(repoPath('src/core/normalizer.ts'), 'utf8')

    for (const legacy of [
      'export class NormalizationError',
      'export function normalize(',
      'export function normalizeFile(',
      'export function toCanonicalString(',
      'export function astEqual(',
      'export function getNormalizationCache(',
      'export function clearNormalizationCache(',
      'export function setNormalizationCacheEnabled(',
      'export function getNormalizationCacheStats(',
    ]) {
      expect(normalizer, legacy).not.toContain(legacy)
    }
  })
})
```

- [ ] **Step 2: Run the focused RED and record the expected defect**

Run:

```bash
npx vitest run tests/unit/a8AstCompatibilityBoundary.test.ts
```

Expected: FAIL only in the new A8.3b block because `ast.ts`, `astHelpers.ts`, `mtsSource.ts`, AST parser imports/products, `ASTNode`/`WeakMap` in the emitter and legacy normalizer APIs all still exist. Existing A8.3a assertions remain GREEN.

- [ ] **Step 3: Commit the RED without runtime changes**

```bash
git add tests/unit/a8AstCompatibilityBoundary.test.ts
git commit -m "test: prove residual parser AST architecture"
```

The commit must contain no `src/**`, `experiments/**`, docs, policy, package or contract changes.

---

### Task 2: Replace AST reductions with emitted occurrence references

**Files:**
- Modify: `src/core/syntaxAsetDirectEmitter.ts`
- Modify: `src/core/parser.ts`
- Modify: `tests/unit/parser.test.ts`
- Modify: `tests/unit/mtsCompatibilityRemoval.test.ts`
- Modify: `tests/unit/mtsCanonicalizationConformance.test.ts`
- Modify: `tests/unit/quatAnum.test.ts`
- Test: `tests/unit/syntaxAsetDirectParser.test.ts`

**Interfaces:**
- Consumes: `SourceLocation`, `LinkHandle`, current SyntaxAset vocabulary and `SyntaxAsetBuilder`.
- Produces: module-internal `SyntaxAsetReductionRef`, production-oriented emitter methods, and `parseSyntaxAset(input): SyntaxAsetParseResult` as the only structured parser product.

- [ ] **Step 1: Define the deliberately narrow reduction reference and production operation types**

At the top of `src/core/syntaxAsetDirectEmitter.ts`, remove every import from `./ast` and add:

```ts
import type { SourceLocation } from './sourceProvenance'

export interface SyntaxAsetReductionRef {
  readonly occurrence: LinkHandle
  readonly loc: SourceLocation
}

type UnaryProduction = 'Not' | 'Female' | 'Male'
type BinaryProduction = 'Link' | 'Definition' | 'Equality' | 'Inequality'
type ContainerProduction = 'Round' | 'Square'
type LiteralTag = 'Infinity' | 'Num' | 'Identifier' | 'AbitLit' | 'StringLit' | 'Literal'
```

`SyntaxAsetReductionRef` is exported only so `parser.ts` can type the host-state value. Do not re-export it from `src/core/index.ts`. It must never grow `kind`, children, payload fields or visitor methods.

- [ ] **Step 2: Replace AST-keyed storage with direct occurrence construction**

Delete:

```ts
private readonly occurrences = new WeakMap<ASTNode, LinkHandle>()
private child(node: ASTNode): LinkHandle
private add(node: ASTNode, ...): void
private literal(node: ASTNode, ...): void
emit(node: ASTNode): void
```

Use this primitive instead:

```ts
private add(
  kind: LinkHandle,
  fields: readonly { role: LinkHandle; value: LinkHandle }[],
  loc: SourceLocation
): SyntaxAsetReductionRef {
  const occurrence = this.builder.addOccurrence(kind, fields)
  this.provenance.set(occurrence, loc)
  return Object.freeze({ occurrence, loc })
}
```

- [ ] **Step 3: Add literal, pronoun and unary production methods**

Implement exactly the direct child-handle flow:

```ts
emitLiteral(tag: LiteralTag, value: string, loc: SourceLocation): SyntaxAsetReductionRef {
  return this.add(
    this.vocabulary.kinds.Literal,
    [
      {
        role: this.vocabulary.roles.value,
        value: this.encodeTextCarrier(`${tag}\u0000${value}`),
      },
    ],
    loc
  )
}

emitContextPronoun(
  pole: 'start' | 'end',
  up: number,
  loc: SourceLocation
): SyntaxAsetReductionRef {
  return this.add(
    this.vocabulary.kinds.ContextPronoun,
    [
      {
        role: this.vocabulary.roles.value,
        value: this.encodeTextCarrier(`ContextPronoun\u0000${pole}\u0000${up}`),
      },
    ],
    loc
  )
}

emitUnary(
  production: UnaryProduction,
  operand: SyntaxAsetReductionRef,
  loc: SourceLocation
): SyntaxAsetReductionRef {
  const kind =
    production === 'Not'
      ? this.vocabulary.kinds.Not
      : production === 'Female'
        ? this.vocabulary.kinds.Female
        : this.vocabulary.kinds.Male

  return this.add(
    kind,
    [{ role: this.vocabulary.roles.operand, value: operand.occurrence }],
    loc
  )
}
```

- [ ] **Step 4: Add direct binary production methods**

Implement role selection without constructing a node object:

```ts
emitBinary(
  production: BinaryProduction,
  left: SyntaxAsetReductionRef,
  right: SyntaxAsetReductionRef,
  loc: SourceLocation
): SyntaxAsetReductionRef {
  const kinds = this.vocabulary.kinds
  const roles = this.vocabulary.roles

  if (production === 'Link') {
    return this.add(
      kinds.Link,
      [
        { role: roles.start, value: left.occurrence },
        { role: roles.end, value: right.occurrence },
      ],
      loc
    )
  }
  if (production === 'Definition') {
    return this.add(
      kinds.Definition,
      [
        { role: roles.name, value: left.occurrence },
        { role: roles.body, value: right.occurrence },
      ],
      loc
    )
  }

  const kind = production === 'Equality' ? kinds.Equality : kinds.Inequality
  return this.add(
    kind,
    [
      { role: roles.left, value: left.occurrence },
      { role: roles.right, value: right.occurrence },
    ],
    loc
  )
}
```

- [ ] **Step 5: Add sequence, set, container and statement operations**

```ts
emitSequence(
  items: readonly SyntaxAsetReductionRef[],
  loc: SourceLocation
): SyntaxAsetReductionRef {
  return this.add(
    this.vocabulary.kinds.Sequence,
    items.map(item => ({ role: this.vocabulary.roles.item, value: item.occurrence })),
    loc
  )
}

emitSet(
  items: readonly SyntaxAsetReductionRef[],
  loc: SourceLocation
): SyntaxAsetReductionRef {
  return this.add(
    this.vocabulary.kinds.Set,
    items.map(item => ({ role: this.vocabulary.roles.item, value: item.occurrence })),
    loc
  )
}

emitContainer(
  production: ContainerProduction,
  content: SyntaxAsetReductionRef | null,
  loc: SourceLocation
): SyntaxAsetReductionRef {
  return this.add(
    production === 'Round' ? this.vocabulary.kinds.Round : this.vocabulary.kinds.Square,
    content === null
      ? []
      : [{ role: this.vocabulary.roles.expression, value: content.occurrence }],
    loc
  )
}

emitStatement(expr: SyntaxAsetReductionRef, loc: SourceLocation): SyntaxAsetReductionRef {
  return this.add(
    this.vocabulary.kinds.Statement,
    [{ role: this.vocabulary.roles.expression, value: expr.occurrence }],
    loc
  )
}
```

- [ ] **Step 6: Make `finish()` construct the file occurrence directly**

Replace `finish(file: File)` with:

```ts
finish(
  statements: readonly SyntaxAsetReductionRef[],
  fileLoc: SourceLocation
): SyntaxAsetParseResult {
  const file = this.add(
    this.vocabulary.kinds.File,
    statements.map(statement => ({
      role: this.vocabulary.roles.item,
      value: statement.occurrence,
    })),
    fileLoc
  )
  const aset = this.builder.finish(file.occurrence)
  const read = readSyntaxAset(this.memory, aset, this.vocabulary)
  return Object.freeze({
    memory: this.memory,
    vocabulary: this.vocabulary,
    aset,
    read,
    provenance: this.provenance,
  })
}
```

- [ ] **Step 7: Cut `Parser` grammar functions to `SyntaxAsetReductionRef`**

In `src/core/parser.ts`, remove all imports from `./ast`, remove `ParseResult`, `reduced()`, `parseFileWithRecovery()` and completed-AST return types. Import:

```ts
import {
  SyntaxAsetDirectEmitter,
  type SyntaxAsetParseResult,
  type SyntaxAsetReductionRef,
} from './syntaxAsetDirectEmitter'
```

Make the emitter required by `Parser`:

```ts
constructor(
  tokens: Token[],
  private readonly syntaxEmitter: SyntaxAsetDirectEmitter
) {
  this.tokens = tokens
}
```

Make file parsing finish the canonical product directly:

```ts
parseFile(): SyntaxAsetParseResult {
  const statements: SyntaxAsetReductionRef[] = []
  const startLoc = this.current().loc
  while (!this.check('EOF')) statements.push(this.parseStatement())
  return this.syntaxEmitter.finish(
    statements,
    this.mergeLoc(startLoc, this.current().loc)
  )
}
```

Rename the private grammar production from `parseExpr()` to `parseExpression()` so `parseExpr` disappears as a current parser API/name.

- [ ] **Step 8: Convert statement and infix grammar reductions**

Use emitted references directly:

```ts
private parseStatement(): SyntaxAsetReductionRef {
  const expr = this.parseExpression()
  let endLoc = expr.loc
  if (this.checkAny('COMMA', 'DOT')) endLoc = this.advance().loc
  return this.syntaxEmitter.emitStatement(expr, this.mergeLoc(expr.loc, endLoc))
}

private parseExpression(): SyntaxAsetReductionRef {
  const left = this.parseTerm()

  if (this.check('DEFINE')) {
    this.advance()
    const right = this.parseExpression()
    return this.syntaxEmitter.emitBinary(
      'Definition',
      left,
      right,
      this.mergeLoc(left.loc, right.loc)
    )
  }
  if (this.check('EQUAL')) {
    this.advance()
    const right = this.parseTerm()
    return this.syntaxEmitter.emitBinary(
      'Equality',
      left,
      right,
      this.mergeLoc(left.loc, right.loc)
    )
  }
  if (this.check('NOT_EQUAL')) {
    this.advance()
    const right = this.parseTerm()
    return this.syntaxEmitter.emitBinary(
      'Inequality',
      left,
      right,
      this.mergeLoc(left.loc, right.loc)
    )
  }
  return left
}
```

For `parseChain()`, replace each AST `Link` object with `emitBinary('Link', left, right, mergedLoc)`.

- [ ] **Step 9: Convert sequence, prefix/postfix and atoms**

`parseSequence()` keeps an ordinary local array of reduction refs:

```ts
private parseSequence(): SyntaxAsetReductionRef {
  const first = this.parsePref()
  const items: SyntaxAsetReductionRef[] = [first]

  while (
    FORM_STARTS.has(this.current().type) &&
    this.current().loc.start.line === items[items.length - 1].loc.end.line
  ) {
    items.push(this.parsePref())
  }

  if (items.length === 1) return first
  return this.syntaxEmitter.emitSequence(
    items,
    this.mergeLoc(first.loc, items[items.length - 1].loc)
  )
}
```

Keep the existing prefix descriptor stack as ordinary host state. Reduce each prefix with `emitUnary('Not' | 'Female', node, mergedLoc)` and postfix `♂` with `emitUnary('Male', node, mergedLoc)`.

Map atom tokens directly:

```ts
if (this.check('INFINITY')) {
  this.advance()
  return this.syntaxEmitter.emitLiteral('Infinity', '∞', token.loc)
}
if (this.check('ZERO')) {
  this.advance()
  return this.syntaxEmitter.emitLiteral('Num', '0', token.loc)
}
if (this.check('ONE')) {
  this.advance()
  return this.syntaxEmitter.emitLiteral('Num', '1', token.loc)
}
if (this.check('ID') || this.check('NAT')) {
  this.advance()
  return this.syntaxEmitter.emitLiteral('Identifier', token.value, token.loc)
}
if (this.check('ABIT_LIT')) {
  this.advance()
  return this.syntaxEmitter.emitLiteral('AbitLit', token.value, token.loc)
}
if (this.check('STRING_LIT')) {
  this.advance()
  return this.syntaxEmitter.emitLiteral('StringLit', token.value, token.loc)
}
```

- [ ] **Step 10: Convert pronouns and containers without node objects**

For context pronouns, count `CONTEXT_UP` tokens exactly as today and call:

```ts
return this.syntaxEmitter.emitContextPronoun(
  pole.type === 'CONTEXT_START' ? 'start' : 'end',
  up,
  this.mergeLoc(first.loc, pole.loc)
)
```

For round literals, emit the literal occurrence first and then the round occurrence:

```ts
const literal = this.syntaxEmitter.emitLiteral('Literal', literalToken.value, literalToken.loc)
return this.syntaxEmitter.emitContainer(
  'Round',
  literal,
  this.mergeLoc(opening.loc, closing.loc)
)
```

Empty `()` / `[]` pass `null`; non-empty containers pass the reduced content reference. Sets use an ordinary `SyntaxAsetReductionRef[]` and `emitSet()`.

- [ ] **Step 11: Delete public completed-AST parser functions**

The bottom of `parser.ts` must contain only the canonical structured parser entry point:

```ts
export function parseSyntaxAset(input: string): SyntaxAsetParseResult {
  const lexer = new Lexer(input)
  const emitter = new SyntaxAsetDirectEmitter()
  return new Parser(lexer.tokenize(), emitter).parseFile()
}
```

Keep `ParseError`. Delete exported `parse`, `parseWithRecovery`, `parseExpr` and `ParseResult`. Do not add a recovery/partial-tree replacement.

- [ ] **Step 12: Rewrite `parser.test.ts` around SyntaxAset observations**

Use:

```ts
import { LexerError } from '../../src/core/lexer'
import { ParseError, parseSyntaxAset } from '../../src/core/parser'
import { normalizeSyntaxAset } from '../../src/core/normalizer'

const canonical = (source: string) => normalizeSyntaxAset(parseSyntaxAset(source)).canonical
```

Preserve the grammar cases with these exact structural expectations:

```ts
expect(canonical('a ⟼ b ⟼ c')).toBe('((a⟼b)⟼c)')
expect(canonical('a ⟼ (b ⟼ c)')).toBe('(a⟼(b⟼c))')
expect(canonical('♀a')).toBe('♀a')
expect(canonical('a♂')).toBe('a♂')
expect(canonical('♀a♂')).toBe('♀a♂')
expect(canonical('¬¬a')).toBe('¬¬a')
expect(canonical('a = b')).toBe('(a=b)')
expect(canonical('a != b')).toBe('(a!=b)')
expect(canonical('a : b')).toBe('(a:b)')
expect(canonical('a : b = c')).toBe('(a:(b=c))')
expect(canonical('a : b : c')).toBe('(a:(b:c))')
expect(canonical('↑↑◁')).toBe('↑↑◁')
expect(canonical('{x,y}')).toBe('{x,y}')
expect(canonical('{y,x}')).toBe('{y,x}')
expect(canonical('{x,x}')).toBe('{x,x}')
expect(canonical('a{b,c}')).toBe('a{b,c}')
expect(canonical('{}b')).toBe('{}b')
expect(canonical('{}{}')).toBe('{}{}')
expect(canonical('[][]')).toBe('[][]')
expect(canonical('10 = [] ⟼ []')).toBe('(10=([]⟼[]))')
```

For distinct equal-looking square occurrences, assert SyntaxAset occurrence handles rather than object identity:

```ts
const parsed = parseSyntaxAset('{[] = ◁, [] = ▷}')
const squares = parsed.read.occurrences.filter(
  occurrence => occurrence.kind === parsed.vocabulary.kinds.Square
)
expect(squares).toHaveLength(2)
expect(squares[0].occurrence).not.toBe(squares[1].occurrence)
```

For newline boundaries, count current occurrences:

```ts
const parsed = parseSyntaxAset('a : {x = y}\nb : {y = x}')
expect(
  parsed.read.occurrences.filter(node => node.kind === parsed.vocabulary.kinds.Statement)
).toHaveLength(2)
```

Preserve `LexerError` rejection of `->`, `!->`, bare `!`, `¬=`, `≠`, power syntax and `ParseError` rejection of binary `↛`.

- [ ] **Step 13: Migrate compatibility, canonicalization and `.anum` tests**

In `mtsCompatibilityRemoval.test.ts`, remove `ASTNode`, `parseExpr` and `toMtsSource` imports. Keep lexer rejection cases and use:

```ts
expect(() => parseSyntaxAset('(↛)')).not.toThrow()
expect(() => parseSyntaxAset('a ↛ b')).toThrow(ParseError)
expect(() => parseSyntaxAset('a ⟼ b')).not.toThrow()
expect(() => parseSyntaxAset('¬a')).not.toThrow()
expect(() => parseSyntaxAset('a != b')).not.toThrow()
expect(() => parseSyntaxAset('(⟼)')).not.toThrow()
expect(() => parseSyntaxAset('(!=)')).not.toThrow()
```

Prove `(↛)` still materializes a round production:

```ts
const roundLiteral = parseSyntaxAset('(↛)')
expect(
  roundLiteral.read.occurrences.some(
    node => node.kind === roundLiteral.vocabulary.kinds.Round
  )
).toBe(true)
```

Delete the AST-node-kind compatibility test; Task 1 is the architecture authority.

In `mtsCanonicalizationConformance.test.ts`, use the same `canonical()` helper and these expected strings:

```ts
expect(canonical('↑ ↑  ◁')).toBe('↑↑◁')
expect(canonical('(=):{♀◁=♀▷,◁♂=▷♂}')).toBe('(=:{(♀◁=♀▷),(◁♂=▷♂)})')
expect(canonical('∞:{◁=∞,▷=∞}')).toBe('(∞:{(◁=∞),(▷=∞)})')
expect(canonical('(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}')).toBe(
  '(=:{(♀◁=♀▷),(◁♂=▷♂)})'
)
```

In `quatAnum.test.ts`, replace:

```ts
expect(() => parseExpr("'10'")).not.toThrow()
```

with:

```ts
expect(() => parseSyntaxAset("'10'")).not.toThrow()
```

and change only the parser import accordingly.

- [ ] **Step 14: Run parser-facing focused tests**

Run:

```bash
npx vitest run \
  tests/unit/parser.test.ts \
  tests/unit/mtsCompatibilityRemoval.test.ts \
  tests/unit/mtsCanonicalizationConformance.test.ts \
  tests/unit/quatAnum.test.ts \
  tests/unit/syntaxAsetDirectParser.test.ts \
  tests/unit/sourceProvenance.test.ts
```

Expected: PASS. `a8AstCompatibilityBoundary.test.ts` remains RED because the legacy files and normalizer half have not been removed yet.

- [ ] **Step 15: Commit the parser/emitter cutover**

```bash
git add \
  src/core/parser.ts \
  src/core/syntaxAsetDirectEmitter.ts \
  tests/unit/parser.test.ts \
  tests/unit/mtsCompatibilityRemoval.test.ts \
  tests/unit/mtsCanonicalizationConformance.test.ts \
  tests/unit/quatAnum.test.ts
git commit -m "refactor: cut parser reductions to SyntaxAset handles"
```

`tests/unit/syntaxAsetDirectParser.test.ts` is added only if its content actually changes; do not touch it merely to inflate evidence.

---

### Task 3: Delete the AST normalizer and keep only SyntaxAset-native normalization

**Files:**
- Modify: `src/core/normalizer.ts`
- Modify: `tests/unit/normalizer.test.ts`

**Interfaces:**
- Consumes: `SyntaxAsetParseResult`, `LinkHandle`, `SourceLocation`.
- Produces: `NormalizerOptions`, `SyntaxAsetNormalizationError`, `SyntaxAsetNormalizationResult`, `normalizeSyntaxAset()`, `syntaxAsetEqual()` only.

- [ ] **Step 1: Replace AST imports with provenance-only types**

The start of `normalizer.ts` becomes:

```ts
import type { LinkHandle } from '@mts/core'
import type { SourceLocation } from './sourceProvenance'
import type { SyntaxAsetParseResult } from './syntaxAsetDirectEmitter'
```

Delete every import from `./ast`.

- [ ] **Step 2: Delete the entire AST normalizer/cache surface**

Remove:

```text
NormalizationCache
normalizationCache
getNormalizationCache()
clearNormalizationCache()
setNormalizationCacheEnabled()
getNormalizationCacheStats()
NormalizationError
containsIdent(ASTNode,...)
checkGuardedRecursion(DefExpr)
normalizeNode()
generateCacheKey()
normalize(AST)
normalizeFile()
toCanonicalString(AST)
astEqual()
```

Keep this options contract because the SyntaxAset path uses it:

```ts
export interface NormalizerOptions {
  checkGuardedRecursion?: boolean
}

const defaultOptions: NormalizerOptions = {
  checkGuardedRecursion: true,
}
```

Keep the existing SyntaxAset carrier decoding, occurrence validation, guarded recursion, `normalizeSyntaxAset()` and `syntaxAsetEqual()` logic unchanged except for mechanical imports/types.

- [ ] **Step 3: Rewrite `normalizer.test.ts` as a SyntaxAset-only corpus**

Use only:

```ts
import { describe, expect, it } from 'vitest'
import { parseSyntaxAset } from '../../src/core/parser'
import {
  SyntaxAsetNormalizationError,
  normalizeSyntaxAset,
  syntaxAsetEqual,
} from '../../src/core/normalizer'

const canonical = (source: string) => normalizeSyntaxAset(parseSyntaxAset(source)).canonical
```

Retain these exact behavioral assertions:

```ts
expect(canonical('a ⟼ b ⟼ c')).toBe(canonical('(a ⟼ b) ⟼ c'))
expect(canonical('(a)')).toBe(canonical('a'))
expect(canonical('()')).toBe('()')
expect(canonical('¬¬x')).toBe('¬¬x')
expect(canonical('¬x♂')).toBe('¬x♂')
expect(canonical('¬♀x')).toBe('¬♀x')
expect(canonical('a ⟼ b')).toBe('(a⟼b)')
expect(canonical('a != b')).toBe('(a!=b)')
expect(canonical('{x,y}')).toBe('{x,y}')
expect(canonical('{y,x}')).toBe('{y,x}')
expect(canonical('{x,x}')).toBe('{x,x}')
expect(canonical('{x,x}')).not.toBe(canonical('{x}'))
expect(canonical('a ⟼ b ⟼ c')).not.toBe(canonical('a ⟼ (b ⟼ c)'))
expect(canonical('[1]')).toBe('[1]')
expect(canonical('↑◁')).toBe('↑◁')
```

Retain structural equality:

```ts
expect(syntaxAsetEqual(parseSyntaxAset('(a ⟼ b)'), parseSyntaxAset('a ⟼ b'))).toBe(true)
expect(syntaxAsetEqual(parseSyntaxAset('a ⟼ b'), parseSyntaxAset('b ⟼ a'))).toBe(false)
expect(syntaxAsetEqual(parseSyntaxAset('¬¬x'), parseSyntaxAset('x'))).toBe(false)
expect(syntaxAsetEqual(parseSyntaxAset('{x,y}'), parseSyntaxAset('{y,x}'))).toBe(false)
```

Retain guarded recursion directly on SyntaxAset:

```ts
expect(() => normalizeSyntaxAset(parseSyntaxAset('abc : abc ⟼ x'))).not.toThrow()
expect(() => normalizeSyntaxAset(parseSyntaxAset('x : x'))).toThrow(
  SyntaxAsetNormalizationError
)
expect(() => normalizeSyntaxAset(parseSyntaxAset('myvar : myvar♂'))).toThrow(
  SyntaxAsetNormalizationError
)
expect(() =>
  normalizeSyntaxAset(parseSyntaxAset('x : x'), { checkGuardedRecursion: false })
).not.toThrow()
```

Retain provenance identity:

```ts
const parsed = parseSyntaxAset('(a ⟼ b)')
const normalized = normalizeSyntaxAset(parsed)
expect(normalized.provenance).toBe(parsed.provenance)
expect(normalized.provenance.size).toBeGreaterThan(0)
```

Delete all AST differential-oracle and normalization-cache tests rather than recreating a cache or AST compatibility layer.

- [ ] **Step 4: Run the focused normalizer suite**

Run:

```bash
npx vitest run tests/unit/normalizer.test.ts
```

Expected: PASS with only SyntaxAset-native normalization APIs.

- [ ] **Step 5: Commit the normalizer cutover**

```bash
git add src/core/normalizer.ts tests/unit/normalizer.test.ts
git commit -m "refactor: remove legacy AST normalizer"
```

---

### Task 4: Delete the completed AST domain and prove the full A8.3b boundary

**Files:**
- Delete: `src/core/ast.ts`
- Delete: `src/core/astHelpers.ts`
- Delete: `src/core/mtsSource.ts`
- Delete: `experiments/test-error-location.ts`
- Delete: `experiments/test-error-location-detailed.ts`
- Verify/modify only if needed: `tests/unit/a8AstCompatibilityBoundary.test.ts`
- Verify: all tests listed in #237 plus current editor/graph E2E.

**Interfaces:**
- Consumes: parser/emitter and normalizer cutovers from Tasks 2–3.
- Produces: current tree with no completed AST domain, AST identity map, AST formatter or recovery product.

- [ ] **Step 1: Search for live consumers before deletion**

Run:

```bash
git grep -nE "from ['\"](\.\./)*.*core/ast['\"]|from ['\"]\./ast['\"]|from ['\"]\./astHelpers['\"]|from ['\"]\./mtsSource['\"]|parseWithRecovery\(|parseExpr\(|toMtsSource\(|astEqual\(|getNormalizationCache\(" -- src tests experiments || true
```

Expected current-code matches: only intentional string literals inside `tests/unit/a8AstCompatibilityBoundary.test.ts` that assert the retired names are absent. Any import/call match is a blocker and must be fixed inside an already-listed #237 file before deletion; do not broaden scope.

- [ ] **Step 2: Delete the obsolete files**

```bash
git rm \
  src/core/ast.ts \
  src/core/astHelpers.ts \
  src/core/mtsSource.ts \
  experiments/test-error-location.ts \
  experiments/test-error-location-detailed.ts
```

Do not create replacement compatibility files.

- [ ] **Step 3: Run the architectural boundary that began RED**

```bash
npx vitest run tests/unit/a8AstCompatibilityBoundary.test.ts
```

Expected: PASS. The same assertions from Task 1 now prove:

```text
ast.ts / astHelpers.ts / mtsSource.ts = absent
parser AST import/products             = absent
ASTNode / WeakMap identity bridge      = absent
legacy AST normalizer API              = absent
```

- [ ] **Step 4: Run all focused A8.3b evidence**

```bash
npx vitest run \
  tests/unit/a8AstCompatibilityBoundary.test.ts \
  tests/unit/syntaxAsetDirectParser.test.ts \
  tests/unit/parser.test.ts \
  tests/unit/normalizer.test.ts \
  tests/unit/mtsCompatibilityRemoval.test.ts \
  tests/unit/mtsCanonicalizationConformance.test.ts \
  tests/unit/quatAnum.test.ts \
  tests/unit/sourceProvenance.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full static, unit, build and editor/graph E2E verification**

Run:

```bash
npm run lint:check
npm run type-check
npm test
npm run build
npm run test:e2e
```

Expected: all commands PASS. The Playwright suite is the current editor/graph integration evidence; do not weaken or skip it.

- [ ] **Step 6: Verify forbidden surfaces are untouched**

Run:

```bash
git diff --name-only main...HEAD
```

Expected changed paths are a subset of #237 only. In particular, output must not contain:

```text
src/core/proofApproval.ts
contracts/
package.json
package-lock.json
repo-policy.json
.github/
```

Also inspect consumer lock files via the PR diff and confirm there is no repin. CI must later show the existing exact `@mts/core` and `@mts/visual` consumer-lock jobs GREEN.

- [ ] **Step 7: Commit physical retirement**

```bash
git add -A
git commit -m "refactor: delete completed AST domain"
```

- [ ] **Step 8: Run final residual audit after the commit**

Run:

```bash
git grep -nE "ASTNode|WeakMap<ASTNode|parseWithRecovery\(|export function parseExpr\(|toMtsSource\(|export function astEqual\(|export function normalizeFile\(|getNormalizationCache\(" -- src tests experiments || true
```

Expected: no implementation occurrence. Intentional negative-test string literals in `a8AstCompatibilityBoundary.test.ts` are acceptable and must be read as assertions, not authority.

Also verify the required files are physically absent:

```bash
test ! -e src/core/ast.ts
test ! -e src/core/astHelpers.ts
test ! -e src/core/mtsSource.ts
test ! -e experiments/test-error-location.ts
test ! -e experiments/test-error-location-detailed.ts
```

Expected: all commands exit 0.

- [ ] **Step 9: Verify the exact implementation PR head before Ready**

The implementation PR remains Draft through RED/GREEN development. On the final exact head require:

```text
CI = GREEN
exact @mts/core consumer-lock job = GREEN
exact @mts/visual consumer-lock job = GREEN
all focused/full tests = GREEN
trusted proof files = untouched
contracts/locks/policy/workflows = untouched
```

Then mark the PR Ready for review so blocking repo-guard runs on that exact head.

- [ ] **Step 10: Apply the repository merge gate**

Before merge fresh-read `main`, #237, the implementation PR, `repo-policy.json`, exact-head workflow runs, comments, reviews and review threads. Require:

```text
CI GREEN
repo-guard GREEN
behind_by = 0
mergeable = true
comments/reviews/threads clean or resolved
```

Merge with `expected_head_sha=<the freshly verified exact PR head>`; never merge an unverified moved head.

- [ ] **Step 11: Perform post-merge acceptance and issue state transition**

Fresh-read `main`, the merged implementation PR and #237. Confirm the merge commit contains no forbidden surface and no post-merge workflow failure.

Close #237 as completed only after the fresh tree satisfies:

```text
canonical structured-source product      = SyntaxAset only
parser grammar temporary product          = opaque occurrence refs only
completed AST domain files                = absent
AST identity mapping in emitter           = absent
legacy AST parser/recovery API            = absent
legacy AST normalizer/cache/equality API  = absent
canonical grammar behavior                = preserved
source provenance                         = preserved
malformed source                          = fail-closed
current editor + graph                    = green
trusted proof boundary                    = untouched
core + visual consumer locks              = unchanged and green
accepted MTS semantics                    = v0.11 unchanged
active semantic candidate                 = NONE
```

Keep #233 OPEN. The next transaction is the separately scoped A8.4 anti-regression boundary; do not implement it in #237.

---

## Self-Review

### Spec coverage

- Architectural RED: Task 1.
- Opaque occurrence refs with no child graph/kind hierarchy: Task 2 Steps 1–10.
- Parser/emitter responsibility split: Task 2.
- Removal of `WeakMap<ASTNode,...>`: Task 2 Steps 1–6.
- Removal of `parse`, `parseExpr`, `parseWithRecovery`, `ParseResult`: Task 2 Step 11.
- Grammar preservation: Task 2 Steps 12–14.
- SyntaxAset-only normalizer and guarded recursion: Task 3.
- Provenance preservation: Tasks 2–3 and existing direct/provenance tests.
- AST/formatter/experiment deletion: Task 4 Steps 1–3.
- Full lint/type/unit/build/E2E and exact consumer locks: Task 4 Steps 4–10.
- Trusted proof/MTS v0.11/no-v0.12/A8.4 vetoes: Global Constraints and Task 4 acceptance.

### Placeholder scan

The plan contains no `TBD`, `TODO`, deferred implementation placeholders, generic “add validation” instructions or undefined neighboring interfaces. All new parser/emitter interfaces used by later steps are defined in Task 2.

### Type consistency

`SyntaxAsetReductionRef` is defined once in `syntaxAsetDirectEmitter.ts` and consumed by `parser.ts`. It always has exactly `occurrence: LinkHandle` and `loc: SourceLocation`. Parent emitter operations consume those refs directly and never require AST objects.

## Execution Handoff

Execute this plan inline with `superpowers:executing-plans` because this session has the live GitHub governance context and no separate subagent runtime. Before changing implementation code, read/use `superpowers:test-driven-development`; create a fresh implementation branch from post-plan-merge `main`; keep the implementation PR Draft through the architectural RED and migration, and make it Ready only on an exact GREEN head.
