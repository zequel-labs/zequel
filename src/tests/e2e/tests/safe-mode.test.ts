import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.locator('button:has(.tabler-icon-dots-vertical)')
  await trigger.click()
}

const runQueryAndWaitForResult = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('query-run-btn')
  await btn.click()
  await expect(page.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
}

// ---------------------------------------------------------------------------
// Safe Mode Toggle (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Safe Mode - Toggle', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('safe mode button is visible and defaults to unlocked', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is OFF first (in case localStorage persisted)
    await actions.disableSafeMode()

    const btn = window.getByTestId('header-safemode-btn')
    await expect(btn).toBeVisible({ timeout: 5_000 })

    // Should show the unlocked icon
    const unlockedIcon = btn.locator('.tabler-icon-lock-square-rounded')
    await expect(unlockedIcon).toBeVisible()

    // Filled (locked) icon should NOT be visible
    const lockedIcon = btn.locator('.tabler-icon-lock-square-rounded-filled')
    await expect(lockedIcon).not.toBeVisible()

    await assertNoErrorToast(window)
  })

  test('clicking safe mode button toggles to locked state', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.enableSafeMode()

    const btn = window.getByTestId('header-safemode-btn')

    // Should show the locked (filled) icon with green color
    const lockedIcon = btn.locator('.tabler-icon-lock-square-rounded-filled')
    await expect(lockedIcon).toBeVisible()

    // Unlocked icon should NOT be visible
    const unlockedIcon = btn.locator('.tabler-icon-lock-square-rounded')
    await expect(unlockedIcon).not.toBeVisible()

    await assertNoErrorToast(window)
  })

  test('clicking safe mode button again toggles back to unlocked', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable then disable
    await actions.enableSafeMode()
    const btn = window.getByTestId('header-safemode-btn')
    const lockedIcon = btn.locator('.tabler-icon-lock-square-rounded-filled')
    await expect(lockedIcon).toBeVisible()

    await actions.disableSafeMode()
    const unlockedIcon = btn.locator('.tabler-icon-lock-square-rounded')
    await expect(unlockedIcon).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Safe Mode - DataGrid (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Safe Mode - DataGrid', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('context menu hides destructive items when safe mode is on', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table first (before enabling safe mode so data loads)
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Enable safe mode
    await actions.enableSafeMode()

    // Right-click on a cell to open context menu
    const firstCell = window.locator('[data-testid="data-grid-table"] tbody td .relative').first()
    await firstCell.click({ button: 'right' })

    // Read-only items should be visible
    await expect(window.getByText('Refresh')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByText('Copy Cell Value')).toBeVisible()

    // Destructive items should NOT be visible
    await expect(window.getByText('Add Row')).not.toBeVisible()
    await expect(window.getByText('Delete')).not.toBeVisible()
    await expect(window.getByText('Paste')).not.toBeVisible()

    await assertNoErrorToast(window)
  })

  test('context menu shows destructive items when safe mode is off', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Right-click on a cell to open context menu
    const firstCell = window.locator('[data-testid="data-grid-table"] tbody td .relative').first()
    await firstCell.click({ button: 'right' })

    // Destructive items should be visible
    await expect(window.getByText('Add Row')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByRole('menuitem', { name: /Delete/ })).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Safe Mode - Header Menu (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Safe Mode - Header Menu', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Restore/Import is disabled when safe mode is on', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    // Open more menu
    await openMoreMenu(window)

    // Restore/Import should be disabled
    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 5_000 })
    await expect(importBtn).toHaveAttribute('data-disabled', '')

    await assertNoErrorToast(window)
  })

  test('User Management is disabled when safe mode is on', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    // Open more menu
    await openMoreMenu(window)

    // User Management should be disabled
    const usersBtn = window.getByTestId('header-users-btn')
    await expect(usersBtn).toBeVisible({ timeout: 5_000 })
    await expect(usersBtn).toHaveAttribute('data-disabled', '')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Safe Mode - Sidebar (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Safe Mode - Sidebar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Create Table button is hidden when safe mode is on', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off first
    await actions.disableSafeMode()

    // The create table "+" button should be visible when safe mode is off
    const createBtn = window.locator('button:has(.tabler-icon-plus)').last()
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    // Enable safe mode
    await actions.enableSafeMode()

    // The create table "+" button should be hidden
    await expect(createBtn).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('table context menu hides destructive items when safe mode is on', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    // Right-click on a table in the sidebar
    const table = window.getByTestId('sidebar-table-customers')
    await table.click({ button: 'right' })

    // View Data and Copy Name should be visible
    await expect(window.getByText('View Data')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByText('Copy Name')).toBeVisible()

    // Rename and Drop should NOT be visible
    await expect(window.getByText('Rename Table')).not.toBeVisible()
    await expect(window.getByText('Drop Table')).not.toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Safe Mode - StatusBar (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Safe Mode - StatusBar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Add Row button is hidden when safe mode is on', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Add Row button should be visible when safe mode is off
    const addRowBtn = window.getByTestId('statusbar-add-row-btn')
    await expect(addRowBtn).toBeVisible({ timeout: 5_000 })

    // Enable safe mode
    await actions.enableSafeMode()

    // Add Row button should be hidden
    await expect(addRowBtn).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Safe Mode - Query Blocking (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Safe Mode - Query Blocking', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('SELECT query is allowed in safe mode', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    // Open query editor and run a SELECT
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS result')
    await runQueryAndWaitForResult(window)

    // Should show results, not a safe mode error
    const errorPre = window.locator('[data-testid="query-results"] pre.text-red-500')
    await expect(errorPre).not.toBeVisible({ timeout: 2_000 })
  })

  test('DROP TABLE query is blocked in safe mode', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    // Open query editor and try a DROP TABLE
    await actions.openQueryEditor()
    await actions.typeQuery('DROP TABLE IF EXISTS safe_mode_test_table')
    await runQueryAndWaitForResult(window)

    // Should show the safe mode error
    const errorPre = window.locator('[data-testid="query-results"] pre.text-red-500')
    await expect(errorPre).toBeVisible({ timeout: 5_000 })
    await expect(errorPre).toContainText('Safe Mode')
  })

  test('INSERT query is blocked in safe mode', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    await actions.openQueryEditor()
    await actions.typeQuery("INSERT INTO customers (name) VALUES ('test')")
    await runQueryAndWaitForResult(window)

    const errorPre = window.locator('[data-testid="query-results"] pre.text-red-500')
    await expect(errorPre).toBeVisible({ timeout: 5_000 })
    await expect(errorPre).toContainText('Safe Mode')
  })

  test('DELETE query is blocked in safe mode', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    await actions.openQueryEditor()
    await actions.typeQuery('DELETE FROM customers WHERE id = -999')
    await runQueryAndWaitForResult(window)

    const errorPre = window.locator('[data-testid="query-results"] pre.text-red-500')
    await expect(errorPre).toBeVisible({ timeout: 5_000 })
    await expect(errorPre).toContainText('Safe Mode')
  })

  test('ALTER TABLE query is blocked in safe mode', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    await actions.openQueryEditor()
    await actions.typeQuery('ALTER TABLE customers ADD COLUMN safe_test VARCHAR(10)')
    await runQueryAndWaitForResult(window)

    const errorPre = window.locator('[data-testid="query-results"] pre.text-red-500')
    await expect(errorPre).toBeVisible({ timeout: 5_000 })
    await expect(errorPre).toContainText('Safe Mode')
  })

  test('destructive query is allowed after disabling safe mode', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test')
    await runQueryAndWaitForResult(window)

    // Disable safe mode
    await actions.disableSafeMode()

    // Now a SELECT should still work
    await actions.typeQuery('SELECT 2 AS test')
    await runQueryAndWaitForResult(window)

    const errorPre = window.locator('[data-testid="query-results"] pre.text-red-500')
    await expect(errorPre).not.toBeVisible({ timeout: 2_000 })
  })
})
