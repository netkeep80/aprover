# A3b SyntaxAset Visual Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the application Graph consume only the pole-closed topology rooted at canonical direct `SyntaxAsetParseResult.aset` and render it through the already-accepted shared `VisualLinkNetworkViewer`.

**Architecture:** Add a generic presentation-only `Memory.poles()` rooted-closure projector beside the existing whole-semantic-Memory projector. `App.vue` computes the graph network from `canonicalSyntax.memory + canonicalSyntax.aset`, removes `LinkGraphViewer` from application runtime, and keeps `legacyViewerAst` only for `ASTViewer`. Legacy LinkGraph/Cytoscape files remain untouched for later A8 cleanup.

**Tech Stack:** TypeScript 5.9, Vue 3.5, Vitest 4, Playwright 1.58, exact-pinned `@mts/core`, exact-pinned `@mts/visual`, Vite 7.

**Spec:** `docs/superpowers/specs/2026-08-28-a3b-syntax-aset-visual-cutover-design.md`

## Global Constraints

- Opening baseline is `aprover/main = 0b569f5f64a164fe91489fadaca11676a07d5241`; refresh live GitHub state before every repository write/lifecycle transition.
- Work item is `aprover#230`; do not duplicate an overlapping A3b PR.
- Accepted MTS semantics remain unchanged; no v0.12 implication.
- `src/core/proofApproval.ts` and `src/core/proofSearch.ts` must not change.
- `src/core/linkGraph.ts`, `src/components/LinkGraphViewer.vue`, and `src/components/ASTViewer.vue` must not change in this slice.
- Consumer locks, package manifests, workflows and `repo-policy.json` must not change.
- The new graph path must not use AST, ordinary LinkGraph, Cytoscape, reverse source parsing, source offsets or VisualKeys as semantic/proof identity.
- Use TDD: retain one valid RED exact head before production implementation.
- Merge only after exact-head full CI + blocking repo-guard, `behind_by=0`, `mergeable=true`, `draft=false`, stable head and `expected_head_sha` guarded merge.

---

### Task 1: Rooted Link closure -> VisualLinkNetwork projector

**Files:**
- Modify: `tests/unit/visualLinkNetwork.test.ts`
- Modify: `src/core/visualLinkNetwork.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: `Memory.poles(link: LinkHandle)`, opaque `LinkHandle`, and `normalizeVisualLinkNetwork()`.
- Produces:

```ts
export function projectRootedLinkClosureToVisualLinkNetwork(
  memory: Pick<Memory, 'poles'>,
  root: LinkHandle,
): VisualLinkNetwork
```

- Presentation key format: `rooted-link:${index}` where `index` is deterministic first-visit preorder (`root`, then `start`, then `end`).

- [ ] **Step 1: Add RED unit imports and minimal missing-function test**

Change the unit import to:

```ts
import {
  projectRootedLinkClosureToVisualLinkNetwork,
  projectSemanticMemoryToVisualLinkNetwork,
} from '../../src/core/visualLinkNetwork'
```

Add this test before implementation:

```ts
describe('rooted Link closure -> VisualLinkNetwork', () => {
  it('projects only the closure reachable from the explicit root', () => {
    const memory = new Memory()
    const basis = ensureRootBasis(memory)
    const root = memory.ensure(basis.L, basis.U)
    memory.ensure(basis.O, basis.C) // deliberately unreachable from root closure

    const network = projectRootedLinkClosureToVisualLinkNetwork(memory, root)

    expect(network.links[0]?.key).toBe('rooted-link:0')
    expect(network.links).not.toHaveLength(memory.linkCount)
    expect(() => validateVisualLinkNetwork(network)).not.toThrow()
  })
})
```

- [ ] **Step 2: Commit and run the valid RED through repository CI**

Commit only the test change. Push the branch and open/update a draft PR for #230. Run the normal PR CI.

Expected RED: TypeScript/unit compilation fails specifically because `projectRootedLinkClosureToVisualLinkNetwork` is not exported from `src/core/visualLinkNetwork.ts`. Exact core/visual verifier failures are not acceptable substitutes for this RED.

Record the exact RED head and workflow run in #230/PR body.

- [ ] **Step 3: Implement deterministic rooted discovery**

In `src/core/visualLinkNetwork.ts`, retain the existing semantic projector unchanged and add:

```ts
const ROOTED_PRESENTATION_KEY_PREFIX = 'rooted-link:'

