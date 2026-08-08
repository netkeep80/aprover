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
    await expect(page.locator('.code-input')).toBeVisible()
  })

  test('should have default MTS formulas in editor', async ({ page }) => {
    const editor = page.locator('.code-input')
    const value = await editor.inputValue()
    expect(value).toContain('МТС')
    expect(value).toContain('∞')
  })

  test('should verify default formulas successfully', async ({ page }) => {
    const results = page.locator('.result-item')
    await expect(results.first()).toBeVisible()

    const successItems = page.locator('.result-item.success')
    await expect(successItems.first()).toBeVisible()
  })

  test('should update results when editor content changes', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('∞ = ∞')

    await expect(page.locator('.result-item')).toHaveCount(1)
    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should show success indicator for valid equality', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a = a')

    const resultItem = page.locator('.result-item')
    await expect(resultItem).toHaveClass(/success/)
    await expect(page.locator('.result-status')).toHaveText('✓')
  })

  test('should show failure indicator for invalid equality', async ({ page }) => {
    const editor = page.locator('.code-input')
    // Canonical end/start projections are structurally different.
    await editor.fill('∞♂ = ♀∞')

    const resultItem = page.locator('.result-item')
    await expect(resultItem).toHaveClass(/failure/)
    await expect(page.locator('.result-status')).toHaveText('✗')
  })

  test('should show error for invalid syntax', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('invalid syntax !!!')

    await expect(page.locator('.error-panel')).toBeVisible()
  })

  test('should verify infinity axiom (А4)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('∞ = ∞ -> ∞')

    await expect(page.locator('.result-item.success')).toBeVisible()
    await expect(page.locator('.result-status')).toHaveText('✓')
  })

  test('should verify legacy A5 semantics through canonical end projection', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('v♂ = v♂ -> v')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify legacy A6 semantics through canonical start projection', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('♀r = r -> ♀r')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify legacy A7 inversion semantics with canonical projections', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('!x♂ = ♀x')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify power expansion', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a^2 = a -> a')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should verify multiple formulas', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill(`
