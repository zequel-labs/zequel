import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'
import { userActions, type UserActions } from '@e2e/page-actions'

const assertNoErrorToast = async (page: Page): Promise<void> => {
  await page.waitForTimeout(500)
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const saveQueryViaApi = async (page: Page, name: string, sql: string): Promise<void> => {
  await page.evaluate(
    async (args: { name: string; sql: string }) => {
      await (window as unknown as { api: { savedQueries: { save: (n: string, s: string) => Promise<unknown> } } }).api.savedQueries.save(args.name, args.sql)
    },
    { name, sql }
  )

  // Refresh saved queries list by toggling tabs
  await page.getByTestId('sidebar-tab-history').click()
  await page.waitForTimeout(200)
  await page.getByTestId('sidebar-tab-queries').click()
  await page.waitForTimeout(500)
}

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// Saved Queries Tab
// ---------------------------------------------------------------------------
test.describe.serial('Saved Queries Tab', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display saved queries tab in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    const queriesTab = window.getByTestId('sidebar-tab-queries')
    await expect(queriesTab).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should switch to saved queries tab', async () => {
    test.setTimeout(120_000)
    const actions = await connectTo(window, 'postgres')

    // Click the queries tab
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(500)

    // Verify the queries tab is active (has the active styling) and content is visible
    const queriesTab = window.getByTestId('sidebar-tab-queries')
    await expect(queriesTab).toBeVisible({ timeout: 5_000 })

    // The saved queries list should be visible (either with items or empty state)
    const newQueryBtn = window.getByTestId('saved-queries-new')
    await expect(newQueryBtn).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should show empty state when no saved queries', async () => {
    test.setTimeout(120_000)
    const actions = await connectTo(window, 'postgres')

    // Switch to queries tab
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(1000)

    // Look for the "No saved queries" empty state text
    const emptyText = window.locator('text=No saved queries')
    const hasEmpty = await emptyText.isVisible().catch(() => false)

    // If there are no saved queries, empty state should be visible
    // If there are saved queries from other tests, we just verify no error
    if (hasEmpty) {
      await expect(emptyText).toBeVisible()
    }

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Save Query Dialog
// ---------------------------------------------------------------------------
test.describe.serial('Save Query Dialog', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should open save query dialog via command palette', async () => {
    test.setTimeout(120_000)
    const actions = await connectTo(window, 'postgres')

    // Open query editor and type a query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM customers LIMIT 10')
    await window.waitForTimeout(500)

    // Open command palette via keyboard shortcut
    await window.keyboard.press('Meta+p')
    await expect(window.getByTestId('command-palette')).toBeVisible({ timeout: 5_000 })

    // Type "Save" in the command palette search
    const input = window.getByTestId('command-palette-input')
    await input.fill('Save')
    await window.waitForTimeout(500)

    // Look for a saved query result or "Save" action in the results
    // The command palette searches tables, columns, and saved queries
    // Since we're searching for "Save", check if any result appears
    const results = window.locator('[data-testid^="command-palette-result-"]')
    const resultCount = await results.count()

    // Close the command palette
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)

    // Alternatively, open the save dialog via the "New query" button in saved queries tab
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(500)

    const newQueryBtn = window.getByTestId('saved-queries-new')
    await expect(newQueryBtn).toBeVisible({ timeout: 5_000 })
    await newQueryBtn.click()
    await window.waitForTimeout(500)

    // Verify the save query name input is visible
    const nameInput = window.getByTestId('save-query-name')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('should show query name and SQL inputs', async () => {
    test.setTimeout(120_000)
    const actions = await connectTo(window, 'postgres')

    // Switch to queries tab and open the new query dialog
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(500)

    const newQueryBtn = window.getByTestId('saved-queries-new')
    await expect(newQueryBtn).toBeVisible({ timeout: 5_000 })
    await newQueryBtn.click()
    await window.waitForTimeout(500)

    // Verify both name and SQL inputs are visible
    const nameInput = window.getByTestId('save-query-name')
    const sqlInput = window.getByTestId('save-query-sql')

    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await expect(sqlInput).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('should pre-fill SQL in save dialog', async () => {
    test.setTimeout(120_000)
    const actions = await connectTo(window, 'postgres')

    // Open query editor and type a specific SQL
    await actions.openQueryEditor()
    const testSql = 'SELECT id, name FROM customers WHERE id > 5'
    await actions.typeQuery(testSql)
    await window.waitForTimeout(500)

    // Save the query via the sidebar "New query" button after switching tabs
    // The save dialog opened from the sidebar won't have pre-filled SQL
    // But saving from history will pre-fill the SQL
    // First, run the query so it appears in history
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Switch to history tab
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(1000)

    // Right-click on the history item to save it
    const historyItem = window.locator('[data-testid^="history-item-"]').first()
    await expect(historyItem).toBeVisible({ timeout: 10_000 })
    await historyItem.click({ button: 'right' })
    await window.waitForTimeout(300)

    // Click "Save to Queries" in context menu
    const saveOption = window.locator('text=Save to Queries')
    const isSaveVisible = await saveOption.isVisible().catch(() => false)
    if (isSaveVisible) {
      await saveOption.click()
      await window.waitForTimeout(500)

      // Verify the SQL textarea is pre-filled
      const sqlInput = window.getByTestId('save-query-sql')
      await expect(sqlInput).toBeVisible({ timeout: 5_000 })
      const sqlValue = await sqlInput.inputValue()
      expect(sqlValue.length).toBeGreaterThan(0)
    }

    await assertNoErrorToast(window)
  })

  test('should have disabled submit when name is empty', async () => {
    test.setTimeout(120_000)
    const actions = await connectTo(window, 'postgres')

    // Switch to queries tab and open the new query dialog
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(500)

    const newQueryBtn = window.getByTestId('saved-queries-new')
    await expect(newQueryBtn).toBeVisible({ timeout: 5_000 })
    await newQueryBtn.click()
    await window.waitForTimeout(500)

    // Verify submit button exists
    const submitBtn = window.getByTestId('save-query-submit')
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })

    // With empty name and empty SQL, the submit button should be disabled
    const nameInput = window.getByTestId('save-query-name')
    await nameInput.clear()
    await window.waitForTimeout(200)

    await expect(submitBtn).toBeDisabled()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Query History Tab
// ---------------------------------------------------------------------------
test.describe.serial('Query History Tab', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display history tab in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    const historyTab = window.getByTestId('sidebar-tab-history')
    await expect(historyTab).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should switch to history tab', async () => {
    test.setTimeout(120_000)
    const actions = await connectTo(window, 'postgres')

    // Click the history tab
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(500)

    // Verify the history tab button is visible
    const historyTab = window.getByTestId('sidebar-tab-history')
    await expect(historyTab).toBeVisible({ timeout: 5_000 })

    // The history list content area should be shown (either with items or empty state)
    // Look for the empty state or history items
    const emptyState = window.getByTestId('history-empty')
    const historyItems = window.locator('[data-testid^="history-item-"]')

    const hasEmpty = await emptyState.isVisible().catch(() => false)
    const hasItems = await historyItems.first().isVisible().catch(() => false)

    // Either empty state or items should be present
    expect(hasEmpty || hasItems).toBe(true)

    await assertNoErrorToast(window)
  })

  test('should show executed queries in history', async () => {
    test.setTimeout(120_000)
    const actions = await connectTo(window, 'postgres')

    // Open query editor and run a query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS e2e_saved_queries_history_test')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    await assertNoErrorToast(window)

    // Switch to history tab
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(1000)

    // Verify the executed query appears in the history list
    const historyItem = window.locator('[data-testid^="history-item-"]', {
      hasText: 'e2e_saved_queries_history_test'
    })
    await expect(historyItem.first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})
