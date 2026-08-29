# A3b SyntaxAset Visual Cutover Design

Date: 2026-08-28
Issue: #230
Parents: #168, #183
Opening main: `0b569f5f64a164fe91489fadaca11676a07d5241`

## Status and intent

This design implements the next bounded visual cutover after the accepted A4 editor/source-map migration.

Current accepted building blocks already exist:

- direct canonical `parseSyntaxAset()` state in `App.vue`;
- `SyntaxAsetParseResult.memory` + explicit `SyntaxAsetParseResult.aset` root;
- exact independent `@mts/visual` consumer lock;
- accepted `projectSemanticMemoryToVisualLinkNetwork()` for genuine whole semantic `Memory` snapshots;
- accepted `VisualLinkNetworkViewer.vue` shared Three/live-physics host.

A3b changes only the application graph runtime source. It does not change accepted MTS semantics or trusted proof behavior.

## Problem

The editor and diagnostics already use canonical direct SyntaxAset state, but the Graph pane still follows the legacy path:

```text
source
 -> parseWithRecovery()
 -> legacy AST
 -> normalize(AST)
 -> ordinary LinkGraph
 -> Cytoscape
```

This keeps the old graph model alive in the current UI even though it is no longer canonical parser state.

The existing whole-Memory semantic projector cannot be reused blindly for SyntaxAset because `SyntaxAsetParseResult.memory` also owns syntax tooling vocabulary and carrier infrastructure. Projecting `memory.allLinks()` would include unrelated/unreachable state and would blur the distinction between syntax tooling structure and accepted semantic structure.

## Decision

Add one presentation-only rooted topology projector:

```ts
projectRootedLinkClosureToVisualLinkNetwork(
  memory: Pick<Memory, 'poles'>,
  root: LinkHandle,
): VisualLinkNetwork
```

The projector walks only the transitive start/end pole closure reachable from the explicit `root` Link.

Application Graph becomes:

```text
source
 -> parseSyntaxAset()
 -> SyntaxAsetParseResult
 -> projectRootedLinkClosureToVisualLinkNetwork(memory, aset)
 -> VisualLinkNetworkViewer
 -> exact accepted @mts/visual Three runtime
```

This is a syntax presentation projection. Syntax kind/role/carrier Links remain tooling/syntax identity and do not become accepted semantic MTS authority merely because they are visualized.

## Rooted closure algorithm

Traversal is deterministic pre-order over Link topology:

1. visit `root`;
2. assign it the next presentation index on first sight;
3. read `memory.poles(link)`;
4. visit `start` before `end`;
5. stop recursion for already-seen handles;
6. after discovery, emit one `VisualLink` for every discovered Link using its assigned presentation key.

Presentation keys use a dedicated prefix such as:

```text
rooted-link:0
rooted-link:1
...
```

The index is traversal/presentation order only. It is not semantic identity, proof identity, SyntaxAset occurrence identity, source identity, or a persistent external key.

The algorithm must not call `allLinks()`, `linkCount`, `issuanceIndex()`, parser/string conversion, AST helpers, `LinkGraph`, or Cytoscape.

## Required invariants

The rooted projector must satisfy all of the following:

- root is always included;
- every emitted Link has both endpoint Links included;
- self-recursive, start-self-closed and end-self-closed topology terminates safely;
- DAG sharing is emitted once, not duplicated;
- same in-memory rooted topology produces the same ordered `VisualLinkNetwork` on repeated projection;
- unreachable Memory Links are absent;
- input Memory topology is unchanged;
- `VisualLinkNetwork` passes shared visual validation;
- no source offset, AST object/path, array position, VisualKey, or host cache key is promoted to semantic/proof identity.

## App integration

`App.vue` already owns:

```ts
const canonicalSyntax = ref<SyntaxAsetParseResult | null>(null)
```

Add a computed presentation value derived only from canonical state:

```ts
const graphNetwork = computed(() =>
  canonicalSyntax.value === null
    ? null
    : projectRootedLinkClosureToVisualLinkNetwork(
        canonicalSyntax.value.memory,
        canonicalSyntax.value.aset,
      ),
)
```