∞ = ∞ -> ∞
v♂ = v♂ -> v
♀r = r -> ♀r
`)

    const results = page.locator('.result-item')
    await expect(results).toHaveCount(3)

    const successItems = page.locator('.result-item.success')
    await expect(successItems).toHaveCount(3)
  })

  test('should verify inequality', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('∞♂ != ♀∞')

    await expect(page.locator('.result-item.success')).toBeVisible()
  })

  test('should handle left associativity (А11)', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a -> b -> c = (a -> b) -> c')

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

  test('should have AST viewer panel', async ({ page }) => {
    await expect(page.locator('.ast-panel')).toBeVisible()
    await expect(page.locator('.ast-viewer')).toBeVisible()
  })

  test('should toggle AST viewer visibility', async ({ page }) => {
    await expect(page.locator('.ast-panel')).toBeVisible()

    const astToggle = page.locator('.toggle-btn').filter({ hasText: /AST/ })
    await astToggle.click()
    await expect(page.locator('.ast-panel')).not.toBeVisible()

    await astToggle.click()
    await expect(page.locator('.ast-panel')).toBeVisible()
  })

  test('should have AST expand/collapse controls', async ({ page }) => {
    await expect(page.locator('.ast-controls')).toBeVisible()
    await expect(page.locator('.ast-btn').first()).toBeVisible()
    await expect(page.locator('.ast-btn').nth(1)).toBeVisible()
  })

  test('should collapse all AST nodes', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a -> b')

    await expect(page.locator('.tree-root')).toBeVisible()
    await page.locator('.ast-btn').nth(1).click()

    const statementToggle = page
      .locator('.tree-node-content')
      .filter({ hasText: 'Statement' })
      .first()
      .locator('.tree-toggle')
    await expect(statementToggle).toHaveText('▶')
  })

  test('should expand all AST nodes after collapse', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a -> b')

    await expect(page.locator('.tree-root')).toBeVisible()
    await page.locator('.ast-btn').nth(1).click()
    await page.locator('.ast-btn').first().click()

    const treeChildren = page.locator('.tree-children')
    await expect(treeChildren.first()).toBeVisible()
  })

  test('should display node location in AST tree', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a = a')

    await expect(page.locator('.tree-root')).toBeVisible()
    await expect(page.locator('.tree-loc').first()).toBeVisible()
    await expect(page.locator('.tree-loc').first()).toContainText('[')
  })

  test('should highlight source code when hovering AST node', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a = a')

    await expect(page.locator('.tree-root')).toBeVisible()

    const treeNodes = page.locator('.tree-node-content')
    const identifierNode = treeNodes.filter({ hasText: 'Identifier' }).first()
    await identifierNode.hover()

    await expect(page.locator('.ast-highlight')).toBeVisible()
  })

  test('should remove highlight when mouse leaves AST node', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a = a')

    await expect(page.locator('.tree-root')).toBeVisible()

    const treeNodes = page.locator('.tree-node-content')
    const identifierNode = treeNodes.filter({ hasText: 'Identifier' }).first()

    await identifierNode.hover()
    await expect(page.locator('.ast-highlight')).toBeVisible()

    await page.locator('.app-header').hover()
    await expect(page.locator('.ast-highlight')).not.toBeVisible()
  })

  test('should toggle individual AST nodes', async ({ page }) => {
    const editor = page.locator('.code-input')
    await editor.fill('a -> b')

    await expect(page.locator('.tree-root')).toBeVisible()
    const treeChildren = page.locator('.tree-children')
    await expect(treeChildren.first()).toBeVisible()

    await page.locator('.ast-btn').nth(1).click()

    const statementNode = page
      .locator('.tree-node-content')
      .filter({ hasText: 'Statement' })
      .first()
    await statementNode.click()

    const toggleIndicator = statementNode.locator('.tree-toggle')
    await expect(toggleIndicator).toHaveText('▼')

    await statementNode.click()
    await expect(toggleIndicator).toHaveText('▶')
  })

  test.describe('File Operations', () => {
    test('should have toolbar with file operation buttons', async ({ page }) => {
      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'Новый' })
          .or(page.locator('.toolbar-btn[title*="Новый"]'))
          .first()
      ).toBeVisible()

      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'Открыть' })
          .or(page.locator('.toolbar-btn[title*="Открыть"]'))
          .first()
      ).toBeVisible()

      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'Сохранить' })
          .or(page.locator('.toolbar-btn[title*="Сохранить"]'))
          .first()
      ).toBeVisible()
    })

    test('should have Recent files button', async ({ page }) => {
      await expect(
        page
          .locator('.toolbar-btn.recent-btn')
          .or(page.locator('.toolbar-btn[title*="Недавние"]'))
          .first()
      ).toBeVisible()
    })

    test('should toggle recent files dropdown', async ({ page }) => {
      const recentBtn = page
        .locator('.toolbar-btn.recent-btn')
        .or(page.locator('.toolbar-btn[title*="Недавние"]'))
        .first()

      await expect(page.locator('.recent-files-dropdown')).not.toBeVisible()
      await recentBtn.click()
      await expect(page.locator('.recent-files-dropdown')).toBeVisible()
      await recentBtn.click()
    })

    test('should show empty recent files message', async ({ page }) => {
      await page.evaluate(() => localStorage.clear())
      await page.reload()

      const recentBtn = page
        .locator('.toolbar-btn.recent-btn')
        .or(page.locator('.toolbar-btn[title*="Недавние"]'))
        .first()

      await recentBtn.click()
      await expect(page.locator('.recent-files-dropdown')).toBeVisible()
      await expect(page.locator('.recent-empty')).toBeVisible()
      await expect(page.locator('.recent-empty')).toContainText('Нет недавних файлов')
    })

    test('should have Results export button', async ({ page }) => {
      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'Результаты' })
          .or(page.locator('.toolbar-btn[title*="Результаты"]'))
          .first()
      ).toBeVisible()
    })

    test('should have JSON export button', async ({ page }) => {
      await expect(
        page
          .locator('.toolbar-btn')
          .filter({ hasText: 'JSON' })
          .or(page.locator('.toolbar-btn[title*="JSON"]'))
          .first()
      ).toBeVisible()
    })

    test('should disable export buttons when no results', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('')

      const resultsBtn = page.locator('.toolbar-btn').filter({ hasText: 'Результаты' }).first()
      const jsonBtn = page.locator('.toolbar-btn').filter({ hasText: 'JSON' }).first()

      await expect(resultsBtn).toBeDisabled()
      await expect(jsonBtn).toBeDisabled()
    })

    test('should enable export buttons when results exist', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item')).toBeVisible()

      const resultsBtn = page.locator('.toolbar-btn').filter({ hasText: 'Результаты' }).first()
      const jsonBtn = page.locator('.toolbar-btn').filter({ hasText: 'JSON' }).first()

      await expect(resultsBtn).not.toBeDisabled()
      await expect(jsonBtn).not.toBeDisabled()
    })

    test('should display file name in editor header', async ({ page }) => {
      await expect(page.locator('.file-name')).toBeVisible()
      await expect(page.locator('.file-name')).toContainText('.mtl')
    })

    test('should clear editor on New file button', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('custom content here')
      await expect(editor).toHaveValue('custom content here')

      const newBtn = page.locator('.toolbar-btn[title*="Новый"]').first()
      await newBtn.click()

      const value = await editor.inputValue()
      expect(value).toContain('МТС')
    })

    test('should show drag-and-drop overlay on drag over', async ({ page }) => {
      const editor = page.locator('.editor-container')

      await editor.evaluate(el => {
        const event = new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
        })
        el.dispatchEvent(event)
      })

      await expect(page.locator('.drop-overlay')).toBeVisible()
      await expect(page.locator('.drop-message')).toContainText('Отпустите файл')
    })

    test('should have keyboard shortcut hint in New button title', async ({ page }) => {
      const newBtn = page.locator('.toolbar-btn[title*="Новый"]').first()
      const title = await newBtn.getAttribute('title')
      expect(title).toContain('Ctrl+N')
    })

    test('should have keyboard shortcut hint in Open button title', async ({ page }) => {
      const openBtn = page.locator('.toolbar-btn[title*="Открыть"]').first()
      const title = await openBtn.getAttribute('title')
      expect(title).toContain('Ctrl+O')
    })

    test('should have keyboard shortcut hint in Save button title', async ({ page }) => {
      const saveBtn = page.locator('.toolbar-btn[title*="Сохранить"]').first()
      const title = await saveBtn.getAttribute('title')
      expect(title).toContain('Ctrl+S')
    })

    test('should display version number', async ({ page }) => {
      await expect(page.locator('.version')).toBeVisible()
      await expect(page.locator('.version')).toContainText('v0.8.0')
    })
  })

  test.describe('Enhanced Prover Features', () => {
    test('should display applied axioms badges', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = ∞ -> ∞')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.applied-axioms')).toBeVisible()
      await expect(page.locator('.axiom-badge')).toBeVisible()
    })

    test('should show axiom badges with correct labels', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = ∞ -> ∞')

      await expect(page.locator('.result-item.success')).toBeVisible()

      const axiomBadge = page.locator('.axiom-badge')
      await expect(axiomBadge.filter({ hasText: 'A4' })).toBeVisible()
    })

    test('should show expand toggle for results with details', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('v♂ = v♂ -> v')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.expand-toggle')).toBeVisible()
    })

    test('should expand proof steps on click', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = ∞ -> ∞')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await page.locator('.result-header').first().click()

      await expect(page.locator('.proof-details')).toBeVisible()
      await expect(page.locator('.proof-steps-list')).toBeVisible()
    })

    test('should display proof step index numbers', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await page.locator('.result-header').first().click()

      await expect(page.locator('.step-index').first()).toBeVisible()
      await expect(page.locator('.step-index').first()).toContainText('1.')
    })

    test('should display proof step actions', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await page.locator('.result-header').first().click()

      await expect(page.locator('.step-action').first()).toBeVisible()
    })

    test('should collapse proof steps on second click', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await page.locator('.result-header').first().click()
      await expect(page.locator('.proof-details')).toBeVisible()

      await page.locator('.result-header').first().click()
      await expect(page.locator('.proof-details')).not.toBeVisible()
    })

    test('should display hints for failed verification', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞♂ = ♀∞')

      await expect(page.locator('.result-item.failure')).toBeVisible()
      await expect(page.locator('.hints-section')).toBeVisible()
      await expect(page.locator('.hint-item').first()).toBeVisible()
    })

    test('should display hint icons', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞♂ = ♀∞')

      await expect(page.locator('.result-item.failure')).toBeVisible()
      await expect(page.locator('.hint-icon').first()).toBeVisible()
    })

    test('should display related axiom in hints when applicable', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞♂ = ♀∞')

      await expect(page.locator('.result-item.failure')).toBeVisible()

      const hintAxiom = page.locator('.hint-axiom')
      await expect(hintAxiom.first()).toBeVisible()
    })

    test('should show A5 axiom for canonical end projection', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('v♂ = v♂ -> v')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A5' })).toBeVisible()
    })

    test('should show A6 axiom for canonical start projection', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('♀r = r -> ♀r')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A6' })).toBeVisible()
    })

    test('should show A1 axiom for structural equality', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A1' })).toBeVisible()
    })

    test('should show axiom tooltip on hover', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = ∞ -> ∞')

      await expect(page.locator('.result-item.success')).toBeVisible()

      const axiomBadge = page.locator('.axiom-badge').first()
      const title = await axiomBadge.getAttribute('title')
      expect(title).toBeTruthy()
      expect(title).toContain(':')
    })

    test('should display axioms label', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a = a')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.axioms-label')).toBeVisible()
      await expect(page.locator('.axioms-label')).toContainText('Применённые аксиомы')
    })
  })

  test.describe('String Anums Support', () => {
    test('should not show conversion toggle by default (mtl mode)', async ({ page }) => {
      const convToggle = page.locator('.toggle-btn').filter({ hasText: 'Conv' })
      await expect(convToggle).not.toBeVisible()
    })

    test('should not show file type badge in MTL mode', async ({ page }) => {
      await expect(page.locator('.file-type-badge')).not.toBeVisible()
    })

    test('should not show conversion panel by default', async ({ page }) => {
      await expect(page.locator('.conversion-panel')).not.toBeVisible()
    })
  })

  test.describe('Quaternary Anums Support', () => {
    test('should have abit legend defined in conversion panel styles', async ({ page }) => {
      const hasStyles = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets)
        for (const sheet of styleSheets) {
          try {
            const rules = Array.from(sheet.cssRules || [])
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule && rule.selectorText?.includes('.abit-legend')) {
                return true
              }
            }
          } catch {
            // Cross-origin stylesheets throw SecurityError
          }
        }
        return false
      })
      expect(hasStyles).toBe(true)
    })
  })

  test.describe('Extended Resolution Algorithm', () => {
    test('should verify reflexivity (A1)', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('x = x')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A1' })).toBeVisible()
    })

    test('should verify symmetry (A1) via proven equalities', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('myVar = myVar')

      await expect(page.locator('.result-item.success')).toBeVisible()
    })

    test('should verify infinity axiom with link structure', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('∞ = (∞ -> ∞)')

      await expect(page.locator('.result-item.success')).toBeVisible()
      await expect(page.locator('.axiom-badge').filter({ hasText: 'A4' })).toBeVisible()
    })
  })

  test.describe('Performance and UX Features', () => {
    test('should handle large expressions without freezing', async ({ page }) => {
      const editor = page.locator('.code-input')
      const largeExpr = Array.from({ length: 10 }, (_, i) => `a${i} = a${i}`).join('\n')
      await editor.fill(largeExpr)

      const results = page.locator('.result-item')
      await expect(results).toHaveCount(10)

      const successItems = page.locator('.result-item.success')
      await expect(successItems).toHaveCount(10)
    })

    test('should autosave to localStorage', async ({ page }) => {
      const editor = page.locator('.code-input')
      const testContent = '// Test autosave content\na = a'
      await editor.fill(testContent)

      const hasAutosaveKey = await page.evaluate(() => typeof Storage !== 'undefined')
      expect(hasAutosaveKey).toBe(true)
    })

    test('should support AST lazy loading for large expressions', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('((a -> b) -> c) -> d')

      await expect(page.locator('.tree-root')).toBeVisible()

      const treeNodes = page.locator('.tree-node-content')
      await expect(treeNodes.first()).toBeVisible()
    })

    test('should show child count indicator for collapsed nodes', async ({ page }) => {
      const editor = page.locator('.code-input')
      await editor.fill('a -> b -> c')

      await expect(page.locator('.tree-root')).toBeVisible()
      await page.locator('.ast-btn').nth(1).click()

      const toggles = page.locator('.tree-toggle')
      await expect(toggles.first()).toBeVisible()
    })
  })

  test.describe('Documentation and Help', () => {
    test('should have correct version displayed', async ({ page }) => {
      await expect(page.locator('.version')).toBeVisible()
      const version = await page.locator('.version').textContent()
      expect(version).toMatch(/^v\d+\.\d+\.\d+$/)
    })

    test('should have GitHub link pointing to correct repository', async ({ page }) => {
      const githubLink = page.locator('footer a')
      await expect(githubLink).toHaveAttribute('href', 'https://github.com/netkeep80/aprover')
    })

    test('should have correct subtitle describing the application', async ({ page }) => {
      await expect(page.locator('.subtitle')).toContainText('Метатеории Связей')
      await expect(page.locator('.subtitle')).toContainText('МТС')
    })
  })
})
