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
})
