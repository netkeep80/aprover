import { expect, test } from '@playwright/test'

test('канонический многострочный корень не склеивается соположением', async ({ page }) => {
  await page.goto('/')

  const source = await page.locator('.code-input').inputValue()
  expect(source).toContain('∞ : {◁ = ∞, ▷ = ∞}')
  expect(source).toContain('(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}')

  await expect(page.locator('.error-panel')).toHaveCount(0)
  await expect(page.locator('.app-footer')).toContainText('10 statements parsed')
  await expect(page.locator('.tree-root')).toBeVisible()
})
