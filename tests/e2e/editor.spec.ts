import { expect, test } from '@playwright/test'

test.describe('aprover canonical MTS UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the application as a canonical notation consumer', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('aprover')
    await expect(page.locator('.subtitle')).toContainText('формальной нотации МТС v0.2')
    await expect(page.locator('.runtime-note')).toContainText('mts-proof/v0.4')
    await expect(page.locator('.runtime-note')).toContainText('mts-contract/v0.5')
    await expect(page.locator('.runtime-note')).toContainText('independent replay')
  })

  test('loads the canonical v0.2 root instead of legacy A0-A11 examples', async ({ page }) => {
    const source = await page.locator('.code-input').inputValue()
    expect(source).toContain('∞ : {◁ = ∞, ▷ = ∞}')
    expect(source).toContain('(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}')
    expect(source).toContain('(!=) : ¬(=)')
    expect(source).not.toContain('A4-A7')
    expect(source).not.toContain('v♂ = v♂')
  })

  test('parses canonical source and updates the AST without a proof verdict', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('[] = ◁')

    await expect(page.locator('.tree-root')).toBeVisible()
    await expect(page.locator('.app-footer')).toContainText('1 statements parsed')
    await expect(page.locator('.result-item')).toHaveCount(0)
  })

  test('reports syntax errors through the parser', async ({ page }) => {
    await page.locator('.code-input').fill('↑ = []')
    await expect(page.locator('.error-panel')).toBeVisible()
  })

  test('does not expose legacy proof-search controls', async ({ page }) => {
    await expect(page.locator('.result-item')).toHaveCount(0)
    await expect(page.locator('button').filter({ hasText: 'INT' })).toHaveCount(0)
    await expect(page.locator('button').filter({ hasText: 'Результаты' })).toHaveCount(0)
    await expect(page.locator('text=statements verified')).toHaveCount(0)
  })

  test('loads and independently replays a current mts-proof/v0.4 artifact', async ({ page }) => {
    const artifact = JSON.stringify({
      proofVersion: 'mts-proof/v0.4',
      contractVersion: 'mts-contract/v0.4',
      judgments: [
        {
          relation: 'ContextuallySatisfies',
          expression: '[] = ◁',
          context: { start: 10, end: 12, parent: null },
          symbols: [],
          memory: [],
          expected: {
            substitutions: [{ path: [0], link: 10 }],
            aliases: [],
          },
        },
      ],
    })

    await page.locator('.proof-replay-toggle').click()
    await expect(page.getByTestId('proof-replay-panel')).toBeVisible()
    await page.locator('#proof-artifact-source').fill(artifact)

    await expect(page.locator('.proof-verdict')).toContainText('REPLAY ACCEPTED')
    await expect(page.locator('.proof-summary')).toContainText('mts-proof/v0.4')
    await expect(page.locator('.proof-expression')).toContainText('[] = ◁')
    await expect(page.locator('.proof-step')).toContainText('[] @ 0 → LinkRef 10')
  })

  test('separates current proof validation errors from replay rejection', async ({ page }) => {
    await page.locator('.proof-replay-toggle').click()
    const source = page.locator('#proof-artifact-source')

    await source.fill(
      JSON.stringify({
        proofVersion: 'mts-proof/v0.4',
        contractVersion: 'mts-contract/v0.4',
        judgments: [
          {
            relation: 'ContextuallySatisfies',
            expression: '[] = ◁',
            context: { start: 10, end: 12, parent: null },
            symbols: [],
            memory: [],
            expected: {
              substitutions: [{ path: [0], link: 12 }],
              aliases: [],
            },
          },
        ],
      })
    )
    await expect(page.locator('.proof-verdict')).toContainText('REPLAY REJECTED')
    await expect(page.locator('.proof-invalid')).toHaveCount(0)

    await source.fill(
      '{"proofVersion":"mts-proof/v0.2","contractVersion":"mts-contract/v0.2","steps":[]}'
    )
    await expect(page.locator('.proof-invalid')).toContainText('Validation error')
    await expect(page.locator('.proof-invalid')).toContainText('$.proofVersion')
    await expect(page.locator('.proof-invalid')).toContainText('mts-proof/v0.4')
    await expect(page.locator('.proof-verdict')).toHaveCount(0)
  })

  test('keeps AST inspection and source highlighting', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('[] = ◁')
    await expect(page.locator('.ast-panel')).toBeVisible()
    await expect(page.locator('.tree-root')).toBeVisible()

    const squareNode = page.locator('.tree-node-content').filter({ hasText: 'Square' }).first()
    await squareNode.hover()
    await expect(page.locator('.ast-highlight')).toBeVisible()

    await page.locator('.app-header').hover()
    await expect(page.locator('.ast-highlight')).not.toBeVisible()
  })

  test('toggles AST visibility', async ({ page }) => {
    const toggle = page.locator('.toggle-btn').filter({ hasText: /AST/ })
    await expect(page.locator('.ast-panel')).toBeVisible()
    await toggle.click()
    await expect(page.locator('.ast-panel')).not.toBeVisible()
    await toggle.click()
    await expect(page.locator('.ast-panel')).toBeVisible()
  })

  test('opens the occurrence-safe graph for parsed source', async ({ page }) => {
    await page.locator('.code-input').fill('[] = ◁')
    const graphToggle = page.locator('.graph-btn-toggle')
    await expect(graphToggle).toBeEnabled()
    await graphToggle.click()
    await expect(page.locator('.graph-panel')).toBeVisible()
  })

  test('supports the basic file toolbar without proof-result export', async ({ page }) => {
    await expect(page.locator('.toolbar-btn[title*="Новый"]')).toBeVisible()
    await expect(page.locator('.toolbar-btn[title*="Открыть"]')).toBeVisible()
    await expect(page.locator('.toolbar-btn[title*="Сохранить"]')).toBeVisible()
    await expect(page.locator('.recent-btn')).toBeVisible()
    await expect(page.locator('.proof-replay-toggle')).toBeVisible()
    await expect(page.locator('.toolbar-btn[title*="Результаты"]')).toHaveCount(0)
  })

  test('shows read-only Anum denotation for an opened .anum file', async ({ page }) => {
    const chooserPromise = page.waitForEvent('filechooser')
    await page.locator('.toolbar-btn[title*="Открыть"]').click()
    const chooser = await chooserPromise
    await chooser.setFiles({
      name: 'sample.anum',
      mimeType: 'text/plain',
      buffer: Buffer.from('01\n[01]1\n'),
    })

    const panel = page.getByLabel('Anum denotation v0.2')
    await expect(panel).toBeVisible()
    await expect(panel.locator('.entry')).toHaveCount(2)
    await expect(panel).toContainText('structural')
    await expect(panel).toContainText('canonicalRaw')
    await expect(panel).toContainText('[01]1')

    await panel.getByLabel('Anum denotation context').selectOption('quote')
    await expect(panel.locator('.kind')).toHaveCount(2)
    await expect(panel.locator('.kind').first()).toHaveText('quoted-raw')
    await expect(panel.locator('button')).toHaveCount(0)
  })

  test('creates a new canonical document', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('custom')
    await page.locator('.toolbar-btn[title*="Новый"]').click()
    await expect(editor).toContainText('')
    const source = await editor.inputValue()
    expect(source).toContain('∞ : {◁ = ∞, ▷ = ∞}')
  })

  test('shows an empty recent-files list from clean browser storage', async ({ page }) => {
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.locator('.recent-btn').click()
    await expect(page.locator('.recent-files-dropdown')).toBeVisible()
    await expect(page.locator('.recent-empty')).toContainText('Нет недавних файлов')
  })

  test('preserves GitHub navigation and parsed-statement status', async ({ page }) => {
    const footer = page.locator('.app-footer')
    await expect(footer).toContainText('statements parsed')
    await expect(footer).toContainText('anum_docs')
    await expect(footer.locator('a')).toHaveAttribute('href', 'https://github.com/netkeep80/aprover')
  })
})