Graph enablement remains fail-closed and should depend on canonical parsing, not `legacyViewerAst`:

```text
canonicalSyntax != null
AND parsedStatementCount > 0
```

Replace application instances of:

```vue
<LinkGraphViewer :ast="legacyViewerAst" />
```

with the accepted shared host:

```vue
<VisualLinkNetworkViewer v-if="graphNetwork" :network="graphNetwork" />
```

`legacyViewerAst` remains temporarily for `ASTViewer` only. A3b must not use it for graph enablement, graph data, diagnostics, or visual topology.

## Error behavior

Canonical parse failure already sets `canonicalSyntax` to `null`. Therefore graph state automatically becomes `null` and no shared graph surface is mounted. The legacy recovery AST may still exist for transitional AST inspection, but it must not re-enable or repopulate Graph after canonical parse failure.

Renderer errors remain presentation failures. They do not modify proof state, semantic Memory, SyntaxAset, or acceptance decisions.

## Legacy boundary after A3b

After this slice the current runtime is:

```text
Editor
 -> direct SyntaxAset
     +-> occurrence/source provenance -> editor highlighting
     +-> rooted VisualLinkNetwork -> shared @mts/visual

legacy AST
 -> ASTViewer only
```

The following files remain in-tree but are no longer application Graph authority:

```text
src/core/linkGraph.ts
src/components/LinkGraphViewer.vue
```

They are not modified in A3b. Their deletion, Cytoscape dependency removal, and legacy barrel export removal belong to later A8/current-only cleanup after repository-wide consumer revalidation.

## Tests

### Unit projector corpus

Extend `tests/unit/visualLinkNetwork.test.ts` with rooted-topology tests covering:

- minimal recursive root;
- nested links-of-links;
- start-self-closed and end-self-closed links;
- shared endpoint/DAG reuse without duplicate output;
- endpoint-key closure;
- repeated deterministic projection;
- unreachable link exclusion;
- unchanged poles/topology after projection;
- shared `validateVisualLinkNetwork()` acceptance.

The RED commit must import/call the new projector before production implementation so CI fails specifically because the export/function is absent.

### E2E application corpus

Update the existing Graph test in `tests/e2e/editor.spec.ts` to prove:

- canonical parsed source enables Graph;
- clicking Graph mounts `[data-visual-link-network-surface]`;
- `.link-graph-viewer` / legacy Cytoscape viewer is not mounted;
- syntax errors fail closed for graph enablement/state;
- AST inspection remains available when canonical source is valid.

The existing application CI, exact core verifier, exact visual verifier, build and Chromium E2E remain mandatory.

## Files in scope

Expected implementation files:

```text
src/core/visualLinkNetwork.ts
src/core/index.ts
src/App.vue
tests/unit/visualLinkNetwork.test.ts
tests/e2e/editor.spec.ts
```

Design/plan artifacts:

```text
docs/superpowers/specs/2026-08-28-a3b-syntax-aset-visual-cutover-design.md
docs/superpowers/plans/2026-08-28-a3b-syntax-aset-visual-cutover.md
```

## Hard non-goals

A3b does not authorize:

- modifying or deleting `src/core/linkGraph.ts`;
- modifying or deleting `src/components/LinkGraphViewer.vue`;
- modifying `ASTViewer.vue`;
- removing legacy graph public exports yet;
- changing semantic lowering;
- constructing semantic Memory from UI/source strings;
- AST -> VisualLinkNetwork or LinkGraph -> VisualLinkNetwork adapters;
- proofApproval/proofSearch changes;
- contract or consumer-lock repins;
- `package.json` / `package-lock.json` changes;
- workflow or repository-policy changes;
- accepted MTS semantic delta or v0.12 implication.

## Completion boundary

A3b is complete when exact-head CI and blocking repo-guard are green, the application Graph is sourced solely from canonical SyntaxAset rooted topology through `VisualLinkNetworkViewer`, `legacyViewerAst` feeds only AST inspection, and the guarded merge is confirmed on `main`.

A3b completion does not mean A8 completion: legacy AST viewer, LinkGraph files/exports and Cytoscape dependency remain explicit cleanup obligations.