function rootedPresentationKey(index: number): VisualKey {
  return `${ROOTED_PRESENTATION_KEY_PREFIX}${index}`
}

export function projectRootedLinkClosureToVisualLinkNetwork(
  memory: Pick<Memory, 'poles'>,
  root: LinkHandle,
): VisualLinkNetwork {
  const links: LinkHandle[] = []
  const indexByLink = new Map<LinkHandle, number>()

  const visit = (link: LinkHandle): void => {
    if (indexByLink.has(link)) return
    indexByLink.set(link, links.length)
    links.push(link)

    const { start, end } = memory.poles(link)
    visit(start)
    visit(end)
  }

  visit(root)

  const keyFor = (link: LinkHandle): VisualKey => {
    const index = indexByLink.get(link)
    if (index === undefined) {
      throw new Error('Cannot project rooted Link closure: endpoint is outside discovered closure')
    }
    return rootedPresentationKey(index)
  }

  return normalizeVisualLinkNetwork({
    links: links.map(link => {
      const { start, end } = memory.poles(link)
      return {
        key: keyFor(link),
        startKey: keyFor(start),
        endKey: keyFor(end),
      }
    }),
  })
}
```

Do not call `allLinks()`, `linkCount`, `issuanceIndex()`, AST utilities or source conversion from this function.

- [ ] **Step 4: Add the full rooted projector corpus**

Add tests that assert:

```ts
it('handles recursive and self-closed topology without duplicate links', () => {
  const memory = new Memory()
  const basis = ensureRootBasis(memory)
  const bridge = memory.ensure(basis.L, basis.U)
  const startClosed = memory.ensureStartSelfClosed(bridge)
  const endClosed = memory.ensureEndSelfClosed(bridge)
  const root = memory.ensure(startClosed, endClosed)

  const network = projectRootedLinkClosureToVisualLinkNetwork(memory, root)
  const keys = network.links.map(link => link.key)
  expect(new Set(keys).size).toBe(keys.length)

  const known = new Set(keys)
  for (const link of network.links) {
    expect(known.has(link.startKey)).toBe(true)
    expect(known.has(link.endKey)).toBe(true)
  }
  expect(() => validateVisualLinkNetwork(network)).not.toThrow()
})
```

```ts
it('is deterministic, excludes unreachable links, and does not mutate Memory', () => {
  const memory = new Memory()
  const basis = ensureRootBasis(memory)
  const root = memory.ensure(basis.L, basis.U)
  const first = projectRootedLinkClosureToVisualLinkNetwork(memory, root)
  const polesBefore = memory.allLinks().map(link => [link, memory.poles(link)] as const)
  const countBefore = memory.linkCount

  memory.ensure(basis.O, basis.C)
  const second = projectRootedLinkClosureToVisualLinkNetwork(memory, root)

  expect(second).toEqual(first)
  expect(memory.linkCount).toBe(countBefore + 1)
  for (const [link, poles] of polesBefore) {
    expect(memory.poles(link)).toEqual(poles)
  }
})
```

Also add a minimal root test using `new Memory()` / `memory.root` to prove recursive root handling.

- [ ] **Step 5: Export the new projector from the public application barrel**

Change the existing export in `src/core/index.ts` from:

```ts
export { projectSemanticMemoryToVisualLinkNetwork } from './visualLinkNetwork'
```

to:

```ts
export {
  projectRootedLinkClosureToVisualLinkNetwork,
  projectSemanticMemoryToVisualLinkNetwork,
} from './visualLinkNetwork'
```

Do not modify existing legacy LinkGraph exports in this task.

- [ ] **Step 6: Run focused GREEN checks**

Run:

```bash
npm test -- tests/unit/visualLinkNetwork.test.ts
npm run type-check
npm run lint:check
```

Expected: all pass.

- [ ] **Step 7: Commit Task 1 GREEN**

Commit only the projector, barrel export and unit corpus. Record the exact head in #230/PR evidence.

---

### Task 2: Cut App Graph from legacy AST/LinkGraph to canonical SyntaxAset rooted topology

**Files:**
- Modify: `src/App.vue`
- Modify: `tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes Task 1 `projectRootedLinkClosureToVisualLinkNetwork(memory, root)` and existing `VisualLinkNetworkViewer.vue`.
- Produces application-only computed `graphNetwork` and Graph pane wiring.
- `legacyViewerAst` remains an ASTViewer-only sidecar.

