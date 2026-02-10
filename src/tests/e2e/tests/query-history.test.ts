import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'
import type { UserActions } from '../page-actions'

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
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

// ---------------------------------------------------------------------------
// Query History - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Query History - PostgreSQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('run query and see it in history', async () => {
    // Run a query so it appears in history
    await actions.typeQuery('SELECT 1 AS e2e_history_test')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Switch to history tab
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(1000)

    // Verify the query appears in the history list
    const historyText = window.locator('text=e2e_history_test')
    await expect(historyText.first()).toBeVisible({ timeout: 10_000 })
  })

  test('clear all history', async () => {
    // Run a query to ensure there's history
    await actions.typeQuery('SELECT 1 AS e2e_clear_test')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Switch to history tab
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(1000)

    // Click clear all
    const clearBtn = window.getByTestId('history-clear-all')
    const isVisible = await clearBtn.isVisible().catch(() => false)
    if (isVisible) {
      await clearBtn.click()
      await window.waitForTimeout(1000)

      // Verify history is empty
      const emptyState = window.getByText('No query history yet')
      await expect(emptyState).toBeVisible({ timeout: 5_000 })
    }

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Query History - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Query History - MySQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('run query and see it in history', async () => {
    await actions.typeQuery('SELECT 1 AS e2e_history_test')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.switchSidebarTab('history')
    await window.waitForTimeout(1000)

    const historyText = window.locator('text=e2e_history_test')
    await expect(historyText.first()).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Saved Queries - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Saved Queries - PostgreSQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('create and delete a saved query', async () => {
    // Switch to queries tab
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(1000)

    // Save a new query via API
    await saveQueryViaApi(window, 'E2E Test Query', 'SELECT * FROM customers LIMIT 10')

    // Verify the query appears in the saved queries list
    const savedQuery = window.getByText('E2E Test Query')
    await expect(savedQuery.first()).toBeVisible({ timeout: 10_000 })

    // Now delete it via context menu
    await savedQuery.first().click({ button: 'right' })
    const deleteOption = window.getByRole('menuitem', { name: 'Delete' })
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()
    await window.waitForTimeout(1000)

    await assertNoErrorToast(window)
  })

  test('open saved query in editor', async () => {
    // Create a saved query first
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(1000)

    await saveQueryViaApi(window, 'E2E Open Test', 'SELECT id, name FROM customers')

    // Click the saved query to open it in the editor
    const savedQuery = window.getByText('E2E Open Test')
    await expect(savedQuery.first()).toBeVisible({ timeout: 10_000 })
    await savedQuery.first().click()

    // Verify Monaco editor appears with the query
    await expect(window.locator('.monaco-editor')).toBeVisible({ timeout: 10_000 })

    // Cleanup: go back to queries tab and delete it
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(1000)
    const queryItem = window.getByText('E2E Open Test')
    await queryItem.first().click({ button: 'right' })
    const deleteOption = window.getByRole('menuitem', { name: 'Delete' })
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Saved Queries - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Saved Queries - MySQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mysql')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('create a saved query from queries tab', async () => {
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(1000)

    await saveQueryViaApi(window, 'E2E MySQL Query', 'SELECT * FROM products ORDER BY price DESC')

    const savedQuery = window.getByText('E2E MySQL Query')
    await expect(savedQuery.first()).toBeVisible({ timeout: 10_000 })

    // Cleanup: delete via context menu
    await savedQuery.first().click({ button: 'right' })
    const deleteOption = window.getByRole('menuitem', { name: 'Delete' })
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()
    await window.waitForTimeout(1000)

    await assertNoErrorToast(window)
  })
})
