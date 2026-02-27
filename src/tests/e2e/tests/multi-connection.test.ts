import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo, connectSecondDb } from '@e2e/helpers/connect'
import { userActions } from '@e2e/page-actions'
import { ConnectionRailComponent } from '@e2e/page-components/ConnectionRail'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

/** Helper: connect PG + MySQL and return actions */
const connectTwoDbs = async (page: Page) => {
  await connectTo(page, 'postgres')
  await connectSecondDb(page, 'mysql')
  return userActions(page)
}

/** Helper: expand PG "public" schema folder so table testids become visible */
const expandPgPublicSchema = async (page: Page): Promise<void> => {
  const publicSchema = page.getByTestId('sidebar-schema-public')
  await expect(publicSchema).toBeVisible({ timeout: 10_000 })
  await publicSchema.click()
  await expect(page.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// Per-Connection Safe Mode Isolation
// ---------------------------------------------------------------------------
test.describe('Per-Connection Safe Mode', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('safe mode on connection A does not affect connection B', async () => {
    // Connect to PG and enable safe mode
    await connectTo(window, 'postgres')
    const actions = userActions(window)
    await actions.enableSafeMode()

    // Verify safe mode is ON for PG
    const lockedIcon = window.getByTestId('safemode-icon-locked')
    await expect(lockedIcon).toBeVisible()

    // Connect second database (MySQL)
    await connectSecondDb(window, 'mysql')

    // MySQL should have safe mode OFF (unlocked icon visible)
    const unlockedIcon = window.getByTestId('safemode-icon-unlocked')
    await expect(unlockedIcon).toBeVisible({ timeout: 5_000 })

    // Switch back to PG — safe mode should still be ON
    await actions.clickConnectionRailItem(0)
    await expect(lockedIcon).toBeVisible({ timeout: 5_000 })

    // Switch to MySQL again — safe mode should still be OFF
    await actions.clickConnectionRailItem(1)
    await expect(unlockedIcon).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('safe mode resets on disconnect and reconnect', async () => {
    // Connect to PG and enable safe mode
    await connectTo(window, 'postgres')
    const actions = userActions(window)
    await actions.enableSafeMode()
    await expect(window.getByTestId('safemode-icon-locked')).toBeVisible()

    // Connect MySQL as second connection
    await connectSecondDb(window, 'mysql')

    // Close PG via rail (index 0)
    await actions.closeConnectionViaRail(0)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // Reconnect PG as second connection
    await connectSecondDb(window, 'postgres')

    // Switch to PG (now index 0 is MySQL, index 1 is PG)
    await actions.clickConnectionRailItem(1)

    // Safe mode should be OFF (fresh session)
    await expect(window.getByTestId('safemode-icon-unlocked')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('safe mode blocks queries only on the enabled connection', async () => {
    // Connect to PG and enable safe mode
    await connectTo(window, 'postgres')
    const actions = userActions(window)
    await actions.enableSafeMode()

    // Connect MySQL (safe mode OFF)
    await connectSecondDb(window, 'mysql')

    // On MySQL: INSERT should succeed (safe mode is OFF)
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS result')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
    const errorPre = window.getByTestId('query-error')
    await expect(errorPre).not.toBeVisible({ timeout: 2_000 })

    // Switch to PG: DROP should be blocked (safe mode is ON)
    await actions.clickConnectionRailItem(0)
    await actions.openQueryEditor()
    await actions.typeQuery('DROP TABLE IF EXISTS safe_mode_isolation_test')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
    const pgError = window.getByTestId('query-error')
    await expect(pgError).toBeVisible({ timeout: 5_000 })
    await expect(pgError).toContainText('Safe Mode')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Per-Connection Privacy Mode Isolation
// ---------------------------------------------------------------------------
test.describe('Per-Connection Privacy Mode', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('privacy mode on connection A does not affect connection B', async () => {
    // Connect to PG and enable privacy mode
    await connectTo(window, 'postgres')
    const actions = userActions(window)
    await actions.enablePrivacyMode()

    // Verify privacy mode is ON for PG
    await expect(window.getByTestId('privacy-icon-on')).toBeVisible()

    // Connect second database (MySQL)
    await connectSecondDb(window, 'mysql')

    // MySQL should have privacy mode OFF
    await expect(window.getByTestId('privacy-icon-off')).toBeVisible({ timeout: 5_000 })

    // Switch back to PG — privacy mode should still be ON
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('privacy-icon-on')).toBeVisible({ timeout: 5_000 })

    // Switch to MySQL again — privacy mode should still be OFF
    await actions.clickConnectionRailItem(1)
    await expect(window.getByTestId('privacy-icon-off')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('privacy mode resets on disconnect and reconnect', async () => {
    // Connect to PG and enable privacy mode
    await connectTo(window, 'postgres')
    const actions = userActions(window)
    await actions.enablePrivacyMode()
    await expect(window.getByTestId('privacy-icon-on')).toBeVisible()

    // Connect MySQL as second connection
    await connectSecondDb(window, 'mysql')

    // Close PG via rail (index 0)
    await actions.closeConnectionViaRail(0)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // Reconnect PG as second connection
    await connectSecondDb(window, 'postgres')

    // Switch to PG (now index 0 is MySQL, index 1 is PG)
    await actions.clickConnectionRailItem(1)

    // Privacy mode should be OFF (fresh session)
    await expect(window.getByTestId('privacy-icon-off')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('privacy mode blurs grid data only on the enabled connection', async () => {
    // Connect to PG and open a table
    await connectTo(window, 'postgres')
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Enable privacy mode on PG
    const actions = userActions(window)
    await actions.enablePrivacyMode()

    // Grid cells should have blur-sm class
    const blurredCell = window.locator('[data-testid="data-grid-table"] .blur-sm')
    await expect(blurredCell.first()).toBeVisible({ timeout: 5_000 })

    // Connect MySQL
    await connectSecondDb(window, 'mysql')

    // Open a table on MySQL
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Grid cells on MySQL should NOT have blur-sm
    const mysqlBlurred = window.locator('[data-testid="data-grid-table"] .blur-sm')
    await expect(mysqlBlurred).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Connection Rail Visibility
// ---------------------------------------------------------------------------
test.describe('Connection Rail Visibility', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('rail is hidden with single connection', async () => {
    await connectTo(window, 'postgres')

    // Rail should NOT be visible with only 1 connection
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('rail appears with two connections', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    // Rail should be visible with 2 connections
    await expect(window.getByTestId('connection-rail')).toBeVisible()

    // Should have 2 items
    const actions = userActions(window)
    const count = await actions.getConnectionRailItemCount()
    expect(count).toBe(2)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Switching Connections
// ---------------------------------------------------------------------------
test.describe('Switching Connections', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('clicking rail item switches active connection', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Click first rail item (PostgreSQL) — should show PG sidebar with schema folders
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })
    // PG has "public" schema folder
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })

    // Click second rail item (MySQL) — should show MySQL sidebar with tables directly
    await actions.clickConnectionRailItem(1)
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })
    // MySQL shows tables directly (e.g. "customers")
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Isolation
// ---------------------------------------------------------------------------
test.describe('Tab Isolation', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('tabs are isolated per connection', async () => {
    // Connect to PG and open a table tab
    await connectTo(window, 'postgres')
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Connect to MySQL as second connection
    await connectSecondDb(window, 'mysql')

    // Open query editor on MySQL connection
    const actions = userActions(window)
    await actions.openQueryEditor()
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Switch back to PG — "customers" table tab should be visible
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('tab-public.customers')).toBeVisible({ timeout: 10_000 })

    // Switch to MySQL — query editor tab should be visible
    await actions.clickConnectionRailItem(1)
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Close Connection via Rail
// ---------------------------------------------------------------------------
test.describe('Close Connection via Rail', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('close connection removes it from rail', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    // Verify rail has 2 items
    const actions = userActions(window)
    expect(await actions.getConnectionRailItemCount()).toBe(2)

    // Right-click first item (PG) and close it
    await actions.closeConnectionViaRail(0)

    // Rail should disappear (only 1 connection left)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // MySQL should remain active with its sidebar
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Close Other Connections
// ---------------------------------------------------------------------------
test.describe('Close Other Connections', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('close other connections keeps only selected', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)
    expect(await actions.getConnectionRailItemCount()).toBe(2)

    // Right-click first item (PG) and close others
    await actions.closeOtherConnectionsViaRail(0)

    // Rail should disappear (only PG remains)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // PG should remain active — sidebar should still show PG schema
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Query Execution per Connection
// ---------------------------------------------------------------------------
test.describe('Query Execution per Connection', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('queries run against the correct database', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to PG and run a query
    await actions.clickConnectionRailItem(0)
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS result')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to MySQL and run a query
    await actions.clickConnectionRailItem(1)
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS result')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Disconnect with Multiple Connections
// ---------------------------------------------------------------------------
test.describe('Disconnect with Multiple Connections', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('header disconnect removes active connection', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    // Verify rail has 2 items
    const actions = userActions(window)
    expect(await actions.getConnectionRailItemCount()).toBe(2)

    // Click disconnect on the active connection (MySQL, which is the second connected)
    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    // Rail should disappear (only 1 connection left)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // Remaining connection should still be active with its sidebar
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// New Connection Dialog (Cmd+N)
// ---------------------------------------------------------------------------
test.describe('New Connection Dialog', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Cmd+N opens new connection dialog while connected', async () => {
    await connectTo(window, 'postgres')

    // Press Cmd+N to open new connection dialog
    await window.keyboard.press('Meta+n')

    // Dialog should appear
    const dialog = window.getByTestId('new-connection-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Close dialog with Escape
    await window.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Active Rail Item Indicator
// ---------------------------------------------------------------------------
test.describe('Active Rail Item Indicator', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('active item has border-primary class', async () => {
    const actions = await connectTwoDbs(window)
    const rail = new ConnectionRailComponent(window)

    // MySQL is active (second connected) — item 1 should have border-primary
    await expect(rail.item(1)).toHaveClass(/border-primary/)
    await expect(rail.item(0)).not.toHaveClass(/border-primary/)

    // Switch to PG — item 0 should now have border-primary
    await actions.clickConnectionRailItem(0)
    await expect(rail.item(0)).toHaveClass(/border-primary/)
    await expect(rail.item(1)).not.toHaveClass(/border-primary/)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Three Connections
// ---------------------------------------------------------------------------
test.describe('Three Connections', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('rail shows three items with PG + MySQL + MariaDB', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')
    await connectSecondDb(window, 'mariadb')

    // Wait for the third rail item to appear (connectSecondDb only waits for rail visibility)
    await expect(window.getByTestId('connection-rail-item-2')).toBeVisible({ timeout: 30_000 })

    const actions = userActions(window)
    expect(await actions.getConnectionRailItemCount()).toBe(3)

    await assertNoErrorToast(window)
  })

  test('close others with three connections leaves only one', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')
    await connectSecondDb(window, 'mariadb')

    // Wait for the third rail item to appear
    await expect(window.getByTestId('connection-rail-item-2')).toBeVisible({ timeout: 30_000 })

    const actions = userActions(window)
    expect(await actions.getConnectionRailItemCount()).toBe(3)

    // Right-click first item (PG) and close others (removes MySQL + MariaDB)
    await actions.closeOtherConnectionsViaRail(0)

    // Rail should disappear (only PG remains)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // PG should remain active
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Cmd+W Closes Active Connection
// ---------------------------------------------------------------------------
test.describe('Cmd+W Closes Active Connection', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Cmd+W with no tabs closes active connection', async () => {
    await connectTwoDbs(window)
    const actions = userActions(window)
    expect(await actions.getConnectionRailItemCount()).toBe(2)

    // No tabs are open — Cmd+W should close the active connection
    await window.keyboard.press('Meta+w')

    // Rail should disappear (only 1 connection left)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // Remaining connection should still be active
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('Cmd+W closes tab first when tabs are open', async () => {
    const actions = await connectTwoDbs(window)

    // Open a query editor tab on MySQL (active)
    await actions.openQueryEditor()
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Cmd+W should close the tab, NOT the connection
    await window.keyboard.press('Meta+w')

    // Rail should still be visible (both connections remain)
    await expect(window.getByTestId('connection-rail')).toBeVisible()
    expect(await actions.getConnectionRailItemCount()).toBe(2)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Rail Label Content
// ---------------------------------------------------------------------------
test.describe('Rail Label Content', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('rail items display database name', async () => {
    await connectTwoDbs(window)
    const rail = new ConnectionRailComponent(window)

    // PG rail item should show "zequel" (database name)
    await expect(rail.item(0)).toContainText('zequel')

    // MySQL rail item should also show "zequel" (database name)
    await expect(rail.item(1)).toContainText('zequel')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Per-Connection Tab Shortcuts (Cmd+1-9)
// ---------------------------------------------------------------------------
test.describe('Per-Connection Tab Shortcuts', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Cmd+1 switches to first tab within active connection only', async () => {
    // Connect PG, open a table
    await connectTo(window, 'postgres')
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Connect MySQL, open two query tabs
    await connectSecondDb(window, 'mysql')
    const actions = userActions(window)
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1')

    // Open a second query tab on MySQL (Cmd+T)
    await window.keyboard.press('Meta+t')
    await window.waitForTimeout(500)

    // Cmd+1 should switch to MySQL's first tab, NOT PG's customers tab
    await window.keyboard.press('Meta+1')
    await window.waitForTimeout(500)

    // Should still be on MySQL (rail item 1 active), not PG
    const rail = new ConnectionRailComponent(window)
    await expect(rail.item(1)).toHaveClass(/border-primary/)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Content per Connection
// ---------------------------------------------------------------------------
test.describe('Sidebar Content per Connection', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PG shows schema folders, MySQL shows tables directly', async () => {
    const actions = await connectTwoDbs(window)

    // Switch to PG — should show schema folders (public, information_schema, pg_catalog)
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-schema-information_schema')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-schema-pg_catalog')).toBeVisible({ timeout: 10_000 })

    // Switch to MySQL — should show tables directly without schema folders
    await actions.clickConnectionRailItem(1)
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    // MySQL should NOT have "public" schema folder
    await expect(window.getByTestId('sidebar-schema-pg_catalog')).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })

  test('switching back and forth shows correct sidebar for each connection', async () => {
    const actions = await connectTwoDbs(window)

    // Switch to PG — should show PG schema folders
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })

    // Switch to MySQL — should show MySQL tables
    await actions.clickConnectionRailItem(1)
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })

    // Switch back to PG again — should still show PG schema folders (not MySQL tables)
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-schema-information_schema')).toBeVisible({ timeout: 5_000 })

    // Switch to MySQL one more time — should show MySQL tables
    await actions.clickConnectionRailItem(1)
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Close Active Connection Switches to Remaining
// ---------------------------------------------------------------------------
test.describe('Close Active Connection Switches to Remaining', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('closing active connection auto-selects remaining', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // MySQL is active (second connected). Close it via rail.
    await actions.closeConnectionViaRail(1)

    // Rail should disappear (only PG left)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // PG should auto-become active — its sidebar should show PG schemas
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Query Results Isolation
// ---------------------------------------------------------------------------
test.describe('Query Results Isolation', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PG-specific query succeeds on PG, fails on MySQL', async () => {
    const actions = await connectTwoDbs(window)

    // Run PG-specific query on PG connection
    await actions.clickConnectionRailItem(0)
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT current_database()')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to MySQL and run MySQL-specific query
    await actions.clickConnectionRailItem(1)
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT DATABASE()')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Pending Changes Warning — Header Disconnect
// ---------------------------------------------------------------------------
test.describe('Pending Changes Warning — Header Disconnect', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('disconnect with pending changes shows discard warning', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to PG, expand public schema, and open customers table
    await actions.clickConnectionRailItem(0)
    await expandPgPublicSchema(window)
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Edit a cell to create pending changes
    await actions.editCell(0, 'city', `PendingTest${Date.now()}`)

    // Click header disconnect — should show warning dialog
    await window.getByTestId('header-disconnect-btn').click()

    // Discard warning dialog should appear
    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })

    // Confirm discard
    await confirmBtn.click()
    await expect(confirmBtn).not.toBeVisible({ timeout: 10_000 })

    // PG should be disconnected, only MySQL remains
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('cancel discard keeps connection open', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to PG, expand public schema, and open customers table
    await actions.clickConnectionRailItem(0)
    await expandPgPublicSchema(window)
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Edit a cell to create pending changes
    await actions.editCell(0, 'city', `PendingTest${Date.now()}`)

    // Click header disconnect — should show warning dialog
    await window.getByTestId('header-disconnect-btn').click()

    // Discard warning dialog should appear
    const cancelBtn = window.getByTestId('confirm-dialog-cancel')
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 })

    // Cancel — connection should stay open
    await cancelBtn.click()
    await expect(cancelBtn).not.toBeVisible({ timeout: 5_000 })

    // Both connections should still be in the rail
    expect(await actions.getConnectionRailItemCount()).toBe(2)

    // Data grid should still be visible with the table open
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Pending Changes Warning — Close via Rail
// ---------------------------------------------------------------------------
test.describe('Pending Changes Warning — Close via Rail', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('close via rail with pending changes shows discard warning', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to PG, expand public schema, and open customers table
    await actions.clickConnectionRailItem(0)
    await expandPgPublicSchema(window)
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Edit a cell to create pending changes
    await actions.editCell(0, 'city', `RailPending${Date.now()}`)

    // Right-click PG item in rail and close — should show warning
    await actions.closeConnectionViaRail(0)

    // Discard warning dialog should appear
    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })

    // Confirm discard
    await confirmBtn.click()
    await expect(confirmBtn).not.toBeVisible({ timeout: 10_000 })

    // PG should be disconnected, only MySQL remains
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('cancel discard via rail keeps connection open', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to PG, expand public schema, and open customers table
    await actions.clickConnectionRailItem(0)
    await expandPgPublicSchema(window)
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Edit a cell to create pending changes
    await actions.editCell(0, 'city', `RailCancel${Date.now()}`)

    // Right-click PG item in rail and close — should show warning
    await actions.closeConnectionViaRail(0)

    // Cancel the discard
    const cancelBtn = window.getByTestId('confirm-dialog-cancel')
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 })
    await cancelBtn.click()
    await expect(cancelBtn).not.toBeVisible({ timeout: 5_000 })

    // Both connections should still be in the rail
    expect(await actions.getConnectionRailItemCount()).toBe(2)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Pending Changes Isolation Between Connections
// ---------------------------------------------------------------------------
test.describe('Pending Changes Isolation', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('pending changes on connection A do not block disconnect of connection B', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to PG, expand public schema, and open customers table to create pending changes
    await actions.clickConnectionRailItem(0)
    await expandPgPublicSchema(window)
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })
    await actions.editCell(0, 'city', `IsolationTest${Date.now()}`)

    // Switch to MySQL and disconnect it — should NOT show warning
    // (pending changes are on PG, not MySQL)
    await actions.clickConnectionRailItem(1)
    await window.getByTestId('header-disconnect-btn').click()

    // No discard dialog should appear — MySQL disconnects immediately
    // Rail should disappear (only PG left)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // PG should auto-become active with its sidebar
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Close Others with Pending Changes
// ---------------------------------------------------------------------------
test.describe('Close Others with Pending Changes', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('close others shows warning when other connections have pending changes', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to MySQL and open customers table, create pending changes
    await actions.clickConnectionRailItem(1)
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })
    await actions.editCell(0, 'city', `CloseOthers${Date.now()}`)

    // Right-click PG item → Close Others (which would close MySQL that has changes)
    await actions.closeOtherConnectionsViaRail(0)

    // Discard warning dialog should appear
    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })

    // Confirm discard
    await confirmBtn.click()
    await expect(confirmBtn).not.toBeVisible({ timeout: 10_000 })

    // Rail should disappear (only PG remains)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })

    // PG should be active
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Command Palette Per-Connection
// ---------------------------------------------------------------------------
test.describe('Command Palette Per-Connection', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('command palette searches tables for active connection', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to PG
    await actions.clickConnectionRailItem(0)
    await window.waitForTimeout(500)

    // Open command palette via Cmd+P
    await window.keyboard.press('Meta+p')
    const dialog = window.getByTestId('command-palette')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Search for "customers" — should find PG's customers table
    const searchInput = window.getByTestId('command-palette-input')
    await searchInput.fill('customers')
    await window.waitForTimeout(1_000)

    // Should show results containing "customers"
    const results = dialog.locator('[data-testid^="command-palette-result-"]', { hasText: 'customers' })
    await expect(results.first()).toBeVisible({ timeout: 5_000 })

    // Close palette
    await window.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    // Switch to MySQL and verify command palette also works
    await actions.clickConnectionRailItem(1)
    await window.waitForTimeout(500)

    await window.keyboard.press('Meta+p')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    const searchInput2 = window.getByTestId('command-palette-input')
    await searchInput2.fill('customers')
    await window.waitForTimeout(1_000)

    // Should also find MySQL's customers table
    const results2 = dialog.locator('[data-testid^="command-palette-result-"]', { hasText: 'customers' })
    await expect(results2.first()).toBeVisible({ timeout: 5_000 })

    await window.keyboard.press('Escape')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ER Diagram Per-Connection
// ---------------------------------------------------------------------------
test.describe('ER Diagram Per-Connection', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('ER diagram opens for active connection', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to PG
    await actions.clickConnectionRailItem(0)
    await window.waitForTimeout(500)

    // Open ER Diagram via More menu
    const moreMenu = window.getByTestId('header-more-menu-btn')
    await moreMenu.click()
    const erBtn = window.getByTestId('header-erdiagram-btn')
    await erBtn.click()

    // ER Diagram should load
    await expect(window.getByTestId('er-diagram')).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Connection Picker Dialog
// ---------------------------------------------------------------------------
test.describe('Connection Picker Dialog', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('connection picker opens and lists connections', async () => {
    await connectTo(window, 'postgres')

    // The Connection Picker button
    const plugBtn = window.getByTestId('header-connection-picker-btn')
    await plugBtn.click()

    // Connection Picker dialog should appear
    const dialog = window.getByTestId('connection-picker-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('connection-picker-title')).toBeVisible()

    // Search input should be present
    const searchInput = window.getByTestId('connection-picker-search')
    await expect(searchInput).toBeVisible()

    // Close the dialog
    await window.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Same Database Connected Twice
// ---------------------------------------------------------------------------
test.describe('Same Database Connected Twice', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('same database type connected twice shows two rail items', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'postgres')

    // Rail should be visible with 2 items (both PostgreSQL)
    const actions = userActions(window)
    expect(await actions.getConnectionRailItemCount()).toBe(2)

    const rail = new ConnectionRailComponent(window)

    // Both items should show "zequel" label
    await expect(rail.item(0)).toContainText('zequel')
    await expect(rail.item(1)).toContainText('zequel')

    // Switching between them should work
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })

    await actions.clickConnectionRailItem(1)
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })

    // Close one — rail disappears, remaining PG session stays
    await actions.closeConnectionViaRail(1)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Move to New Window
// ---------------------------------------------------------------------------
test.describe('Move to New Window', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('move connection to new window opens second window', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const rail = new ConnectionRailComponent(window)

    // Right-click PG (index 0) → Move to New Window
    const newWindowPromise = app.waitForEvent('window')
    await rail.item(0).click({ button: 'right' })
    await rail.moveToWindowMenuItem.click()
    const newWindow = await newWindowPromise

    // Original window: only MySQL remains → rail disappears
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 15_000 })
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })

    // New window: PG sidebar loads
    await expect(newWindow.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Database Switching
// ---------------------------------------------------------------------------
test.describe('Database Switching', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('database manager opens for the active connection', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Switch to MySQL (index 1)
    await actions.clickConnectionRailItem(1)
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })

    // Database manager button should be visible for MySQL
    await expect(window.getByTestId('header-dbmanager-btn')).toBeVisible({ timeout: 5_000 })

    // Click it → dialog opens
    await window.getByTestId('header-dbmanager-btn').click()
    await expect(window.getByTestId('dbmanager-dialog')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Active Tab Per-Session Tracking
// ---------------------------------------------------------------------------
test.describe('Active Tab Per-Session Tracking', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('switching connections restores last-active tab', async () => {
    await connectTo(window, 'postgres')

    // Open "customers" table on PG
    await window.getByTestId('sidebar-table-customers').getByTestId('sidebar-table-name').click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Connect second DB (MySQL)
    await connectSecondDb(window, 'mysql')

    // Open query editor on MySQL
    const actions = userActions(window)
    await actions.openQueryEditor()
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Switch back to PG → "customers" tab should be restored
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('tab-public.customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Switch to MySQL → query editor should be restored
    await actions.clickConnectionRailItem(1)
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Switch back to PG again → customers tab is still there (round-trip)
    await actions.clickConnectionRailItem(0)
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Query Log Per-Connection
// ---------------------------------------------------------------------------
test.describe('Query Log Per-Connection', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('sidebar history tab loads per connection', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)

    // Run a query on PG (index 0)
    await actions.clickConnectionRailItem(0)
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS pg_test')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Run a query on MySQL (index 1)
    await actions.clickConnectionRailItem(1)
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS mysql_test')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to History tab — should load without error
    await actions.switchSidebarTab('history')
    await expect(window.getByTestId('sidebar-tab-history')).toBeVisible()

    // Switch to PG and verify history tab still accessible
    await actions.clickConnectionRailItem(0)
    await actions.switchSidebarTab('history')
    await expect(window.getByTestId('sidebar-tab-history')).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Server Version Per-Session
// ---------------------------------------------------------------------------
test.describe('Server Version Per-Session', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('header breadcrumb shows correct server version when switching', async () => {
    await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    const actions = userActions(window)
    const breadcrumb = window.getByTestId('header-breadcrumb')

    // PG is rail item 0 — breadcrumb should contain "PostgreSQL" in the version
    await actions.clickConnectionRailItem(0)
    await expect(breadcrumb).toContainText('PostgreSQL', { timeout: 10_000 })

    // Switch to MySQL — breadcrumb should change (MySQL version is bare number like "8.4.8")
    await actions.clickConnectionRailItem(1)
    await expect(breadcrumb).not.toContainText('PostgreSQL', { timeout: 10_000 })
    // Breadcrumb should still contain connection info (e.g. "zequel")
    await expect(breadcrumb).toContainText('zequel', { timeout: 5_000 })

    // Switch back to PG — breadcrumb should show PostgreSQL again
    await actions.clickConnectionRailItem(0)
    await expect(breadcrumb).toContainText('PostgreSQL', { timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})
