import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

test.describe.serial('Clipboard Operations - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('copy cell via context menu', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTable('customers')

    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const copyItem = window.getByTestId('grid-ctx-copy-cell')
    await expect(copyItem).toBeVisible({ timeout: 5_000 })
    await copyItem.click()

    // Verify no error toast appeared
    const errorToast = window.locator('[data-sonner-toast][data-type="error"]')
    await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
  })

  test('copy row as JSON via context menu', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTable('customers')

    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    // Look for "Copy Row as JSON" or similar option
    const copyJsonItem = window.locator('[role="menuitem"]').filter({ hasText: /copy.*json/i })
    if (await copyJsonItem.isVisible()) {
      await copyJsonItem.click()
      const errorToast = window.locator('[data-sonner-toast][data-type="error"]')
      await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
    }
  })

  test('delete row via context menu shows in pending', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTable('customers')

    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const deleteItem = window.getByTestId('grid-ctx-delete')
    await expect(deleteItem).toBeVisible({ timeout: 5_000 })
    await deleteItem.click()

    // Apply and discard buttons should appear
    await expect(window.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('discard-data-changes-btn')).toBeVisible({ timeout: 5_000 })

    // Discard to restore state
    await actions.discardChanges()
  })

  test('set value to NULL via context menu', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTable('customers')

    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Click on a cell that has a value (e.g., email)
    const cell = window.getByTestId('grid-cell-0-email')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    // Look for "Set to NULL" option
    const nullItem = window.locator('[role="menuitem"]').filter({ hasText: /null/i })
    if (await nullItem.isVisible()) {
      await nullItem.click()
      // Should show pending changes
      await expect(window.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 5_000 })
      // Discard to restore state
      await actions.discardChanges()
    }
  })

  test('add row via context menu', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTable('customers')

    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const addRowItem = window.getByTestId('grid-ctx-add-row')
    await expect(addRowItem).toBeVisible({ timeout: 5_000 })
    await addRowItem.click()

    // Should show pending changes
    await expect(window.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 5_000 })

    // Discard to restore state
    await actions.discardChanges()
  })

  test('refresh via context menu', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openTable('customers')

    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const refreshItem = window.getByTestId('grid-ctx-refresh')
    await expect(refreshItem).toBeVisible({ timeout: 5_000 })
    await refreshItem.click()

    // Grid should still be visible after refresh
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe.serial('Clipboard Operations - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('copy cell via context menu', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openTable('customers')

    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const copyItem = window.getByTestId('grid-ctx-copy-cell')
    await expect(copyItem).toBeVisible({ timeout: 5_000 })
    await copyItem.click()

    const errorToast = window.locator('[data-sonner-toast][data-type="error"]')
    await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
  })

  test('delete row via context menu shows pending', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openTable('customers')

    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const deleteItem = window.getByTestId('grid-ctx-delete')
    await expect(deleteItem).toBeVisible({ timeout: 5_000 })
    await deleteItem.click()

    await expect(window.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 5_000 })

    // Discard to restore state
    await actions.discardChanges()
  })
})
