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

  it('materialize-ит exact core и visual artifacts атомарно до сборки', () => {
    const coreArtifact =
      'node scripts/verify-mts-core-consumer.mjs --artifact-output .mts-artifacts/mts-core.tgz'
    const atomicInstall =
      'node scripts/verify-mts-visual-consumer.mjs --install-current-project --core-artifact .mts-artifacts/mts-core.tgz'
    const build = workflow.indexOf('npm run build')

    expect(workflow).toContain(coreArtifact)
    expect(workflow).toContain(atomicInstall)
    expect(workflow.indexOf(coreArtifact)).toBeLessThan(workflow.indexOf(atomicInstall))
    expect(workflow.indexOf(atomicInstall)).toBeLessThan(build)
    expect(workflow.match(/--install-current-project/g)).toHaveLength(1)
    expect(workflow).not.toMatch(/npm\s+install[^\n]*@mts\//)
  })
})
