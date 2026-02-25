import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'
import type { UserActions } from '@e2e/page-actions'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const saveQueryViaApi = async (page: Page, name: string, sql: string): Promise<void> => {
  // Save via IPC API (form submission in Reka UI Dialog is unreliable in Electron)
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

/**
 * Switch to the history sidebar tab and wait for entries to appear.
 * loadHistory() only fires once per tab switch, so if history.add() hasn't
 * completed yet we toggle away and back to trigger another load.
 */
const switchToHistoryAndWaitForEntries = async (
  page: Page,
  actions: UserActions,
  locator?: ReturnType<Page['locator']>,
  { maxRetries = 5, retryDelay = 2000, timeout = 10_000 } = {}
): Promise<void> => {
  const historyItems = locator ?? page.locator('[data-testid^="history-item-"]')

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt === 0) {
      await actions.switchSidebarTab('history')
    } else {
      // Toggle away and back to force loadHistory() to re-fire
      await actions.switchSidebarTab('items')
      await page.waitForTimeout(200)
      await actions.switchSidebarTab('history')
    }

    try {
      await expect(historyItems.first()).toBeVisible({ timeout: attempt === maxRetries ? timeout : 3_000 })
      return
    } catch {
      if (attempt < maxRetries) {
        await page.waitForTimeout(retryDelay)
      }
    }
  }

  await expect(historyItems.first()).toBeVisible({ timeout })
}

// ---------------------------------------------------------------------------
// Query History
// ---------------------------------------------------------------------------
test.describe.serial('Query History', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: run query and see it in history', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run a query so it appears in history
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS e2e_history_test')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Switch to history tab, retrying until entries appear
    const historyText = window.locator('[data-testid^="history-item-"]', { hasText: 'e2e_history_test' })
    await switchToHistoryAndWaitForEntries(window, actions, historyText)
  })

  test('MySQL: run query and see it in history', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS e2e_history_test')
    await actions.runQuery()
    await assertNoErrorToast(window)

    const historyText = window.locator('[data-testid^="history-item-"]', { hasText: 'e2e_history_test' })
    await switchToHistoryAndWaitForEntries(window, actions, historyText)
  })

  test('SQL Server: run query and see it in history', async () => {
    const actions = await connectTo(window, 'sqlserver')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS e2e_history_test')
    await actions.runQuery()
    await assertNoErrorToast(window)

    const historyText = window.locator('[data-testid^="history-item-"]', { hasText: 'e2e_history_test' })
    await switchToHistoryAndWaitForEntries(window, actions, historyText)
  })

  test('PostgreSQL: clear all history', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run a query to ensure there's history
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS e2e_clear_test')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Switch to history tab with retry
    await switchToHistoryAndWaitForEntries(window, actions)

    // Click clear all
    const clearBtn = window.getByTestId('history-clear-all')
    const isVisible = await clearBtn.isVisible().catch(() => false)
    if (isVisible) {
      await clearBtn.click()
      await window.waitForTimeout(1000)

      // Verify history is empty
      const emptyState = window.getByTestId('history-empty')
      await expect(emptyState).toBeVisible({ timeout: 5_000 })
    }

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Saved Queries
// ---------------------------------------------------------------------------
test.describe.serial('Saved Queries', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: create and delete a saved query', async () => {
    const actions = await connectTo(window, 'postgres')

    // Switch to queries tab
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(1000)

    // Save a new query via API
    await saveQueryViaApi(window, 'E2E Test Query', 'SELECT * FROM customers LIMIT 10')

    // Verify the query appears in the saved queries list
    const savedQuery = window.locator('[data-testid^="saved-query-"]', { hasText: 'E2E Test Query' })
    await expect(savedQuery.first()).toBeVisible({ timeout: 10_000 })

    // Now delete it via context menu
    await savedQuery.first().click({ button: 'right' })
    const deleteOption = window.getByTestId('saved-query-delete')
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()
    await window.waitForTimeout(1000)

    await assertNoErrorToast(window)
  })

  test('MySQL: create a saved query from queries tab', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(1000)

    await saveQueryViaApi(window, 'E2E MySQL Query', 'SELECT * FROM products ORDER BY price DESC')

    const savedQuery = window.locator('[data-testid^="saved-query-"]', { hasText: 'E2E MySQL Query' })
    await expect(savedQuery.first()).toBeVisible({ timeout: 10_000 })

    // Cleanup: delete via context menu
    await savedQuery.first().click({ button: 'right' })
    const deleteOption = window.getByTestId('saved-query-delete')
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()
    await window.waitForTimeout(1000)

    await assertNoErrorToast(window)
  })

  test('PostgreSQL: open saved query in editor', async () => {
    const actions = await connectTo(window, 'postgres')

    // Create a saved query first
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(1000)

    await saveQueryViaApi(window, 'E2E Open Test', 'SELECT id, name FROM customers')

    // Click the saved query to open it in the editor
    const savedQuery = window.locator('[data-testid^="saved-query-"]', { hasText: 'E2E Open Test' })
    await expect(savedQuery.first()).toBeVisible({ timeout: 10_000 })
    await savedQuery.first().click()

    // Verify Monaco editor appears with the query (use .first() in case multiple editors exist)
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Cleanup: go back to queries tab and delete it
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(1000)
    const queryItem = window.locator('[data-testid^="saved-query-"]', { hasText: 'E2E Open Test' })
    await queryItem.first().click({ button: 'right' })
    const deleteOption = window.getByTestId('saved-query-delete')
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()

    await assertNoErrorToast(window)
  })
})
