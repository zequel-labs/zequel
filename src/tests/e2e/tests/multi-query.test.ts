import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const assertResultsVisible = async (page: Page): Promise<void> => {
  const results = page.getByTestId('query-results')
  await expect(results).toBeVisible({ timeout: 30_000 })
}

// ---------------------------------------------------------------------------
// PostgreSQL Multi-Query
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Multi-Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show result selector for multiple statements', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    // Run two SELECT statements
    await actions.typeQuery('SELECT 1 AS num; SELECT 2 AS num')
    await actions.runQuery()

    await assertResultsVisible(window)

    // The status bar multi-result selector should appear
    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should switch between results', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1 AS first_col; SELECT 2 AS second_col')
    await actions.runQuery()

    await assertResultsVisible(window)

    // Should show a result selector
    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).toBeVisible({ timeout: 10_000 })

    // Click the selector to open it
    await selector.click()

    // Should see options for both results
    const result1Option = window.getByTestId('statusbar-result-0')
    await expect(result1Option).toBeVisible({ timeout: 5_000 })

    // Select Result 1
    await result1Option.click()

    // The results should update (Result 1 should show first_col)
    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('should handle mix of SELECT and non-SELECT statements', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    // Run a mix: SELECT then a CREATE TEMP TABLE then SELECT
    await actions.typeQuery(
      'SELECT 1 AS a; CREATE TEMP TABLE _e2e_tmp AS SELECT 1; SELECT * FROM _e2e_tmp'
    )
    await actions.runQuery()

    await assertResultsVisible(window)

    // Multi-result selector should be visible (3 results)
    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should not show result selector for single statement', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    // Run a single statement
    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await actions.runQuery()

    await assertResultsVisible(window)

    // The multi-result selector should NOT be visible
    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Multi-Query
// ---------------------------------------------------------------------------
test.describe('MySQL Multi-Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show result selector for multiple statements', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1 AS num; SELECT 2 AS num')
    await actions.runQuery()

    await assertResultsVisible(window)

    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should not show selector for single query', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM products LIMIT 5')
    await actions.runQuery()

    await assertResultsVisible(window)

    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite Multi-Query
// ---------------------------------------------------------------------------
test.describe('SQLite Multi-Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show result selector for multiple statements', async () => {
    const actions = await connectTo(window, 'sqlite')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1 AS a; SELECT 2 AS b; SELECT 3 AS c')
    await actions.runQuery()

    await assertResultsVisible(window)

    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// DuckDB Multi-Query
// ---------------------------------------------------------------------------
test.describe('DuckDB Multi-Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show result selector for multiple statements', async () => {
    const actions = await connectTo(window, 'duckdb')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1 AS a; SELECT 2 AS b; SELECT 3 AS c')
    await actions.runQuery()

    await assertResultsVisible(window)

    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQL Server Multi-Query
// ---------------------------------------------------------------------------
test.describe('SQL Server Multi-Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show result selector for multiple statements', async () => {
    const actions = await connectTo(window, 'sqlserver')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1 AS num; SELECT 2 AS num')
    await actions.runQuery()

    await assertResultsVisible(window)

    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should not show selector for single query', async () => {
    const actions = await connectTo(window, 'sqlserver')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT TOP 5 * FROM products')
    await actions.runQuery()

    await assertResultsVisible(window)

    const selector = window.getByTestId('statusbar-result-selector')
    await expect(selector).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})
