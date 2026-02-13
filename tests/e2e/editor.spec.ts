import { test, expect } from '@playwright/test'

/**
 * E2E tests for the aprover web interface
 *
 * These tests verify the complete user experience of the
 * MTS (Метатеория Связей) prover web application.
 */

test.describe('aprover Web Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display the main page with correct title', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('aprover')
    await expect(page.locator('.subtitle')).toContainText('Ассоциативный прувер')
  })

  test('should have editor and results panels', async ({ page }) => {
    await expect(page.locator('.editor-panel')).toBeVisible()
    await expect(page.locator('.results-panel')).toBeVisible()
    await expect(page.locator('.code-editor')).toBeVisible()
  })

  test('should have default MTS formulas in editor', async ({ page }) => {
    const editor = page.locator('.code-editor')
    const value = await editor.inputValue()
    expect(value).toContain('МТС')
    expect(value).toContain('∞')
  })

  test('should verify default formulas successfully', async ({ page }) => {
    // The default formulas should be verified and shown in results
    const results = page.locator('.result-item')
    await expect(results.first()).toBeVisible()

    // All default formulas should pass
    const successItems = page.locator('.result-item.success')
    await expect(successItems.first()).toBeVisible()
  })

  test('should update results when editor content changes', async ({ page }) => {
    const editor = page.locator('.code-editor')

    // Clear editor and enter a simple valid formula
    await editor.fill('∞ = ∞.')

    // Wait for results to update
    await expect(page.locator('.result-item')).toHaveCount(1)
    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should show success indicator for valid equality', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill('a = a.')

    const resultItem = page.locator('.result-item')
    await expect(resultItem).toHaveClass(/success/)
    await expect(page.locator('.status')).toHaveText('✓')
  })

  test('should show failure indicator for invalid equality', async ({ page }) => {
    const editor = page.locator('.code-editor')
    // Using different structures that cannot be unified:
    // ♂∞ (male of infinity) cannot equal ∞♀ (female of infinity)
    await editor.fill('♂∞ = ∞♀.')

    const resultItem = page.locator('.result-item')
    await expect(resultItem).toHaveClass(/failure/)
    await expect(page.locator('.status')).toHaveText('✗')
  })

  test('should show error for invalid syntax', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill('invalid syntax !!!')

    await expect(page.locator('.error-box')).toBeVisible()
  })

  test('should verify infinity axiom (А4)', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill('∞ = ∞ -> ∞.')

    await expect(page.locator('.result-item.success')).toBeVisible()
    await expect(page.locator('.status')).toHaveText('✓')
  })

  test('should verify male self-closing axiom (А5)', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill('♂v = ♂v -> v.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify female self-closing axiom (А6)', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill('r♀ = r -> r♀.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify inversion axiom (А7)', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill('!♂x = x♀.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify power expansion', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill('a^2 = a -> a.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify multiple formulas', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill(`
∞ = ∞ -> ∞.
♂v = ♂v -> v.
r♀ = r -> r♀.
`)

    const results = page.locator('.result-item')
    await expect(results).toHaveCount(3)

    // All formulas should be successful
    const successItems = page.locator('.result-item.success')
    await expect(successItems).toHaveCount(3)
  })

  test('should verify inequality', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill('♂∞ != ∞♀.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should handle left associativity (А11)', async ({ page }) => {
    const editor = page.locator('.code-editor')
    await editor.fill('a -> b -> c = (a -> b) -> c.')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should have GitHub link in footer', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toContainText('GitHub')
    await expect(page.locator('footer a')).toHaveAttribute(
      'href',
      'https://github.com/netkeep80/aprover'
    )
  })
})
