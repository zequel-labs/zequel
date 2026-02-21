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
// PostgreSQL - Rename Table Dialog
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL - Rename Table Dialog', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click table shows Rename option in context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off so all options are visible
    await actions.disableSafeMode()

    // Right-click on a table in the sidebar
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })

    // Rename option should be visible
    await expect(window.getByTestId('context-menu-rename')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('clicking Rename opens dialog with current table name in input', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Right-click on a table and click Rename
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })
    const renameItem = window.getByTestId('context-menu-rename')
    await expect(renameItem).toBeVisible({ timeout: 5_000 })
    await renameItem.click()

    // Dialog should be visible
    await expect(window.getByTestId('rename-table-dialog')).toBeVisible({ timeout: 10_000 })

    // Input should contain the current table name
    const input = window.getByTestId('rename-table-input')
    await expect(input).toBeVisible({ timeout: 5_000 })
    await expect(input).toHaveValue('customers')

    await assertNoErrorToast(window)
  })

  test('SQL Preview toggle shows ALTER TABLE RENAME TO SQL', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Open the rename dialog
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })
    const renameItem = window.getByTestId('context-menu-rename')
    await expect(renameItem).toBeVisible({ timeout: 5_000 })
    await renameItem.click()
    await expect(window.getByTestId('rename-table-dialog')).toBeVisible({ timeout: 10_000 })

    // SQL preview should not be visible initially
    await expect(window.getByTestId('rename-table-preview')).not.toBeVisible()

    // Click the preview toggle
    await window.getByTestId('rename-table-preview-toggle').click()

    // SQL preview should now be visible and contain ALTER TABLE ... RENAME TO
    const preview = window.getByTestId('rename-table-preview')
    await expect(preview).toBeVisible({ timeout: 5_000 })
    await expect(preview).toContainText('ALTER TABLE')
    await expect(preview).toContainText('RENAME TO')
    await expect(preview).toContainText('customers')

    await assertNoErrorToast(window)
  })

  test('Cancel closes dialog without renaming', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Open the rename dialog
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })
    const renameItem = window.getByTestId('context-menu-rename')
    await expect(renameItem).toBeVisible({ timeout: 5_000 })
    await renameItem.click()
    await expect(window.getByTestId('rename-table-dialog')).toBeVisible({ timeout: 10_000 })

    // Click Cancel
    await window.getByTestId('rename-table-cancel-btn').click()

    // Dialog should close
    await expect(window.getByTestId('rename-table-dialog')).not.toBeVisible({ timeout: 5_000 })

    // The table should still be visible with its original name
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('Submit button disabled when name is unchanged', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Open the rename dialog
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })
    const renameItem = window.getByTestId('context-menu-rename')
    await expect(renameItem).toBeVisible({ timeout: 5_000 })
    await renameItem.click()
    await expect(window.getByTestId('rename-table-dialog')).toBeVisible({ timeout: 10_000 })

    // Input has the current name "customers" — submit should be disabled
    const submitBtn = window.getByTestId('rename-table-submit-btn')
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })
    await expect(submitBtn).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('Submit button disabled when name is empty', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Open the rename dialog
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })
    const renameItem = window.getByTestId('context-menu-rename')
    await expect(renameItem).toBeVisible({ timeout: 5_000 })
    await renameItem.click()
    await expect(window.getByTestId('rename-table-dialog')).toBeVisible({ timeout: 10_000 })

    // Clear the input
    const input = window.getByTestId('rename-table-input')
    await input.clear()
    await expect(input).toHaveValue('')

    // Submit button should be disabled
    const submitBtn = window.getByTestId('rename-table-submit-btn')
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })
    await expect(submitBtn).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('rename table, verify sidebar updates, then rename back', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Right-click on "customers" table and open rename dialog
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })
    const renameItem = window.getByTestId('context-menu-rename')
    await expect(renameItem).toBeVisible({ timeout: 5_000 })
    await renameItem.click()
    await expect(window.getByTestId('rename-table-dialog')).toBeVisible({ timeout: 10_000 })

    // Clear the input and type the new name
    const input = window.getByTestId('rename-table-input')
    await input.clear()
    await input.fill('customers_renamed')

    // Submit button should now be enabled
    const submitBtn = window.getByTestId('rename-table-submit-btn')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    // Dialog should close
    await expect(window.getByTestId('rename-table-dialog')).not.toBeVisible({ timeout: 10_000 })

    // Sidebar should show the new name
    await expect(window.getByTestId('sidebar-table-customers_renamed')).toBeVisible({ timeout: 15_000 })

    // The old name should no longer be visible
    await expect(window.getByTestId('sidebar-table-customers')).not.toBeVisible({ timeout: 5_000 })

    // Rename it back to the original name
    await window.getByTestId('sidebar-table-customers_renamed').click({ button: 'right' })
    const renameItem2 = window.getByTestId('context-menu-rename')
    await expect(renameItem2).toBeVisible({ timeout: 5_000 })
    await renameItem2.click()
    await expect(window.getByTestId('rename-table-dialog')).toBeVisible({ timeout: 10_000 })

    const input2 = window.getByTestId('rename-table-input')
    await input2.clear()
    await input2.fill('customers')

    const submitBtn2 = window.getByTestId('rename-table-submit-btn')
    await expect(submitBtn2).toBeEnabled({ timeout: 5_000 })
    await submitBtn2.click()

    // Dialog should close
    await expect(window.getByTestId('rename-table-dialog')).not.toBeVisible({ timeout: 10_000 })

    // Sidebar should show the original name again
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Safe Mode - Rename Table
// ---------------------------------------------------------------------------
test.describe.serial('Safe Mode - Rename Table', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Rename option is hidden when safe mode is on', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    // Right-click on a table
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })

    // View Data and Copy Name should be visible
    await expect(window.getByTestId('context-menu-view-data')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('context-menu-copy-name')).toBeVisible()

    // Rename should NOT be visible in safe mode
    await expect(window.getByTestId('context-menu-rename')).not.toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL - Rename Table Dialog
