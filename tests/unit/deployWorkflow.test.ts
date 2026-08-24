import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/deploy.yml'),
  'utf8'
)

describe('публикация GitHub Pages', () => {
  it('ждёт успешный CI на push в main', () => {
    expect(workflow).toContain('workflow_run:')
    expect(workflow).toContain('workflows: ["CI"]')
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'")
    expect(workflow).toContain("github.event.workflow_run.event == 'push'")
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'")
    expect(workflow).not.toMatch(/\n  push:\s*\n/)
  })

  it('собирает именно SHA, который прошёл CI', () => {
    expect(workflow).toContain('ref: ${{ github.event.workflow_run.head_sha }}')
  })

  it('materialize-ит exact core и visual artifacts до сборки без floating install', () => {
    const coreInstall = workflow.indexOf(
      'node scripts/verify-mts-core-consumer.mjs --install-current-project'
    )
    const visualInstall = workflow.indexOf(
      'node scripts/verify-mts-visual-consumer.mjs --install-current-project'
    )
    const build = workflow.indexOf('npm run build')

    expect(coreInstall).toBeGreaterThan(-1)
    expect(visualInstall).toBeGreaterThan(-1)
    expect(build).toBeGreaterThan(-1)
    expect(coreInstall).toBeLessThan(build)
    expect(visualInstall).toBeLessThan(build)
    expect(workflow).not.toMatch(/npm\s+install[^\n]*@mts\//)
  })
})
