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
// PostgreSQL Import Dialog Tests
// ---------------------------------------------------------------------------
test.describe.serial('Import Dialog - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('header import button is visible after connecting', async () => {
    await connectTo(window, 'postgres')

    await openMoreMenu(window)

    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
  })

  test('import button shows Restore / Import text', async () => {
    await connectTo(window, 'postgres')

    await openMoreMenu(window)

    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await expect(importBtn).toContainText('Restore / Import')
  })

  test('import button opens a table with CSV and JSON format options in toolbar', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table to get the grid toolbar with import format options
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // The grid toolbar has an Import dropdown with CSV and JSON options
    const importDropdownBtn = window.locator('button', { hasText: 'Import' })
    await expect(importDropdownBtn.first()).toBeVisible({ timeout: 5_000 })
    await importDropdownBtn.first().click()

    // Verify CSV option is present
    const csvOption = window.locator('[role="menuitem"]', { hasText: 'Import CSV' })
    await expect(csvOption).toBeVisible({ timeout: 5_000 })
  })

  test('JSON option is present in the import format menu', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open the import dropdown in the grid toolbar
    const importDropdownBtn = window.locator('button', { hasText: 'Import' })
    await expect(importDropdownBtn.first()).toBeVisible({ timeout: 5_000 })
    await importDropdownBtn.first().click()

    // Verify JSON option is present
    const jsonOption = window.locator('[role="menuitem"]', { hasText: 'Import JSON' })
    await expect(jsonOption).toBeVisible({ timeout: 5_000 })
  })

  test('clicking a format option does not cause an error toast', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open the import dropdown in the grid toolbar
    const importDropdownBtn = window.locator('button', { hasText: 'Import' })
    await expect(importDropdownBtn.first()).toBeVisible({ timeout: 5_000 })
    await importDropdownBtn.first().click()

    // Click CSV option — this triggers a native file dialog which we cannot
    // interact with, but the app should not produce an error toast.
    const csvOption = window.locator('[role="menuitem"]', { hasText: 'Import CSV' })
    await expect(csvOption).toBeVisible({ timeout: 5_000 })
    await csvOption.click()

    await window.waitForTimeout(2_000)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Import Dialog Tests
// ---------------------------------------------------------------------------
test.describe.serial('Import Dialog - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('import button is visible on MySQL connection', async () => {
    await connectTo(window, 'mysql')

    await openMoreMenu(window)

    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await expect(importBtn).toContainText('Restore / Import')
  })
})

// ---------------------------------------------------------------------------
// SQLite Import Dialog Tests
// ---------------------------------------------------------------------------
test.describe.serial('Import Dialog - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('import button is visible on SQLite connection', async () => {
    await connectTo(window, 'sqlite')

    await openMoreMenu(window)

    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await expect(importBtn).toContainText('Restore / Import')
  })
})

// ---------------------------------------------------------------------------
// Import Dialog UI (table-level import via toolbar)
// ---------------------------------------------------------------------------
test.describe.serial('Import Dialog UI - Table Toolbar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('import dialog elements are available if dialog can be shown', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // The import dialog requires a file to be selected via native OS dialog.
    // Since Playwright cannot automate native file dialogs in Electron, we
    // verify the toolbar import button exists and clicking a format option
    // does not crash. The import-dialog, import-headers-toggle, and
    // import-cancel-btn test IDs would only be visible after a file is
    // successfully selected, which we cannot automate here.
    const importDropdownBtn = window.locator('button', { hasText: 'Import' })
    await expect(importDropdownBtn.first()).toBeVisible({ timeout: 5_000 })
    await importDropdownBtn.first().click()

    // All three format options should be available
    const csvOption = window.locator('[role="menuitem"]', { hasText: 'Import CSV' })
    const jsonOption = window.locator('[role="menuitem"]', { hasText: 'Import JSON' })
    const sqlOption = window.locator('[role="menuitem"]', { hasText: 'Import SQL' })
    await expect(csvOption).toBeVisible({ timeout: 5_000 })
    await expect(jsonOption).toBeVisible({ timeout: 5_000 })
    await expect(sqlOption).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})
