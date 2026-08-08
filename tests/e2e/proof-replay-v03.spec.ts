import { expect, test } from '@playwright/test'

function openingArtifact(body = 'b') {
  return JSON.stringify({
    proofVersion: 'mts-proof/v0.3',
    contractVersion: 'mts-contract/v0.3',
    judgments: [
      {
        relation: 'Opens',
        scopes: [{ path: [], parent: null, definitions: ['a : b'] }],
        lookupScope: [],
        target: 'a',
        expected: {
          definitionId: { scopePath: [], ordinal: 0 },
          body,
        },
      },
    ],
  })
}

test.describe('aprover trusted proof v0.3 replay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('.proof-replay-toggle').click()
  })

  test('loads and independently accepts an Opens base judgment', async ({ page }) => {
    await page.locator('#proof-artifact-source').fill(openingArtifact())

    await expect(page.locator('.proof-verdict')).toContainText('REPLAY ACCEPTED')
    await expect(page.getByTestId('proof-v03-judgments')).toBeVisible()
    await expect(page.getByTestId('proof-v03-judgments')).toContainText('Opens')
    await expect(page.getByTestId('proof-v03-judgments')).toContainText('DefinitionId: root / 0')
    await expect(page.getByTestId('proof-v03-judgments')).toContainText('RHS: b')
    await expect(page.locator('.proof-summary')).toContainText('mts-proof/v0.3')
    await expect(page.locator('.proof-summary')).toContainText('mts-contract/v0.3')
  })

  test('separates forged replay from transport validation errors', async ({ page }) => {
    await page.locator('#proof-artifact-source').fill(openingArtifact('c'))
    await expect(page.locator('.proof-verdict')).toContainText('REPLAY REJECTED')
    await expect(page.getByTestId('proof-v03-judgments')).toContainText('rejected')

    await page.locator('#proof-artifact-source').fill(
      JSON.stringify({
        proofVersion: 'mts-proof/v0.3',
        contractVersion: 'mts-contract/v0.3',
        judgments: [{ relation: 'Opens', target: 'a' }],
      })
    )
    await expect(page.locator('.proof-invalid')).toContainText('Validation error')
    await expect(page.locator('.proof-invalid')).toContainText('judgments[0]')
    await expect(page.locator('.proof-verdict')).toHaveCount(0)
  })

  test('keeps Search on the existing v0.2 one-step bridge', async ({ page }) => {
    await page.locator('.proof-search-open').click()
    await page.locator('.proof-search-run').click()
    await expect(page.locator('.proof-search-status')).toContainText('SEARCH PROVEN')

    const artifact = await page.getByLabel('Generated proof artifact JSON').inputValue()
    expect(artifact).toContain('mts-proof/v0.2')
    expect(artifact).not.toContain('mts-proof/v0.3')
  })
})