- [ ] **Step 1: Add E2E assertions defining the new Graph runtime**

Replace the existing Graph test with:

```ts
test('opens the canonical SyntaxAset graph through the shared visual surface', async ({ page }) => {
  await page.locator('.code-input').fill('[] = ◁')
  const graphToggle = page.locator('.graph-btn-toggle')
  await expect(graphToggle).toBeEnabled()

  await graphToggle.click()

  await expect(page.locator('.graph-panel')).toBeVisible()
  await expect(page.locator('[data-visual-link-network-surface]')).toBeVisible()
  await expect(page.locator('.link-graph-viewer')).toHaveCount(0)
})
```

Add fail-closed coverage:

```ts
test('does not expose a graph from recovery AST when canonical SyntaxAset parsing fails', async ({ page }) => {
  await page.locator('.code-input').fill('↑ = []')
  await expect(page.locator('.error-panel')).toBeVisible()
  await expect(page.locator('.graph-btn-toggle')).toBeDisabled()
  await expect(page.locator('[data-visual-link-network-surface]')).toHaveCount(0)
})
```

Keep the existing AST inspection/highlighting test unchanged unless selector behavior genuinely requires a minimal update.

- [ ] **Step 2: Run the focused E2E test before App implementation**

Run:

```bash
npm run test:e2e -- tests/e2e/editor.spec.ts
```

Expected before App cutover: the new shared-surface assertion fails because current App still mounts `LinkGraphViewer`/Cytoscape. If Task 1 and Task 2 are delivered in one PR, this may be a local RED checkpoint rather than the repository-level canonical RED; the retained repository RED remains Task 1 Step 2.

- [ ] **Step 3: Replace App graph imports and derive canonical graph network**

In `src/App.vue`:

1. add:

```ts
import { projectRootedLinkClosureToVisualLinkNetwork } from './core/visualLinkNetwork'
import VisualLinkNetworkViewer from './components/VisualLinkNetworkViewer.vue'
```

2. remove:

```ts
import LinkGraphViewer from './components/LinkGraphViewer.vue'
```

3. after `parsedStatementCount`, add:

```ts
const graphNetwork = computed(() => {
  const syntax = canonicalSyntax.value
  if (syntax === null || parsedStatementCount.value === 0) return null
  return projectRootedLinkClosureToVisualLinkNetwork(syntax.memory, syntax.aset)
})
```

4. change Graph button disablement from:

```vue
:disabled="!legacyViewerAst || parsedStatementCount === 0"
```

to:

```vue
:disabled="graphNetwork === null"
```

5. replace both Graph pane instances:

```vue
<LinkGraphViewer :ast="legacyViewerAst" />
```

with:

```vue
<VisualLinkNetworkViewer v-if="graphNetwork" :network="graphNetwork" />
```

Do not change ASTViewer wiring.

- [ ] **Step 4: Prove legacy AST is no longer Graph authority**

Search `src/App.vue` after the edit and verify:

```text
LinkGraphViewer          -> zero occurrences
legacyViewerAst          -> parse sidecar + ASTViewer only
projectRootedLinkClosureToVisualLinkNetwork -> one computed graph path
VisualLinkNetworkViewer  -> import + graph pane instances only
```

