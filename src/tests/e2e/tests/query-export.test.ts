import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const assertResultsHaveRows = async (page: Page): Promise<void> => {
  const results = page.getByTestId('query-results')
  await expect(results).toBeVisible({ timeout: 30_000 })
  const rows = results.locator('tr')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// PostgreSQL Query Export
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Query Export', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show export button in status bar after query execution', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await actions.runQuery()

    await assertResultsHaveRows(window)

    // Export button should appear in the status bar
    const exportBtn = window.getByTestId('statusbar-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('should open export dialog when clicking export', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM products LIMIT 10')
    await actions.runQuery()

    await assertResultsHaveRows(window)

    // Click the export button
    const exportBtn = window.getByTestId('statusbar-export-btn')
    await exportBtn.click()

    // Export dialog should appear (Reka UI Dialog renders with role="dialog")
    const dialog = window.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Should contain the export dialog title
    await expect(dialog.getByRole('heading', { name: 'Export query results' })).toBeVisible()

    await assertNoErrorToast(window)
  })

  test('should show format options in export dialog', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM products LIMIT 5')
    await actions.runQuery()

    await assertResultsHaveRows(window)

    const exportBtn = window.getByTestId('statusbar-export-btn')
    await exportBtn.click()

    const dialog = window.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Should show format tabs/options (CSV, JSON, SQL)
    const csvTab = dialog.locator('text=CSV')
    const jsonTab = dialog.locator('text=JSON')
    const sqlTab = dialog.locator('text=SQL')

    await expect(csvTab).toBeVisible()
    await expect(jsonTab).toBeVisible()
    await expect(sqlTab).toBeVisible()

    await assertNoErrorToast(window)
  })

  test('should not show export button when no results', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    // Don't run any query — status bar export button should not be visible
    const exportBtn = window.getByTestId('statusbar-export-btn')
    await expect(exportBtn).not.toBeVisible({ timeout: 3_000 })
  })

  test('should show execution time in status bar after query', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await actions.runQuery()

    await assertResultsHaveRows(window)

    // Execution time should be visible in the status bar (e.g. "10ms", "1.5s")
    // The execution time is displayed next to the clock icon
    const statusBar = window.locator('.border-t.bg-muted\\/30')
    await expect(statusBar).toBeVisible({ timeout: 5_000 })

    // Should contain some time indicator (ms or s)
    await expect(statusBar).toContainText(/\d+ms|\d+\.\d+s/)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Query Export
// ---------------------------------------------------------------------------
test.describe('MySQL Query Export', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show export button and open dialog', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await actions.runQuery()

    await assertResultsHaveRows(window)

    const exportBtn = window.getByTestId('statusbar-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })

    await exportBtn.click()

    const dialog = window.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite Query Export
// ---------------------------------------------------------------------------
test.describe('SQLite Query Export', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show export button and open dialog', async () => {
    const actions = await connectTo(window, 'sqlite')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM products LIMIT 5')
    await actions.runQuery()

    await assertResultsHaveRows(window)

    const exportBtn = window.getByTestId('statusbar-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })

    await exportBtn.click()

    const dialog = window.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// DuckDB Query Export
// ---------------------------------------------------------------------------
test.describe('DuckDB Query Export', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show export button and open dialog', async () => {
    const actions = await connectTo(window, 'duckdb')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM products LIMIT 5')
    await actions.runQuery()

    await assertResultsHaveRows(window)

    const exportBtn = window.getByTestId('statusbar-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })

    await exportBtn.click()

    const dialog = window.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQL Server Query Export
// ---------------------------------------------------------------------------
test.describe('SQL Server Query Export', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show export button and open dialog', async () => {
    const actions = await connectTo(window, 'sqlserver')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT TOP 5 * FROM customers')
    await actions.runQuery()

    await assertResultsHaveRows(window)

    const exportBtn = window.getByTestId('statusbar-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })

    await exportBtn.click()

    const dialog = window.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})
