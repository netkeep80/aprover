import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('A8 legacy runtime removal boundary', () => {
  it('removes the AST viewer sidecar from the current application runtime', () => {
    const app = read('src/App.vue')

    expect(app).not.toContain('legacyViewerAst')
    expect(app).not.toContain('ASTViewer')
    expect(app).not.toContain('parseWithRecovery')
    expect(app).not.toContain('showAST')
  })

  it('removes the ordinary LinkGraph and Cytoscape runtime surface', () => {
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
