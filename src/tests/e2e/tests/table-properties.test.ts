import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// Skipped: Table Properties context menu item is not yet implemented
test.describe.serial('Table Properties - PostgreSQL', () => {
  test.skip();
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open table properties via context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    // Right-click on the customers table in sidebar
    const tableItem = window.getByTestId('sidebar-table-customers')
    await expect(tableItem).toBeVisible({ timeout: 10_000 })
    await tableItem.click({ button: 'right' })

    // Look for "Properties" or "Table Properties" option
    const propsItem = window.locator('[role="menuitem"]').filter({ hasText: /properties/i })
    await expect(propsItem).toBeVisible({ timeout: 5_000 })
    await propsItem.click()

    // Verify table properties view loads
    await expect(window.getByTestId('table-properties-view')).toBeVisible({ timeout: 15_000 })
  })

  test('properties show table name and schema', async () => {
    const actions = await connectTo(window, 'postgres')

    const tableItem = window.getByTestId('sidebar-table-customers')
    await tableItem.click({ button: 'right' })

    const propsItem = window.locator('[role="menuitem"]').filter({ hasText: /properties/i })
    await expect(propsItem).toBeVisible({ timeout: 5_000 })
    await propsItem.click()

    await expect(window.getByTestId('table-properties-view')).toBeVisible({ timeout: 15_000 })

    // Check that "Name" row exists with "customers" value
    const nameRow = window.locator('[data-testid^="table-properties-row-"]').filter({ hasText: 'Name' })
    await expect(nameRow).toBeVisible({ timeout: 10_000 })

    // Check that "Schema" row exists with "public" value
    const schemaRow = window.locator('[data-testid^="table-properties-row-"]').filter({ hasText: 'Schema' })
    await expect(schemaRow).toBeVisible()
  })

  test('DDL section shows CREATE TABLE', async () => {
    const actions = await connectTo(window, 'postgres')

    const tableItem = window.getByTestId('sidebar-table-customers')
    await tableItem.click({ button: 'right' })

    const propsItem = window.locator('[role="menuitem"]').filter({ hasText: /properties/i })
    await expect(propsItem).toBeVisible({ timeout: 5_000 })
    await propsItem.click()

    await expect(window.getByTestId('table-properties-view')).toBeVisible({ timeout: 15_000 })

    const ddl = window.getByTestId('table-properties-ddl')
    await expect(ddl).toBeVisible({ timeout: 10_000 })

    const ddlText = await ddl.innerText()
    expect(ddlText.toLowerCase()).toContain('create table')
  })
})

test.describe.serial('Table Properties - MySQL', () => {
  test.skip();
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('table properties show engine info', async () => {
    const actions = await connectTo(window, 'mysql')

    const tableItem = window.getByTestId('sidebar-table-customers')
    await expect(tableItem).toBeVisible({ timeout: 10_000 })
    await tableItem.click({ button: 'right' })

    const propsItem = window.locator('[role="menuitem"]').filter({ hasText: /properties/i })
    await expect(propsItem).toBeVisible({ timeout: 5_000 })
    await propsItem.click()

    await expect(window.getByTestId('table-properties-view')).toBeVisible({ timeout: 15_000 })

    // MySQL should show engine info (e.g., InnoDB)
    const engineRow = window.locator('[data-testid^="table-properties-row-"]').filter({ hasText: 'Engine' })
    await expect(engineRow).toBeVisible({ timeout: 10_000 })
  })
})

test.describe.serial('Table Properties - SQLite', () => {
  test.skip();
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('table properties show basic info', async () => {
    const actions = await connectTo(window, 'sqlite')

    const tableItem = window.getByTestId('sidebar-table-customers')
    await expect(tableItem).toBeVisible({ timeout: 10_000 })
    await tableItem.click({ button: 'right' })

    const propsItem = window.locator('[role="menuitem"]').filter({ hasText: /properties/i })
    await expect(propsItem).toBeVisible({ timeout: 5_000 })
    await propsItem.click()

    await expect(window.getByTestId('table-properties-view')).toBeVisible({ timeout: 15_000 })

    // Should show at least the Name row
    const nameRow = window.locator('[data-testid^="table-properties-row-"]').filter({ hasText: 'Name' })
    await expect(nameRow).toBeVisible({ timeout: 10_000 })
  })
})

test.describe.serial('Table Properties - DuckDB', () => {
  test.skip();
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('table properties work', async () => {
    const actions = await connectTo(window, 'duckdb')

    const tableItem = window.getByTestId('sidebar-table-customers')
    await expect(tableItem).toBeVisible({ timeout: 10_000 })
    await tableItem.click({ button: 'right' })

    const propsItem = window.locator('[role="menuitem"]').filter({ hasText: /properties/i })
    await expect(propsItem).toBeVisible({ timeout: 5_000 })
    await propsItem.click()

    await expect(window.getByTestId('table-properties-view')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe.serial('Table Properties - SQL Server', () => {
  test.skip();
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('table properties work', async () => {
    const actions = await connectTo(window, 'sqlserver')

    const tableItem = window.getByTestId('sidebar-table-customers')
    await expect(tableItem).toBeVisible({ timeout: 10_000 })
    await tableItem.click({ button: 'right' })

    const propsItem = window.locator('[role="menuitem"]').filter({ hasText: /properties/i })
    await expect(propsItem).toBeVisible({ timeout: 5_000 })
    await propsItem.click()

    await expect(window.getByTestId('table-properties-view')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe.serial('Table Properties - ClickHouse', () => {
  test.skip();
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('table properties show engine info', async () => {
    const actions = await connectTo(window, 'clickhouse')

    const tableItem = window.getByTestId('sidebar-table-customers')
    await expect(tableItem).toBeVisible({ timeout: 10_000 })
    await tableItem.click({ button: 'right' })

    const propsItem = window.locator('[role="menuitem"]').filter({ hasText: /properties/i })
    await expect(propsItem).toBeVisible({ timeout: 5_000 })
    await propsItem.click()

    await expect(window.getByTestId('table-properties-view')).toBeVisible({ timeout: 15_000 })
  })
})
