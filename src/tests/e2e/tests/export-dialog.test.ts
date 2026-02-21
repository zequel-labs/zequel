import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// Export Dialog Options - CSV (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Export Dialog Options - CSV (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('dialog opens on CSV tab by default when clicking export', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()

    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-format-csv')).toBeVisible()
    await expect(window.getByTestId('export-format-json')).toBeVisible()
    await expect(window.getByTestId('export-format-sql')).toBeVisible()

    // CSV options should be visible by default
    await expect(window.getByTestId('export-csv-options')).toBeVisible()
  })

  test('include-headers checkbox is visible and checked by default', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })

    const includeHeaders = window.getByTestId('export-include-headers')
    await expect(includeHeaders).toBeVisible()
    await expect(includeHeaders).toBeChecked()
  })

  test('null-as-empty checkbox is visible', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })

    const nullAsEmpty = window.getByTestId('export-null-as-empty')
    await expect(nullAsEmpty).toBeVisible()
  })

  test('toggle include-headers off and back on', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })

    const includeHeaders = window.getByTestId('export-include-headers')
    await expect(includeHeaders).toBeChecked()

    // Toggle off
    await includeHeaders.click()
    await expect(includeHeaders).not.toBeChecked()

    // Toggle back on
    await includeHeaders.click()
    await expect(includeHeaders).toBeChecked()
  })

  test('cancel button closes the dialog', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await window.getByTestId('export-cancel-btn').click()

    await expect(window.getByTestId('export-dialog')).not.toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Export Dialog Options - JSON (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Export Dialog Options - JSON (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('switch to JSON tab and verify pretty-print checkbox is visible', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await window.getByTestId('export-format-json').click()

    await expect(window.getByTestId('export-json-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-pretty-print')).toBeVisible()
  })

  test('CSV options are NOT visible when JSON is selected', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await window.getByTestId('export-format-json').click()
    await expect(window.getByTestId('export-json-options')).toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()
    await expect(window.getByTestId('export-sql-options')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog Options - SQL (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Export Dialog Options - SQL (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('switch to SQL tab and verify include-schema and create-table checkboxes', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await window.getByTestId('export-format-sql').click()

    await expect(window.getByTestId('export-sql-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-include-schema')).toBeVisible()
    await expect(window.getByTestId('export-create-table')).toBeVisible()
  })

  test('CSV and JSON options are NOT visible when SQL is selected', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await window.getByTestId('export-format-sql').click()
    await expect(window.getByTestId('export-sql-options')).toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog - Format Switching (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Export Dialog - Format Switching (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('switch CSV -> JSON -> SQL -> CSV and verify correct options each time', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    // Step 1: CSV is the default — CSV options visible, others hidden
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-include-headers')).toBeVisible()
    await expect(window.getByTestId('export-null-as-empty')).toBeVisible()
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()
    await expect(window.getByTestId('export-sql-options')).not.toBeVisible()

    // Step 2: Switch to JSON
    await window.getByTestId('export-format-json').click()
    await expect(window.getByTestId('export-json-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-pretty-print')).toBeVisible()
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()
    await expect(window.getByTestId('export-sql-options')).not.toBeVisible()

    // Step 3: Switch to SQL
    await window.getByTestId('export-format-sql').click()
    await expect(window.getByTestId('export-sql-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-include-schema')).toBeVisible()
    await expect(window.getByTestId('export-create-table')).toBeVisible()
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()

    // Step 4: Switch back to CSV
    await window.getByTestId('export-format-csv').click()
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-include-headers')).toBeVisible()
    await expect(window.getByTestId('export-null-as-empty')).toBeVisible()
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()
    await expect(window.getByTestId('export-sql-options')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Export Dialog - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('export dialog opens for MySQL table', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()

    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })
  })

  test('all 3 format tabs are available', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('export-format-csv')).toBeVisible()
    await expect(window.getByTestId('export-format-json')).toBeVisible()
    await expect(window.getByTestId('export-format-sql')).toBeVisible()
  })

  test('switch between formats and verify correct options', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    // CSV is default
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })

    // Switch to JSON
    await window.getByTestId('export-format-json').click()
    await expect(window.getByTestId('export-json-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()

    // Switch to SQL
    await window.getByTestId('export-format-sql').click()
    await expect(window.getByTestId('export-sql-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()

    // Back to CSV
    await window.getByTestId('export-format-csv').click()
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-sql-options')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog - SQLite
// ---------------------------------------------------------------------------
test.describe.serial('Export Dialog - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('export dialog opens for SQLite table', async () => {
    const actions = await connectTo(window, 'sqlite')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()

    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })
  })

  test('format tabs and CSV options are visible', async () => {
    const actions = await connectTo(window, 'sqlite')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('export-format-csv')).toBeVisible()
    await expect(window.getByTestId('export-format-json')).toBeVisible()
    await expect(window.getByTestId('export-format-sql')).toBeVisible()

    // CSV is default — options visible
    await expect(window.getByTestId('export-csv-options')).toBeVisible()
    await expect(window.getByTestId('export-include-headers')).toBeVisible()
    await expect(window.getByTestId('export-null-as-empty')).toBeVisible()
  })

  test('JSON and SQL options show correctly when switching tabs', async () => {
    const actions = await connectTo(window, 'sqlite')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    // Switch to JSON
    await window.getByTestId('export-format-json').click()
    await expect(window.getByTestId('export-json-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-pretty-print')).toBeVisible()
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()

    // Switch to SQL
    await window.getByTestId('export-format-sql').click()
    await expect(window.getByTestId('export-sql-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-include-schema')).toBeVisible()
    await expect(window.getByTestId('export-create-table')).toBeVisible()
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog - DuckDB
// ---------------------------------------------------------------------------
test.describe.serial('Export Dialog - DuckDB', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('export dialog opens for DuckDB table', async () => {
    const actions = await connectTo(window, 'duckdb')
    await actions.openTableByTestId('users')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()

    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-format-csv')).toBeVisible()
    await expect(window.getByTestId('export-format-json')).toBeVisible()
    await expect(window.getByTestId('export-format-sql')).toBeVisible()
  })

  test('CSV options are shown by default', async () => {
    const actions = await connectTo(window, 'duckdb')
    await actions.openTableByTestId('users')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('export-csv-options')).toBeVisible()
    await expect(window.getByTestId('export-include-headers')).toBeVisible()
    await expect(window.getByTestId('export-null-as-empty')).toBeVisible()
  })

  test('submit button is visible', async () => {
    const actions = await connectTo(window, 'duckdb')
    await actions.openTableByTestId('users')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('export-submit-btn')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog from Query View (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Export Dialog from Query View (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('export button not visible before running a query', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    const exportBtn = window.getByTestId('statusbar-export-btn')
    await expect(exportBtn).not.toBeVisible({ timeout: 3_000 })
  })

  test('export dialog opens after running a SELECT query', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()

    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-format-csv')).toBeVisible()
    await expect(window.getByTestId('export-format-json')).toBeVisible()
    await expect(window.getByTestId('export-format-sql')).toBeVisible()
  })

  test('query view export dialog has working format tabs', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    // CSV is default
    await expect(window.getByTestId('export-csv-options')).toBeVisible()

    // Switch to JSON
    await window.getByTestId('export-format-json').click()
    await expect(window.getByTestId('export-json-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()

    // Switch to SQL
    await window.getByTestId('export-format-sql').click()
    await expect(window.getByTestId('export-sql-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()
  })

  test('cancel closes dialog in query view', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    await actions.typeQuery('SELECT 1 AS val')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await window.getByTestId('export-cancel-btn').click()
    await expect(window.getByTestId('export-dialog')).not.toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Export Dialog - SQL Server
// ---------------------------------------------------------------------------
test.describe.serial('Export Dialog - SQL Server', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('export dialog opens for SQL Server table', async () => {
    const actions = await connectTo(window, 'sqlserver')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()

    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })
  })

  test('all format tabs are available', async () => {
    const actions = await connectTo(window, 'sqlserver')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('export-format-csv')).toBeVisible()
    await expect(window.getByTestId('export-format-json')).toBeVisible()
    await expect(window.getByTestId('export-format-sql')).toBeVisible()
  })

  test('switching between formats shows correct options', async () => {
    const actions = await connectTo(window, 'sqlserver')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    // CSV is default
    await expect(window.getByTestId('export-csv-options')).toBeVisible()
    await expect(window.getByTestId('export-include-headers')).toBeVisible()

    // Switch to JSON
    await window.getByTestId('export-format-json').click()
    await expect(window.getByTestId('export-json-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-pretty-print')).toBeVisible()
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()

    // Switch to SQL
    await window.getByTestId('export-format-sql').click()
    await expect(window.getByTestId('export-sql-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-include-schema')).toBeVisible()
    await expect(window.getByTestId('export-create-table')).toBeVisible()
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()
  })

  test('cancel and submit buttons are visible', async () => {
    const actions = await connectTo(window, 'sqlserver')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()
    await expect(window.getByTestId('export-dialog')).toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('export-cancel-btn')).toBeVisible()
    await expect(window.getByTestId('export-submit-btn')).toBeVisible()
  })
})
