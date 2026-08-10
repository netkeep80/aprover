import { expect, test } from '@playwright/test'

test.describe('aprover current proof search bridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('.proof-replay-toggle').click()
    await page.locator('.proof-search-open').click()
  })

  test('searches, independently replays and opens the generated current artifact', async ({ page }) => {
    await expect(page.getByTestId('proof-search-panel')).toBeVisible()
    await page.locator('.proof-search-run').click()

    await expect(page.locator('.proof-search-status')).toContainText('SEARCH PROVEN')
    await expect(page.locator('.proof-search-replay-verdict')).toContainText('REPLAY ACCEPTED')

    const artifact = await page.getByLabel('Generated proof artifact JSON').inputValue()
    expect(artifact).toContain('mts-proof/v0.4')
    expect(artifact).toContain('ContextuallySatisfies')
    expect(artifact).toContain('[] = ◁')
    expect(artifact).not.toContain('mts-proof/v0.2')
    expect(artifact).not.toContain('mts-proof/v0.3')

    await page.getByRole('button', { name: 'Open in trusted replay' }).click()
    await expect(page.getByTestId('proof-replay-panel')).toBeVisible()
    await expect(page.locator('.proof-verdict')).toContainText('REPLAY ACCEPTED')
    await expect(page.locator('.proof-summary')).toContainText('mts-proof/v0.4')
    await expect(page.locator('#proof-artifact-source')).toHaveValue(artifact)
  })

  test('shows failed matches and invalid explicit input separately', async ({ page }) => {
    await page.locator('#proof-search-expression').fill('◁ = ▷')
    await page.locator('.proof-search-run').click()
    await expect(page.locator('.proof-search-status')).toContainText('NOT PROVEN')
    await expect(page.locator('.proof-search-message')).toContainText('not-matched')

    await page.locator('#proof-search-context').fill('{"start":"bad","end":12}')
    await page.locator('.proof-search-run').click()
    await expect(page.locator('.proof-search-status')).toContainText('SEARCH ERROR')
    await expect(page.locator('.proof-search-message')).toContainText('context.start')
    await expect(page.locator('.proof-search-replay-verdict')).toHaveCount(0)
  })
})
