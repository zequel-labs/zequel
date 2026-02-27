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

// ---------------------------------------------------------------------------
// Sidebar Context Menu - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Context Menu - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click table shows context menu with all options', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off so all options are visible
    await actions.disableSafeMode()

    // Right-click on a table
    const table = window.getByTestId('sidebar-table-customers')
    await table.click({ button: 'right' })

    // Verify all context menu options are visible
    await expect(window.getByTestId('context-menu-toggle-pin')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('context-menu-view-data')).toBeVisible()
    await expect(window.getByTestId('context-menu-rename')).toBeVisible()
    await expect(window.getByTestId('context-menu-drop')).toBeVisible()
    await expect(window.getByTestId('context-menu-copy-name')).toBeVisible()

    await assertNoErrorToast(window)
  })

  test('right-click table View Data opens the table in grid', async () => {
    const actions = await connectTo(window, 'postgres')

    // Right-click on a table
    const table = window.getByTestId('sidebar-table-customers')
    await table.click({ button: 'right' })

    // Click View Data
    const viewDataItem = window.getByTestId('context-menu-view-data')
    await expect(viewDataItem).toBeVisible({ timeout: 5_000 })
    await viewDataItem.click()

    // Verify data grid is visible
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('right-click table Copy Name does not produce error', async () => {
    await connectTo(window, 'postgres')

    // Right-click on a table
    const table = window.getByTestId('sidebar-table-customers')
    await table.click({ button: 'right' })

    // Click Copy Name
    const copyNameItem = window.getByTestId('context-menu-copy-name')
    await expect(copyNameItem).toBeVisible({ timeout: 5_000 })
    await copyNameItem.click()

    // Wait a moment then verify no error toast
    await window.waitForTimeout(500)
    await assertNoErrorToast(window)
  })

  test('safe mode hides Drop and Rename options in context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    // Right-click on a table
    const table = window.getByTestId('sidebar-table-customers')
    await table.click({ button: 'right' })

    // View Data and Copy Name should be visible
    await expect(window.getByTestId('context-menu-view-data')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('context-menu-copy-name')).toBeVisible()
    await expect(window.getByTestId('context-menu-toggle-pin')).toBeVisible()

    // Rename and Drop should NOT be visible in safe mode
    await expect(window.getByTestId('context-menu-rename')).not.toBeVisible()
    await expect(window.getByTestId('context-menu-drop')).not.toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Context Menu - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Context Menu - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click table shows context menu with options', async () => {
    const actions = await connectTo(window, 'mysql')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Right-click on a table
    const table = window.getByTestId('sidebar-table-customers')
    await table.click({ button: 'right' })

    // Verify context menu options are visible
    await expect(window.getByTestId('context-menu-toggle-pin')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('context-menu-view-data')).toBeVisible()
    await expect(window.getByTestId('context-menu-rename')).toBeVisible()
    await expect(window.getByTestId('context-menu-drop')).toBeVisible()
    await expect(window.getByTestId('context-menu-copy-name')).toBeVisible()

    await assertNoErrorToast(window)
  })

  test('View Data opens table in grid', async () => {
    await connectTo(window, 'mysql')

    // Right-click on a table
    const table = window.getByTestId('sidebar-table-products')
    await table.click({ button: 'right' })

    // Click View Data
    const viewDataItem = window.getByTestId('context-menu-view-data')
    await expect(viewDataItem).toBeVisible({ timeout: 5_000 })
    await viewDataItem.click()

    // Verify data grid is visible
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Schema Folders - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Schema Folders - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('public schema folder is visible and expanded', async () => {
    await connectTo(window, 'postgres')

    // The connectTo helper already expands the public schema
    const publicSchema = window.getByTestId('sidebar-schema-public')
    await expect(publicSchema).toBeVisible({ timeout: 10_000 })

    // Tables should be visible within the expanded public schema
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('multiple schema folders may be present', async () => {
    await connectTo(window, 'postgres')

    // The public schema should always be visible
    const publicSchema = window.getByTestId('sidebar-schema-public')
    await expect(publicSchema).toBeVisible({ timeout: 10_000 })

    // Check for other common PostgreSQL schemas (they may be present depending on seed data)
    const schemaFolders = window.locator('[data-testid^="sidebar-schema-"]')
    const schemaCount = await schemaFolders.count()

    // At minimum, the public schema should exist
    expect(schemaCount).toBeGreaterThanOrEqual(1)

    await assertNoErrorToast(window)
  })

  test('tables are visible within expanded public schema', async () => {
    await connectTo(window, 'postgres')

    // The connectTo helper expands public schema and waits for customers table
    // Verify multiple tables are present
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-order_items')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Schema Folders - SQL Server
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Schema Folders - SQL Server', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('dbo schema folder is visible and expanded', async () => {
    await connectTo(window, 'sqlserver')

    // The connectTo helper already expands the dbo schema
    const dboSchema = window.getByTestId('sidebar-schema-dbo')
    await expect(dboSchema).toBeVisible({ timeout: 10_000 })

    // Tables should be visible within the expanded dbo schema
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('tables visible within dbo schema', async () => {
    await connectTo(window, 'sqlserver')

    // Verify multiple tables are present under dbo
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('multiple schema folders may be present', async () => {
    await connectTo(window, 'sqlserver')

    // The dbo schema should always be visible
    const dboSchema = window.getByTestId('sidebar-schema-dbo')
    await expect(dboSchema).toBeVisible({ timeout: 10_000 })

    // Check total schema folder count
    const schemaFolders = window.locator('[data-testid^="sidebar-schema-"]')
    const schemaCount = await schemaFolders.count()

    // At minimum, the dbo schema should exist
    expect(schemaCount).toBeGreaterThanOrEqual(1)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Create Table Button
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Create Table Button', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: Create Table button is visible when safe mode is off', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    const createBtn = window.getByTestId('sidebar-create-table-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('PostgreSQL: safe mode hides Create Table button', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off first, verify button is visible
    await actions.disableSafeMode()
    const createBtn = window.getByTestId('sidebar-create-table-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    // Enable safe mode
    await actions.enableSafeMode()

    // Create Table button should be hidden
    await expect(createBtn).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('MySQL: Create Table button is visible when safe mode is off', async () => {
    const actions = await connectTo(window, 'mysql')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    const createBtn = window.getByTestId('sidebar-create-table-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Search/Filter - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Search/Filter - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('search input filters tables in the sidebar', async () => {
    await connectTo(window, 'postgres')

    // Verify multiple tables are visible before filtering
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })

    // Locate the search input by its placeholder
    const searchInput = window.locator('input[placeholder="Search..."]')
    await expect(searchInput).toBeVisible({ timeout: 5_000 })

    // Type a filter term that matches only one table
    await searchInput.fill('customers')
    await window.waitForTimeout(500)

    // The customers table should still be visible
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 5_000 })

    // The products table should be filtered out (not visible)
    await expect(window.getByTestId('sidebar-table-products')).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('clearing search restores all tables', async () => {
    await connectTo(window, 'postgres')

    // Verify tables are visible
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })

    // Locate search input and type a filter
    const searchInput = window.locator('input[placeholder="Search..."]')
    await searchInput.fill('customers')
    await window.waitForTimeout(500)

    // Only customers should be visible
    await expect(window.getByTestId('sidebar-table-products')).not.toBeVisible({ timeout: 5_000 })

    // Clear the search input
    await searchInput.fill('')
    await window.waitForTimeout(500)

    // All tables should be visible again
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('search with no matches shows empty result', async () => {
    await connectTo(window, 'postgres')

    // Verify tables are visible
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })

    // Type a search term that matches nothing
    const searchInput = window.locator('input[placeholder="Search..."]')
    await searchInput.fill('zzz_nonexistent_table_xyz')
    await window.waitForTimeout(500)

    // No tables should be visible
    await expect(window.getByTestId('sidebar-table-customers')).not.toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('sidebar-table-products')).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar History Tab - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar History Tab - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('run a query and verify history entry appears', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run a query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS sidebar_history_check')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Switch to history tab
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(1_000)

    // Verify a history entry containing our query text is visible
    const historyItems = window.locator('[data-testid^="history-item-"]')
    await expect(historyItems.first()).toBeVisible({ timeout: 10_000 })

    // Find the specific entry with our SQL text
    const matchingEntry = window.locator('[data-testid^="history-item-"]', { hasText: 'sidebar_history_check' })
    await expect(matchingEntry.first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('history entry shows the SQL text', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run a distinctive query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 42 AS e2e_sidebar_features_test')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Switch to history tab
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(1_000)

    // Verify the SQL text is visible in the history entry
    const matchingEntry = window.locator('[data-testid^="history-item-"]', { hasText: 'e2e_sidebar_features_test' })
    await expect(matchingEntry.first()).toBeVisible({ timeout: 10_000 })

    // The entry should contain the SQL text
    const entryText = await matchingEntry.first().textContent()
    expect(entryText).toContain('e2e_sidebar_features_test')

    await assertNoErrorToast(window)
  })

  test('delete a history item via context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run a query to create a history entry
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 99 AS e2e_delete_history_test')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Switch to history tab
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(1_000)

    // Find the history entry
    const matchingEntry = window.locator('[data-testid^="history-item-"]', { hasText: 'e2e_delete_history_test' })
    await expect(matchingEntry.first()).toBeVisible({ timeout: 10_000 })

    // Right-click on the history entry to open context menu
    await matchingEntry.first().click({ button: 'right' })

    // Click the Delete option
    const deleteOption = window.getByTestId('history-item-delete')
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()

    // Wait for the item to be removed
    await window.waitForTimeout(1_000)

    // The specific history entry should no longer be visible
    await expect(matchingEntry).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Saved Queries Tab - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Saved Queries Tab - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('queries tab shows New Query and Refresh buttons', async () => {
    const actions = await connectTo(window, 'postgres')

    // Switch to queries tab
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(500)

    // The New Query button should be visible
    const newBtn = window.getByTestId('saved-queries-new')
    await expect(newBtn).toBeVisible({ timeout: 5_000 })

    // The Refresh button should be visible
    const refreshBtn = window.getByTestId('saved-queries-refresh')
    await expect(refreshBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('create a saved query and verify it appears in the list', async () => {
    const actions = await connectTo(window, 'postgres')

    // Switch to queries tab
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(500)

    // Save a query via IPC API (form submission in Reka UI Dialog is unreliable in Electron)
    await window.evaluate(
      async (args: { name: string; sql: string }) => {
        await (window as unknown as { api: { savedQueries: { save: (n: string, s: string) => Promise<unknown> } } }).api.savedQueries.save(args.name, args.sql)
      },
      { name: 'E2E Sidebar Feature Test', sql: 'SELECT * FROM customers LIMIT 5' }
    )

    // Refresh the list by toggling tabs
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(200)
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(500)

    // Verify the saved query appears
    const savedQuery = window.locator('[data-testid^="saved-query-"]', { hasText: 'E2E Sidebar Feature Test' })
    await expect(savedQuery.first()).toBeVisible({ timeout: 10_000 })

    // Cleanup: delete via context menu
    await savedQuery.first().click({ button: 'right' })
    const deleteOption = window.getByTestId('saved-query-delete')
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()
    await window.waitForTimeout(1_000)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Refresh Button - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Refresh Button - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('refresh button updates sidebar after creating a table via query', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.disableSafeMode()

    // Table should not exist yet
    const newTable = window.getByTestId('sidebar-table-e2e_refresh_test')
    await expect(newTable).not.toBeVisible({ timeout: 2_000 })

    // Create the table via SQL
    await actions.openQueryEditor()
    await actions.typeQuery('CREATE TABLE e2e_refresh_test (id serial PRIMARY KEY, name text)')
    await actions.runQuery()

    // Table should still not be visible in sidebar (no auto-refresh)
    await expect(newTable).not.toBeVisible({ timeout: 2_000 })

    // Click the refresh button
    const refreshBtn = window.getByTestId('sidebar-refresh-btn')
    await expect(refreshBtn).toBeVisible({ timeout: 5_000 })
    await refreshBtn.click()

    // Now the table should appear in the sidebar
    await expect(newTable).toBeVisible({ timeout: 10_000 })

    // Cleanup: drop the table
    await actions.typeQuery('DROP TABLE e2e_refresh_test')
    await actions.runQuery()

    await assertNoErrorToast(window)
  })

  test('refresh button updates sidebar after dropping a table via query', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.disableSafeMode()

    // Create a table first
    await actions.openQueryEditor()
    await actions.typeQuery('CREATE TABLE e2e_refresh_drop_test (id serial PRIMARY KEY)')
    await actions.runQuery()

    // Refresh to make it appear
    const refreshBtn = window.getByTestId('sidebar-refresh-btn')
    await refreshBtn.click()

    const testTable = window.getByTestId('sidebar-table-e2e_refresh_drop_test')
    await expect(testTable).toBeVisible({ timeout: 10_000 })

    // Drop the table via SQL
    await actions.typeQuery('DROP TABLE e2e_refresh_drop_test')
    await actions.runQuery()

    // Table should still be visible before refresh
    await expect(testTable).toBeVisible({ timeout: 2_000 })

    // Click refresh
    await refreshBtn.click()

    // Table should disappear from sidebar
    await expect(testTable).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})
