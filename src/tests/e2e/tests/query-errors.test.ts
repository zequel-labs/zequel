import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

/**
 * Helper: click the run button and wait for query-results to become visible.
 * Unlike `actions.runQuery()`, this does NOT assume success -- it simply
 * waits for the results container (which renders both data *and* errors).
 */
const clickRunAndWaitForResults = async (page: Page): Promise<void> => {
  const runBtn = page.getByTestId('query-run-btn')
  await runBtn.click()
  await expect(page.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
}

/**
 * Helper: assert that `query-error` is visible and contains non-empty text.
 */
const assertQueryError = async (page: Page): Promise<string> => {
  const errorEl = page.getByTestId('query-error')
  await expect(errorEl).toBeVisible({ timeout: 5_000 })
  const errorText = await errorEl.innerText()
  expect(errorText.length).toBeGreaterThan(0)
  return errorText
}

/**
 * Helper: assert that `query-error` is NOT present in the DOM.
 */
const assertNoQueryError = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('query-error')).not.toBeVisible({ timeout: 5_000 })
}

/**
 * Helper: assert that results contain at least one grid row.
 */
const assertResultsHaveRows = async (page: Page): Promise<void> => {
  const results = page.getByTestId('query-results')
  await expect(results).toBeVisible({ timeout: 30_000 })
  const rows = results.locator('[data-testid^="grid-row-"]')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// 1. Query Error Display - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Query Error Display - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show error for invalid SQL syntax', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await actions.typeQuery('SELEC * FROM users')
    await clickRunAndWaitForResults(window)
    await assertQueryError(window)
  })

  test('should show error for non-existent table', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM this_table_does_not_exist_xyz')
    await clickRunAndWaitForResults(window)
    const errorText = await assertQueryError(window)
    expect(errorText.toLowerCase()).toContain('does not exist')
  })

  test('should recover after error when running valid query', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    // First: run invalid SQL
    await actions.typeQuery('SELEC * FROM users')
    await clickRunAndWaitForResults(window)
    await assertQueryError(window)

    // Then: run valid SQL
    await actions.typeQuery('SELECT 1 AS ok')
    await clickRunAndWaitForResults(window)
    await assertNoQueryError(window)
    await assertResultsHaveRows(window)
  })
})

// ---------------------------------------------------------------------------
// 2. Query Error Display - MySQL
// ---------------------------------------------------------------------------
test.describe('Query Error Display - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show error for invalid SQL syntax', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()
    await actions.typeQuery('SELEC * FROM users')
    await clickRunAndWaitForResults(window)
    await assertQueryError(window)
  })

  test('should recover after error when running valid query', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    // First: invalid SQL
    await actions.typeQuery('SELEC * FROM users')
    await clickRunAndWaitForResults(window)
    await assertQueryError(window)

    // Then: valid SQL
    await actions.typeQuery('SELECT 1 AS ok')
    await clickRunAndWaitForResults(window)
    await assertNoQueryError(window)
    await assertResultsHaveRows(window)
  })
})

// ---------------------------------------------------------------------------
// 3. Query Error Display - SQLite
// ---------------------------------------------------------------------------
test.describe('Query Error Display - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show error for invalid SQL syntax', async () => {
    const actions = await connectTo(window, 'sqlite')
    await actions.openQueryEditor()
    await actions.typeQuery('SELEC * FROM users')
    await clickRunAndWaitForResults(window)
    await assertQueryError(window)
  })
})

// ---------------------------------------------------------------------------
// 4. Query Execution Time - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Query Execution Time - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display execution time in status bar after query', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await actions.runQuery()
    await assertResultsHaveRows(window)

    const executionTime = window.getByTestId('statusbar-execution-time')
    await expect(executionTime).toBeVisible({ timeout: 10_000 })

    const timeText = await executionTime.innerText()
    // Execution time should be a valid duration string (e.g., "12 ms", "1.2 s", etc.)
    expect(timeText.length).toBeGreaterThan(0)
    // Should contain a numeric value
    expect(timeText).toMatch(/\d/)
  })
})

// ---------------------------------------------------------------------------
// 5. Query Format - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Query Format - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should format unformatted SQL', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    const unformatted = 'select id,name from customers where active=true'
    await actions.typeQuery(unformatted)
    await actions.formatQuery()

    // Give a moment for the formatter to apply
    await window.waitForTimeout(500)

    // Verify the editor is still visible and no error occurred
    await expect(window.getByTestId('sql-editor')).toBeVisible()

    // Verify no error toasts appeared
    const errorToast = window.locator('[data-sonner-toast][data-type="error"]')
    await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
  })
})

// ---------------------------------------------------------------------------
// 6. Query Format - MySQL
// ---------------------------------------------------------------------------
test.describe('Query Format - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should format unformatted SQL', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    const unformatted = 'select id,name from customers where active=true'
    await actions.typeQuery(unformatted)
    await actions.formatQuery()

    await window.waitForTimeout(500)

    await expect(window.getByTestId('sql-editor')).toBeVisible()

    const errorToast = window.locator('[data-sonner-toast][data-type="error"]')
    await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
  })
})

// ---------------------------------------------------------------------------
// 7. Empty Query - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Empty Query - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should not crash when running empty query', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    // Ensure the editor is empty by selecting all and deleting
    const editor = window.getByTestId('sql-editor').locator('.view-lines')
    await editor.click()
    await window.keyboard.press('Meta+a')
    await window.keyboard.press('Backspace')

    // Click the run button -- it may be disabled or do nothing, but should not crash
    const runBtn = window.getByTestId('query-run-btn')
    await runBtn.click()

    // Wait a moment and verify the app is still responsive
    await window.waitForTimeout(1_000)
    await expect(window.getByTestId('sql-editor')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 8. Large Result Set - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Large Result Set - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should render large result set without crashing', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT generate_series(1, 1000) AS num')
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoQueryError(window)

    // Verify execution time is displayed (confirms query completed)
    const executionTime = window.getByTestId('statusbar-execution-time')
    await expect(executionTime).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// 9. DDL Query - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('DDL Query - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should execute CREATE TABLE and DROP TABLE without error', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    const tableName = '_e2e_query_errors_test_ddl'

    // Drop if exists (clean slate), then create
    await actions.typeQuery(`DROP TABLE IF EXISTS ${tableName}; CREATE TABLE ${tableName} (id serial PRIMARY KEY, name text)`)
    await clickRunAndWaitForResults(window)
    await assertNoQueryError(window)

    // Clean up: drop the table
    await actions.typeQuery(`DROP TABLE ${tableName}`)
    await clickRunAndWaitForResults(window)
    await assertNoQueryError(window)
  })
})

// ---------------------------------------------------------------------------
// 10. Query with Special Characters - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Query with Special Characters - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should handle escaped single quotes in query', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await actions.typeQuery("SELECT 'hello''s world' AS greeting")
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoQueryError(window)
  })

  test('should handle special characters in results', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await actions.typeQuery("SELECT E'line1\\nline2' AS multiline, 'tab\\there' AS with_tab, '<html>&amp;</html>' AS entities")
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoQueryError(window)
  })
})
