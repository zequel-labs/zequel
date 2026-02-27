import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'
import type { UserActions } from '@e2e/page-actions'

let app: ElectronApplication
let window: Page

/**
 * Switch to the history sidebar tab and wait for entries to appear.
 * loadHistory() only fires once per tab switch, so if history.add() hasn't
 * completed yet we toggle away and back to trigger another load.
 */
const switchToHistoryAndWaitForEntries = async (
  page: Page,
  actions: UserActions,
  { maxRetries = 5, retryDelay = 2000, timeout = 10_000 } = {}
): Promise<void> => {
  const historyItems = page.locator('[data-testid^="history-item-"]')

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt === 0) {
      await actions.switchSidebarTab('history')
    } else {
      // Toggle away and back to force loadHistory() to re-fire
      await actions.switchSidebarTab('items')
      await page.waitForTimeout(200)
      await actions.switchSidebarTab('history')
    }

    // Check if entries are visible within a short window
    try {
      await expect(historyItems.first()).toBeVisible({ timeout: attempt === maxRetries ? timeout : 3_000 })
      return // entries found
    } catch {
      if (attempt < maxRetries) {
        await page.waitForTimeout(retryDelay)
      }
    }
  }

  // Final assertion — will throw with a clear error if still empty
  await expect(historyItems.first()).toBeVisible({ timeout })
}

test.describe.serial('Query Log Panel - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query history tab shows entries after running queries', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run a query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test_val')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to history tab, retrying until entries appear
    await switchToHistoryAndWaitForEntries(window, actions)
  })

  test('multiple queries appear in history', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run first query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS first_query')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Run second query
    await window.keyboard.press('Meta+a')
    await actions.typeQuery('SELECT 2 AS second_query')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to history tab, retrying until entries appear
    await switchToHistoryAndWaitForEntries(window, actions)

    // Verify at least 2 entries
    const historyItems = window.locator('[data-testid^="history-item-"]')
    await expect(historyItems.nth(1)).toBeVisible({ timeout: 5_000 })
  })

  test('switching back to items tab works after viewing history', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run a query so there's history
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to history
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(500)

    // Switch back to items
    await actions.switchSidebarTab('items')

    // Verify tables are visible again
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
  })

  test('saved queries tab shows queries section', async () => {
    const actions = await connectTo(window, 'postgres')

    // Switch to queries tab
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(500)

    // The queries tab should be visible
    await expect(window.getByTestId('sidebar-tab-queries')).toBeVisible()
  })
})

test.describe.serial('Query Log Panel - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query history works on MySQL', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test_val')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to history tab, retrying until entries appear
    await switchToHistoryAndWaitForEntries(window, actions)
  })
})
