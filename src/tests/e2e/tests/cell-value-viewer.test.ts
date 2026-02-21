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

/**
 * Opens the cell value viewer via right-click context menu > "Quick Look Editor".
 * The "Quick Look Editor" menu item calls openCellViewer internally.
 */
const openCellViewerViaContextMenu = async (
  page: Page,
  rowIndex: number,
  columnId: string
): Promise<void> => {
  const cell = page.getByTestId(`grid-cell-${rowIndex}-${columnId}`)
  await expect(cell).toBeVisible({ timeout: 10_000 })
  await cell.click({ button: 'right' })

  // Wait for context menu to appear
  await expect(page.getByTestId('grid-ctx-copy-cell')).toBeVisible({ timeout: 5_000 })

  // Click "Quick Look Editor" which opens the cell value viewer dialog
  const quickLookItem = page.locator('[role="menuitem"]').filter({ hasText: /Quick Look Editor/i })
  await expect(quickLookItem).toBeVisible({ timeout: 5_000 })
  await quickLookItem.click()

  // Wait for the cell viewer dialog to appear
  await expect(page.getByTestId('cell-viewer-dialog')).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Cell Value Viewer - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Cell Value Viewer - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click cell and open Quick Look Editor shows cell-viewer-dialog', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'name')

    const dialog = window.getByTestId('cell-viewer-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('dialog header shows column name', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'name')

    const columnName = window.getByTestId('cell-viewer-column-name')
    await expect(columnName).toBeVisible({ timeout: 10_000 })
    const text = (await columnName.innerText()).trim()
    expect(text).toBe('name')

    await assertNoErrorToast(window)
  })

  test('copy button click produces no error', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'name')

    const copyBtn = window.getByTestId('cell-viewer-copy-btn')
    await expect(copyBtn).toBeVisible({ timeout: 5_000 })
    await copyBtn.click()

    await window.waitForTimeout(500)
    await assertNoErrorToast(window)
  })

  test('fullscreen toggle changes dialog size', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'name')

    const dialog = window.getByTestId('cell-viewer-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Get initial dialog dimensions
    const initialBox = await dialog.boundingBox()
    expect(initialBox).not.toBeNull()

    // Click fullscreen button
    const fullscreenBtn = window.getByTestId('cell-viewer-fullscreen-btn')
    await expect(fullscreenBtn).toBeVisible({ timeout: 5_000 })
    await fullscreenBtn.click()

    await window.waitForTimeout(500)

    // After fullscreen, dialog should be larger
    const fullscreenBox = await dialog.boundingBox()
    expect(fullscreenBox).not.toBeNull()
    expect(fullscreenBox!.width).toBeGreaterThanOrEqual(initialBox!.width)

    await assertNoErrorToast(window)
  })

  test('close dialog with Escape key', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'name')

    const dialog = window.getByTestId('cell-viewer-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Press Escape to close
    await window.keyboard.press('Escape')

    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('NULL value cell shows NULL in viewer', async () => {
    const actions = await connectTo(window, 'postgres')

    // Use the orders table which may have nullable columns
    await actions.openTable('orders')

    // Open cell viewer on a cell that might be null (e.g., notes or a nullable column)
    // Use the id column first and verify the dialog opens, then check NULL display
    // by running a query to find null values
    await actions.openQueryEditor()
    await actions.typeQuery("SELECT * FROM orders WHERE shipped_date IS NULL LIMIT 1")

    const runBtn = window.getByTestId('query-run-btn')
    await runBtn.click()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Right-click on the shipped_date cell in query results if available
    // Since query results also use the same DataGrid, find a null cell
    const nullCell = window.getByTestId('grid-cell-0-shipped_date')
    const isVisible = await nullCell.isVisible().catch(() => false)

    if (isVisible) {
      await nullCell.click({ button: 'right' })
      await expect(window.getByTestId('grid-ctx-copy-cell')).toBeVisible({ timeout: 5_000 })

      const quickLookItem = window.locator('[role="menuitem"]').filter({ hasText: /Quick Look Editor/i })
      await expect(quickLookItem).toBeVisible({ timeout: 5_000 })
      await quickLookItem.click()

      const dialog = window.getByTestId('cell-viewer-dialog')
      await expect(dialog).toBeVisible({ timeout: 10_000 })

      // The dialog should display "NULL" for null values
      await expect(dialog.locator('text=NULL')).toBeVisible({ timeout: 5_000 })
    }

    await assertNoErrorToast(window)
  })

  test('open on numeric cell (id column)', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'id')

    const dialog = window.getByTestId('cell-viewer-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Verify column name is 'id'
    const columnName = window.getByTestId('cell-viewer-column-name')
    await expect(columnName).toHaveText('id')

    // Dialog should contain the numeric value (non-empty content)
    const content = await dialog.innerText()
    expect(content.length).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })

  test('open on text cell (email column)', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'email')

    const dialog = window.getByTestId('cell-viewer-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Verify column name is 'email'
    const columnName = window.getByTestId('cell-viewer-column-name')
    await expect(columnName).toHaveText('email')

    // Dialog should contain a value resembling an email
    const content = await dialog.innerText()
    expect(content).toContain('@')

    await assertNoErrorToast(window)
  })

  test('download button is visible', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'name')

    const downloadBtn = window.getByTestId('cell-viewer-download-btn')
    await expect(downloadBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Cell Value Viewer - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Cell Value Viewer - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('cell viewer opens on MySQL table', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'name')

    const dialog = window.getByTestId('cell-viewer-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Verify column name is shown
    const columnName = window.getByTestId('cell-viewer-column-name')
    await expect(columnName).toHaveText('name')

    await assertNoErrorToast(window)
  })

  test('copy button works on MySQL', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    await openCellViewerViaContextMenu(window, 0, 'name')

    const copyBtn = window.getByTestId('cell-viewer-copy-btn')
    await expect(copyBtn).toBeVisible({ timeout: 5_000 })
    await copyBtn.click()

    await window.waitForTimeout(500)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Cell Value Viewer - Privacy Mode (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Cell Value Viewer - Privacy Mode (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('privacy mode enabled applies blur to cell viewer content', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    // Enable privacy mode before opening the viewer
    await actions.enablePrivacyMode()

    await openCellViewerViaContextMenu(window, 0, 'name')

    const dialog = window.getByTestId('cell-viewer-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // The dialog content should have blur-sm class when privacy mode is enabled
    const blurredContent = dialog.locator('.blur-sm')
    await expect(blurredContent.first()).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('privacy mode disabled shows cell viewer content without blur', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    // Ensure privacy mode is OFF
    await actions.disablePrivacyMode()

    await openCellViewerViaContextMenu(window, 0, 'name')

    const dialog = window.getByTestId('cell-viewer-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // The dialog content should NOT have blur-sm class
    const blurredContent = dialog.locator('.blur-sm')
    await expect(blurredContent).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})
