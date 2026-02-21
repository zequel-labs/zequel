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

const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.getByTestId('header-more-menu-btn')
  await trigger.click()
}

// ---------------------------------------------------------------------------
// Tab Management - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Tab Management - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open one table and verify tab appears in tab bar', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Verify the tab appears in the tab bar with schema prefix
    const tab = window.getByTestId('tab-public.customers')
    await expect(tab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('open two tables and verify both tabs in tab bar', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('orders')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Verify both tabs are visible
    const customersTab = window.getByTestId('tab-public.customers')
    const ordersTab = window.getByTestId('tab-public.orders')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('open table and query editor - verify both tabs', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Verify both tabs exist
    const customersTab = window.getByTestId('tab-public.customers')
    const queryTab = window.getByTestId('tab-Query')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(queryTab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('click on table tab to switch back from query view', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Click the customers tab to switch back
    await window.getByTestId('tab-public.customers').click()
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('close tab by clicking close button', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Close the query tab by clicking the X button inside it
    const queryTab = window.getByTestId('tab-Query')
    const closeBtn = queryTab.locator('button')
    await closeBtn.click()

    // The query tab should no longer be visible
    await expect(queryTab).not.toBeVisible({ timeout: 5_000 })

    // The customers tab should still be visible and active
    const customersTab = window.getByTestId('tab-public.customers')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('open same table twice - should reuse existing tab', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Count tabs before opening the same table again
    const tabBar = window.getByTestId('tab-bar')
    const tabsBefore = await tabBar.locator('[data-testid^="tab-"]').count()

    // Open the same table again
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Count tabs after - should be the same (no duplicate created)
    const tabsAfter = await tabBar.locator('[data-testid^="tab-"]').count()
    expect(tabsAfter).toBe(tabsBefore)

    await assertNoErrorToast(window)
  })

  test('open table, query, and monitoring - three tabs visible', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query editor
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Open monitoring via the more menu
    await openMoreMenu(window)
    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    await expect(monitoringBtn).toBeVisible({ timeout: 5_000 })
    await monitoringBtn.click()

    // Wait for monitoring view to load
    const monitoringTable = window.getByTestId('monitoring-table')
    const monitoringEmpty = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(monitoringEmpty)).toBeVisible({ timeout: 30_000 })

    // Verify all three tabs are visible
    const customersTab = window.getByTestId('tab-public.customers')
    const queryTab = window.getByTestId('tab-Query')
    const monitoringTab = window.getByTestId('tab-Running Queries')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(queryTab).toBeVisible({ timeout: 5_000 })
    await expect(monitoringTab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Management - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Tab Management - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open table and verify tab appears without schema prefix', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // MySQL tabs do not have a schema prefix
    const tab = window.getByTestId('tab-customers')
    await expect(tab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('open two tables and switch between them', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('orders')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Both tabs should be visible
    const customersTab = window.getByTestId('tab-customers')
    const ordersTab = window.getByTestId('tab-orders')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).toBeVisible({ timeout: 5_000 })

    // Switch to customers tab
    await customersTab.click()
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Switch back to orders tab
    await ordersTab.click()
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Management - SQLite
// ---------------------------------------------------------------------------
test.describe.serial('Tab Management - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open table, open query, close query tab - table tab remains', async () => {
    const actions = await connectTo(window, 'sqlite')

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query editor
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Verify both tabs exist
    const tableTab = window.getByTestId('tab-customers')
    const queryTab = window.getByTestId('tab-Query')
    await expect(tableTab).toBeVisible({ timeout: 5_000 })
    await expect(queryTab).toBeVisible({ timeout: 5_000 })

    // Close the query tab
    const closeBtn = queryTab.locator('button')
    await closeBtn.click()

    // Query tab should be gone
    await expect(queryTab).not.toBeVisible({ timeout: 5_000 })

    // Table tab should still be present
    await expect(tableTab).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Management - Tab Deduplication
// ---------------------------------------------------------------------------
test.describe.serial('Tab Management - Tab Deduplication', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: opening the same table twice creates only one tab', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open customers table the first time
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    const tabBar = window.getByTestId('tab-bar')
    const tabCountBefore = await tabBar.locator('[data-testid^="tab-"]').count()

    // Open customers table the second time
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    const tabCountAfter = await tabBar.locator('[data-testid^="tab-"]').count()

    // Should not have created a duplicate tab
    expect(tabCountAfter).toBe(tabCountBefore)

    // Only one customers tab should exist
    const customersTabs = tabBar.locator('[data-testid="tab-public.customers"]')
    const count = await customersTabs.count()
    expect(count).toBe(1)

    await assertNoErrorToast(window)
  })

  test('PostgreSQL: opening query editor twice creates two separate tabs', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open first query editor
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    const tabBar = window.getByTestId('tab-bar')
    const tabCountAfterFirst = await tabBar.locator('[data-testid^="tab-"]').count()

    // Open second query editor
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    const tabCountAfterSecond = await tabBar.locator('[data-testid^="tab-"]').count()

    // A second query tab should have been created
    expect(tabCountAfterSecond).toBe(tabCountAfterFirst + 1)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Management - Multiple Types
// ---------------------------------------------------------------------------
test.describe.serial('Tab Management - Multiple Types', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: open table, query, monitoring, user management - all 4 tabs visible', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query editor
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Open monitoring via more menu
    await openMoreMenu(window)
    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    await expect(monitoringBtn).toBeVisible({ timeout: 5_000 })
    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const monitoringEmpty = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(monitoringEmpty)).toBeVisible({ timeout: 30_000 })

    // Open user management via more menu
    await openMoreMenu(window)
    const usersBtn = window.getByTestId('header-users-btn')
    await expect(usersBtn).toBeVisible({ timeout: 5_000 })
    await usersBtn.click()

    // Wait for users view to appear
    const usersView = window.getByTestId('users-view')
    await expect(usersView).toBeVisible({ timeout: 30_000 })

    // Verify all 4 tabs are visible
    const customersTab = window.getByTestId('tab-public.customers')
    const queryTab = window.getByTestId('tab-Query')
    const monitoringTab = window.getByTestId('tab-Running Queries')
    const usersTab = window.getByTestId('tab-Users')

    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(queryTab).toBeVisible({ timeout: 5_000 })
    await expect(monitoringTab).toBeVisible({ timeout: 5_000 })
    await expect(usersTab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('PostgreSQL: click each tab to verify it activates correctly', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query editor
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Open monitoring via more menu
    await openMoreMenu(window)
    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    await expect(monitoringBtn).toBeVisible({ timeout: 5_000 })
    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const monitoringEmpty = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(monitoringEmpty)).toBeVisible({ timeout: 30_000 })

    // Open user management via more menu
    await openMoreMenu(window)
    const usersBtn = window.getByTestId('header-users-btn')
    await expect(usersBtn).toBeVisible({ timeout: 5_000 })
    await usersBtn.click()

    const usersView = window.getByTestId('users-view')
    await expect(usersView).toBeVisible({ timeout: 30_000 })

    // Now cycle through each tab to verify activation

    // Click table tab
    await window.getByTestId('tab-public.customers').click()
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Click query tab
    await window.getByTestId('tab-Query').click()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Click monitoring tab
    await window.getByTestId('tab-Running Queries').click()
    await expect(monitoringTable.or(monitoringEmpty)).toBeVisible({ timeout: 10_000 })

    // Click users tab
    await window.getByTestId('tab-Users').click()
    await expect(usersView).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Persistence Across Navigation (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Tab Persistence Across Navigation - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('table tab persists when switching sidebar tabs', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Switch to history sidebar tab
    await actions.switchSidebarTab('history')
    const historyTab = window.getByTestId('sidebar-tab-history')
    await expect(historyTab).toBeVisible({ timeout: 10_000 })

    // The table tab should still be in the tab bar
    const customersTab = window.getByTestId('tab-public.customers')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })

    // The grid should still be visible (switching sidebar does not close main content)
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 5_000 })

    // Switch back to items sidebar tab
    await actions.switchSidebarTab('items')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })

    // The table tab is still there
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('query results persist when switching between tabs', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a query editor and run a query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test_value')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })

    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Switch back to the query tab
    await window.getByTestId('tab-Query').click()

    // The query results should still be visible
    await expect(results).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})