// ---------------------------------------------------------------------------
test.describe.serial('MySQL - Rename Table Dialog', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('rename dialog works on MySQL', async () => {
    const actions = await connectTo(window, 'mysql')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Right-click on a table and click Rename
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })
    const renameItem = window.getByTestId('context-menu-rename')
    await expect(renameItem).toBeVisible({ timeout: 5_000 })
    await renameItem.click()

    // Dialog should be visible
    await expect(window.getByTestId('rename-table-dialog')).toBeVisible({ timeout: 10_000 })

    // Input should contain the current table name
    const input = window.getByTestId('rename-table-input')
    await expect(input).toBeVisible({ timeout: 5_000 })
    await expect(input).toHaveValue('customers')

    // Submit button should be disabled (name unchanged)
    const submitBtn = window.getByTestId('rename-table-submit-btn')
    await expect(submitBtn).toBeDisabled()

    // Cancel button should be visible and functional
    await window.getByTestId('rename-table-cancel-btn').click()
    await expect(window.getByTestId('rename-table-dialog')).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite - Rename Table Dialog
// ---------------------------------------------------------------------------
test.describe.serial('SQLite - Rename Table Dialog', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('rename dialog works on SQLite', async () => {
    const actions = await connectTo(window, 'sqlite')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Right-click on a table and click Rename
    await window.getByTestId('sidebar-table-customers').click({ button: 'right' })
    const renameItem = window.getByTestId('context-menu-rename')
    await expect(renameItem).toBeVisible({ timeout: 5_000 })
    await renameItem.click()

    // Dialog should be visible
    await expect(window.getByTestId('rename-table-dialog')).toBeVisible({ timeout: 10_000 })

    // Input should contain the current table name
    const input = window.getByTestId('rename-table-input')
    await expect(input).toBeVisible({ timeout: 5_000 })
    await expect(input).toHaveValue('customers')

    // Submit button should be disabled (name unchanged)
    const submitBtn = window.getByTestId('rename-table-submit-btn')
    await expect(submitBtn).toBeDisabled()

    // Cancel button should be visible and functional
    await window.getByTestId('rename-table-cancel-btn').click()
    await expect(window.getByTestId('rename-table-dialog')).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})
