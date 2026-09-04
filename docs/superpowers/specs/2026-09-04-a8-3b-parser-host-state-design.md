# A8.3b — Remove the parser-internal AST domain bridge

Date: 2026-09-04

Issue: #237  
Parent: #233  
Accepted predecessor: #235 / PR #236  
Upstream architectural authority: `netkeep80/anum_docs#944`

## Status

The architectural direction was approved in chat on 2026-09-04. This document freezes that direction before implementation planning.

Implementation must not begin until this written specification is reviewed and accepted.

## Baseline

Exact repository baseline when A8.3b was opened:

```text
aprover main = f22c7bb7dcaba4f1ee5e6d314920aeb38cd90697
A8.3a accepted = PR #236
#235 = completed
#233 = open
repo-policy = blocking
accepted MTS semantics = v0.11
active semantic candidate = NONE
```

A8.1-A8.2 removed the legacy viewer, ordinary LinkGraph and Cytoscape runtime. A8.3a removed completed-AST public compatibility exports, AST-only application adapters and the expired AST -> SyntaxAset migration oracle.

The application itself is already on the canonical path:

```text
source
 -> parseSyntaxAset()
 -> SyntaxAsetParseResult(memory, aset, provenance)
 -> rooted VisualLinkNetwork
 -> presentation
```

The remaining AST is internal parser machinery rather than a public application product, but it is still a complete second structural domain model. A8.3b removes that final parser-internal domain bridge.

## Problem

`parser.ts` currently constructs a complete object graph using `ASTNode`, `File`, `Statement`, `LinkExpr`, `DefExpr`, `SetExpr`, container nodes and literal nodes. Every grammar production returns one of those objects.

`SyntaxAsetDirectEmitter` then uses those AST objects as identity-bearing keys:

```text
WeakMap<ASTNode, LinkHandle>
```

Children are emitted first, stored against AST object identity, and parent emission looks those children up by object identity.

This path does not traverse a completed AST after parsing, but the parser nevertheless materializes a complete AST-shaped domain graph. That creates exactly the residual authority A8.3 is intended to retire.

A separate legacy AST normalizer also remains beside the accepted SyntaxAset-native normalizer.

## Design goals

A8.3b must produce this architecture:

```text
Lexer
 -> ordinary parser algorithm state
 -> grammar reduction
 -> SyntaxAset emission
 -> opaque reduction reference
 -> parent grammar reduction
 -> SyntaxAsetParseResult
```

The parser must retain normal implementation state where useful:

```text
tokens
cursor / position
lookahead
prefix stack / parse frames
source locations
ParseError and diagnostics
opaque emitted-occurrence handles
```

Those values are algorithmic host state, not a second MTS or syntax authority.

The parser must no longer construct or expose a durable completed syntax tree apart from canonical SyntaxAset.

## Non-goals and vetoes

A8.3b does not redesign the grammar and does not introduce a parser generator.

It does not require all parser state to become Links. Tokens, integers, arrays used as parse stacks, temporary source spans and exceptions remain ordinary TypeScript values.

It must not change:

```text
accepted MTS semantics
trusted proof rules
src/core/proofApproval.ts
contracts or consumer locks
@mts/visual authority boundary
source offsets into semantic proof identity
MTS versioning
```

In particular, this work does not create or imply MTS v0.12. Accepted MTS remains v0.11 with no active semantic candidate.

A8.4 anti-regression governance is a later transaction and must not be folded into this implementation.

## Selected approach: opaque occurrence reductions

The selected design replaces AST-shaped grammar return values with a deliberately narrow private reduction reference.

Conceptually:

```ts
interface ReductionRef {
  readonly occurrence: LinkHandle
  readonly loc: SourceLocation
}
```

The exact TypeScript shape may be smaller if `loc` can be carried elsewhere, but it must obey these constraints:

```text
NO node-kind hierarchy
NO recursive child fields
NO File / Statement / Expr product
NO syntax-domain visitor API
NO object identity used as canonical syntax identity
```

A reduction reference means only: this grammar production has already emitted one SyntaxAset occurrence, and this is the minimal handle/source-span state needed for a parent production.

The `LinkHandle` remains an occurrence reference inside the SyntaxAset being built. It is not proof identity and does not confer semantic authority on the parser.

## Parser/emitter boundary

`SyntaxAsetDirectEmitter` remains a separate unit from `Parser`. This preserves a useful isolation boundary:

- `Parser` owns grammar, token consumption, precedence, associativity and diagnostics.
- `SyntaxAsetDirectEmitter` owns SyntaxAset vocabulary/materialization, literal carrier encoding, occurrence creation and final SyntaxAset assembly.

A8.3b must not solve AST removal by moving `SyntaxAsetBuilder` internals wholesale into `Parser`.

The preferred emitter API is production-oriented. A representative shape is:

```text
emitLiteral(tag, value, loc) -> ReductionRef
emitContextPronoun(pole, up, loc) -> ReductionRef
emitUnary(kind, operand, loc) -> ReductionRef
emitBinary(kind, left, right, loc) -> ReductionRef
emitSequence(items, loc) -> ReductionRef
emitSet(items, loc) -> ReductionRef
emitContainer(kind, content | null, loc) -> ReductionRef
emitStatement(expr, loc) -> ReductionRef
finish(statements, fileLoc) -> SyntaxAsetParseResult
```

Names may differ during implementation. The invariant matters more than the exact method list: parent creation consumes occurrence references directly, never AST objects.

The current `WeakMap<ASTNode, LinkHandle>` disappears. No replacement map keyed by a renamed AST object is acceptable.

## Grammar behavior

Grammar behavior must remain observationally unchanged.

The migration preserves at least:

- canonical `⟼` precedence and left associativity;
- definition as the weakest right-associative canonical infix operator;
- equality and inequality behavior;
- prefix `¬` and `♀` behavior;
- postfix `♂` behavior;
- same-line juxtaposition / sequence behavior;
- bundle order and multiplicity;
- explicit round and square containers;
- round literals such as `(=)`, `(!=)`, `(⟼)`, `(↛)`, `([)`, `(])`;
- current and ancestor context pronouns;
- numeric identifier handling;
- newline as the application-level statement boundary;
- rejection of removed compatibility spellings such as `->`, `!->`, bare `!`, `≠`, binary `↛`, and power syntax.

A8.3b is therefore a representation migration, not a grammar migration.

## Error handling

The current application error boundary is already suitable for AST removal:

```text
LexerError -> loc
ParseError -> token.loc
```

`parseSyntaxAset()` remains fail-closed. A malformed source must not return a partial canonical SyntaxAset product.

The removed `parseWithRecovery()` API is not replaced with a new partial tree product. If a future editor requirement needs incremental/recovery parsing, that must be designed separately around canonical SyntaxAset/provenance rather than retaining a historical AST compatibility surface.

The two historical error-location scripts under `experiments/` are not current runtime/build consumers and may be deleted. Their only useful property—precise error position—is already covered by `ParseError.token.loc` and application behavior.

## Normalizer cutover

`normalizer.ts` currently contains two paths:

```text
legacy AST normalizer/cache/equality/stringification
accepted SyntaxAset-native normalization/equality
```

A8.3b removes the legacy AST half.

The retained current API is:

```text
NormalizerOptions needed by SyntaxAset-native behavior
SyntaxAsetNormalizationError
SyntaxAsetNormalizationResult
normalizeSyntaxAset()
syntaxAsetEqual()
```

Required retained semantics include:

- non-empty round transparency where currently accepted;
- empty round form remaining atomic;
- structural rather than invented semantic equivalence;
- bundle order and multiplicity preservation;
- guarded-recursion validation directly on SyntaxAset structure;
- preservation of the external provenance map.

The old AST normalization cache APIs, `normalize(AST)`, `normalizeFile`, `toCanonicalString`, `astEqual` and AST-specific error types are deleted once their useful behavior assertions have migrated.

No renamed AST cache or adapter is introduced.

## Files removed after migration

The target current tree deletes:

```text
src/core/ast.ts
src/core/astHelpers.ts
src/core/mtsSource.ts
experiments/test-error-location.ts
experiments/test-error-location-detailed.ts
```

`src/core/ast.ts` must not survive as a type-only compatibility archive. Git history is the compatibility archive.

`src/core/astHelpers.ts` must not be replaced with helpers that reconstruct the same recursive syntax object model under a new name.

`src/core/mtsSource.ts` must not remain merely to support AST round-trip tests. Current canonical structural presentation/equality evidence belongs on the SyntaxAset-native path.

## Test migration map

A8.3b uses TDD with an architectural RED before implementation.

### RED boundary

