import { expect, test } from '@playwright/test'

test.describe('aprover current MTS consumer UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows the application as an exact current MTS consumer', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('aprover')
    await expect(page.locator('.subtitle')).toContainText('exact @mts/core v0.10')
    await expect(page.locator('.runtime-note')).toContainText('exact @mts/core v0.10')
    await expect(page.locator('.runtime-note')).not.toContainText('mts-proof/v0.4')
    await expect(page.locator('.runtime-note')).not.toContainText('mts-contract/v0.6')
  })

  test('loads the current canonical root application sample', async ({ page }) => {
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

  test('does not expose legacy interpretation or proof controls', async ({ page }) => {
    await expect(page.locator('.result-item')).toHaveCount(0)
    await expect(page.locator('button').filter({ hasText: 'INT' })).toHaveCount(0)
    await expect(page.locator('button').filter({ hasText: 'Результаты' })).toHaveCount(0)
    await expect(page.locator('.proof-replay-toggle')).toHaveCount(0)
    await expect(page.getByTestId('proof-replay-panel')).toHaveCount(0)
    await expect(page.getByTestId('proof-search-panel')).toHaveCount(0)
    await expect(page.locator('text=statements verified')).toHaveCount(0)
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

  test('opens the canonical SyntaxAset graph through the shared visual surface', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('[] = ◁')
    const graphToggle = page.locator('.graph-btn-toggle')
    await expect(graphToggle).toBeEnabled()
    await graphToggle.click()
    await expect(page.locator('.graph-panel')).toBeVisible()
    await expect(page.locator('[data-visual-link-network-surface]')).toBeVisible()
    await expect(page.locator('.cytoscape-container')).toHaveCount(0)

    await editor.fill('↑ = []')
    await expect(page.locator('.error-panel')).toBeVisible()
    await expect(graphToggle).toBeDisabled()
    await expect(page.locator('[data-visual-link-network-surface]')).toHaveCount(0)
  })

  test('supports the basic file toolbar without proof-result export or replay', async ({ page }) => {
    await expect(page.locator('.toolbar-btn[title*="Новый"]')).toBeVisible()
    await expect(page.locator('.toolbar-btn[title*="Открыть"]')).toBeVisible()
    await expect(page.locator('.toolbar-btn[title*="Сохранить"]')).toBeVisible()
    await expect(page.locator('.recent-btn')).toBeVisible()
    await expect(page.locator('.proof-replay-toggle')).toHaveCount(0)
    await expect(page.locator('.toolbar-btn[title*="Результаты"]')).toHaveCount(0)
  })

  test('shows current read-only Anum stream deserialization for an opened .anum file', async ({ page }) => {
    const chooserPromise = page.waitForEvent('filechooser')
    await page.locator('.toolbar-btn[title*="Открыть"]').click()
    const chooser = await chooserPromise
    await chooser.setFiles({ name: 'sample.anum', mimeType: 'text/plain', buffer: Buffer.from('10\n[]\n') })
    const panel = page.getByLabel('Anum raw transport deserialization v0.4')
    await expect(panel).toBeVisible()
    await expect(panel.locator('.entry')).toHaveCount(2)
    await expect(panel.locator('.result').nth(0)).toHaveText('(L⟼U)')
    await expect(panel.locator('.result').nth(1)).toHaveText('R')
    await expect(panel).toContainText('VALUE → VALUE')
    await expect(panel).toContainText('OPEN → CLOSE')
    await expect(panel.locator('select')).toHaveCount(0)
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