Do not edit `src/core/linkGraph.ts` or `src/components/LinkGraphViewer.vue` to make this assertion pass.

- [ ] **Step 5: Run focused App GREEN checks**

Run:

```bash
npm run type-check
npm run lint:check
npm test -- tests/unit/visualLinkNetwork.test.ts
npm run test:e2e -- tests/e2e/editor.spec.ts
```

Expected: all pass; Graph mounts the shared visual surface and canonical parse errors disable Graph.

- [ ] **Step 6: Commit Task 2 GREEN**

Commit only `src/App.vue` and `tests/e2e/editor.spec.ts`.

---

### Task 3: Exact-head integration, review, and guarded merge

**Files:**
- No additional production files expected.
- Update issue/PR metadata only with factual evidence.

**Interfaces:**
- Consumes Task 1 and Task 2 exact branch head.
- Produces accepted merged A3b evidence and explicit remaining A8 obligations.

- [ ] **Step 1: Audit final changed-file scope**

Expected final code/test scope plus already-approved design artifacts:

```text
docs/superpowers/specs/2026-08-28-a3b-syntax-aset-visual-cutover-design.md
docs/superpowers/plans/2026-08-28-a3b-syntax-aset-visual-cutover.md
src/core/visualLinkNetwork.ts
src/core/index.ts
src/App.vue
tests/unit/visualLinkNetwork.test.ts
tests/e2e/editor.spec.ts
```

Reject any accidental change to protected/non-goal files listed in Global Constraints.

- [ ] **Step 2: Run full local-equivalent verification where available**

Run:

```bash
npm run lint:check
npm run type-check
npm test
npm run build
npm run test:e2e
```

Expected: all pass.

- [ ] **Step 3: Push stable exact head and wait for PR CI**

Verify the exact head has full repository CI SUCCESS including:

```text
exact @mts/core consumer verification
exact @mts/visual consumer verification
lint
type check
unit tests
build
Chromium E2E
```

Do not infer success from an older head.

- [ ] **Step 4: Mark PR ready and obtain blocking repo-guard on the same exact head**

Required:

```text
CI = SUCCESS
repo-guard policy check = SUCCESS
head SHA identical for both
```

If head changes, re-run/reconfirm both gates.

- [ ] **Step 5: Final pre-merge revalidation**

Freshly verify:

```text
main exact SHA
open competing PRs/issues
PR draft = false
PR mergeable = true
behind_by = 0
stable expected head SHA
reviews/comments/threads contain no unresolved blocking finding
workflows/repo-policy unchanged or any drift explicitly revalidated
```

- [ ] **Step 6: Merge with exact head guard**

Use GitHub merge with:

```text
expected_head_sha = <the exact fully gated head from Step 5>
```

Do not merge if GitHub reports drift.

- [ ] **Step 7: Post-merge verification and bookkeeping**

Confirm new `main` exact merge SHA and inspect workflows actually associated with that SHA before claiming post-merge CI.

Update #230, #168 and #183 with factual acceptance evidence:

```text
A3b complete:
canonical SyntaxAset rooted topology -> VisualLinkNetwork -> shared viewer
legacy AST remains ASTViewer-only
LinkGraph/Cytoscape files/exports/dependency remain A8 cleanup obligations
trusted proof and accepted MTS semantics unchanged
```

Close #230 only after these checks are true.

## Plan self-review

- Spec coverage: rooted closure, syntax-vs-semantic boundary, App cutover, fail-closed parse behavior, legacy retention boundary, TDD and guarded merge each map to a task above.
- Placeholder scan: no TBD/TODO/deferred implementation instruction exists; later A8 work is explicitly outside this plan rather than an unfinished A3b step.
- Type consistency: the same `projectRootedLinkClosureToVisualLinkNetwork(memory, root)` signature is used in Tasks 1 and 2; `graphNetwork` is `VisualLinkNetwork | null`; the existing `VisualLinkNetworkViewer` consumes `network: VisualLinkNetwork`.
