import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const productionSources = (directory = 'src'): string[] =>
  readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return productionSources(path)
    return /\.(?:ts|vue)$/.test(entry.name) ? [path] : []
  })

describe('A8 legacy runtime removal boundary', () => {
  it('blocks retired AST, LinkGraph and Cytoscape authority across production source', () => {
    const forbidden: readonly (readonly [string, RegExp])[] = [
      ['AST viewer', /\bASTViewer\b/],
      ['LinkGraph viewer', /\bLinkGraphViewer\b/],
      ['legacy AST sidecar', /\blegacyViewerAst\b/],
      ['ordinary LinkGraph authority', /\bLinkGraph(?:Node|Edge)?\b/],
      ['ordinary linkGraph module', /['"][^'"]*linkGraph['"]/],
      ['Cytoscape runtime', /\bcytoscape\b/i],
      ['Cytoscape adapter', /\btoCytoscapeElements\b/],
      ['completed AST identity', /\bASTNode\b/],
      ['completed AST module', /['"][^'"]*\/ast(?:Helpers)?['"]/],
      ['legacy parser recovery', /\bparseWithRecovery\b/],
    ]

    for (const path of productionSources()) {
      const source = read(path)
      for (const [label, pattern] of forbidden) {
        expect(source, `${path}: ${label}`).not.toMatch(pattern)
      }
    }
  })

  it('pins the application to the canonical SyntaxAset and rooted VisualLinkNetwork path', () => {
    const app = read('src/App.vue')

    expect(app).toContain('parseSyntaxAset')
    expect(app).toContain('canonicalSyntax.value = parseSyntaxAset(input.value)')
    expect(app).toContain('projectRootedLinkClosureToVisualLinkNetwork')
    expect(app).toContain('projectRootedLinkClosureToVisualLinkNetwork(syntax.memory, syntax.aset)')
    expect(app).toContain('VisualLinkNetworkViewer')
  })

  it('keeps the retired runtime files and Cytoscape packages absent', () => {
    for (const path of [
      'src/core/linkGraph.ts',
      'src/components/LinkGraphViewer.vue',
      'tests/unit/linkGraph.test.ts',
    ]) {
      expect(existsSync(resolve(root, path)), `${path} must be deleted`).toBe(false)
    }

    const coreIndex = read('src/core/index.ts')
    expect(coreIndex).not.toContain("'./linkGraph'")
    expect(coreIndex).not.toContain('toCytoscapeElements')

    const packageJson = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    expect(packageJson.dependencies?.cytoscape).toBeUndefined()
    expect(packageJson.devDependencies?.['@types/cytoscape']).toBeUndefined()

    const packageLock = read('package-lock.json')
    expect(packageLock).not.toContain('node_modules/cytoscape')
    expect(packageLock).not.toContain('node_modules/@types/cytoscape')
    expect(packageLock).not.toContain('"cytoscape": "^3.33.1"')
    expect(packageLock).not.toContain('"@types/cytoscape": "^3.21.9"')
  })
})