The first test-only change must prove the actual residual architecture on exact opening main. At minimum it must fail because:

1. `ast.ts`, `astHelpers.ts` and `mtsSource.ts` still exist;
2. `parser.ts` imports AST domain types or exposes AST parser products;
3. `syntaxAsetDirectEmitter.ts` refers to `ASTNode` or `WeakMap<ASTNode, ...>`;
4. `normalizer.ts` still exposes legacy AST normalization/equality/stringification APIs.

The RED must not be synthetic and must not fail unrelated tests.

### Parser corpus

`tests/unit/parser.test.ts` currently contains useful grammar behavior coupled to AST inspection and `toMtsSource()`.

Preserve the behavioral cases, but re-express them through direct SyntaxAset structure/canonicalization and ParseError/LexerError observations. AST node-kind assertions are removed rather than recreated with a private node hierarchy.

### Normalizer corpus

`tests/unit/normalizer.test.ts` must become SyntaxAset-native only.

Retain tests for:

- canonical structure output;
- structural equality and inequality;
- grouping behavior;
- guarded recursion;
- provenance preservation.

Delete tests whose only purpose is validating the retired AST cache or AST API.

### Compatibility grammar tests

`tests/unit/mtsCompatibilityRemoval.test.ts` continues to prove that removed spellings remain rejected and accepted canonical spellings remain accepted. It must no longer import `ASTNode`, `parseExpr()` or `toMtsSource()`.

### Canonicalization conformance

`tests/unit/mtsCanonicalizationConformance.test.ts` must assert canonical output through the SyntaxAset-native path.

### Carrier adapters

`.astr` tests already use `parseSyntaxAset()` and need no architectural fallback.

The remaining `.anum` parseability check in `tests/unit/quatAnum.test.ts` migrates from `parseExpr()` to `parseSyntaxAset()`.

### Direct parser/provenance evidence

`tests/unit/syntaxAsetDirectParser.test.ts` remains key evidence for:

- accepted source corpus;
- provenance on emitted occurrences;
- distinct equal-looking occurrences;
- fail-closed malformed input.

It may absorb parser cases when that produces clearer coverage, but tests should remain focused rather than becoming one monolithic file.

## Implementation sequence

The implementation plan should preserve these dependencies:

1. Add the architectural RED test and demonstrate the expected failure.
2. Introduce the opaque reduction reference and production-oriented emitter operations without changing grammar behavior.
3. Cut parser grammar functions from AST return values to reduction references.
4. Delete completed-AST parser APIs (`parse`, `parseExpr`, `parseWithRecovery`, `ParseResult`) after all current tests/consumers are migrated.
5. Migrate parser/compatibility/canonicalization/carrier tests to SyntaxAset observations.
6. Remove the AST half of `normalizer.ts` and migrate its tests.
7. Delete `ast.ts`, `astHelpers.ts`, `mtsSource.ts` and obsolete experiments.
8. Run full lint/typecheck/unit/build/E2E and exact immutable core/visual lock checks.
9. Make the PR Ready only after the implementation head is GREEN; then require blocking repo-guard GREEN before merge.

This sequence may be split into multiple implementation commits, but it remains one bounded #237 transaction. It must not absorb A8.4.

## Acceptance criteria

A8.3b is accepted only when fresh exact-head evidence proves:

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

After A8.3b merges, #237 closes as completed. Parent #233 stays open for a separate A8.4 anti-regression transaction and final A8 completion audit.

## Rejected alternatives

### Rename AST to `ParseNode`

Rejected. A recursively typed node hierarchy carrying syntax kinds and children would preserve the same second domain model under a new name. It would satisfy a filename grep but not the architectural goal.

### Inline the whole emitter into `Parser`

Rejected. It removes a file boundary but unnecessarily couples grammar ownership to SyntaxAset storage/materialization internals. The parser/emitter separation remains useful and testable.

### Keep AST only for tests / formatting

Rejected. Current tests must validate the accepted current architecture rather than keeping a production compatibility model alive solely for historical test convenience.

### Remove all ordinary parser objects

Rejected. AST-free does not mean host-state-free. Eliminating tokens, arrays, locations and ordinary parsing frames would add complexity without improving authority boundaries.

## Follow-up

A8.4 will add the smallest robust anti-regression boundary preventing reintroduction of the retired AST/LinkGraph/Cytoscape architecture. It is intentionally not specified or implemented here beyond that sequencing constraint.
