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

const openContextMenuOnCell = async (page: Page, rowIndex: number, columnId: string): Promise<void> => {
  const cell = page.getByTestId(`grid-cell-${rowIndex}-${columnId}`)
  await expect(cell).toBeVisible({ timeout: 10_000 })
  await cell.click({ button: 'right' })
  // Wait for context menu to appear
  await expect(page.getByTestId('grid-ctx-copy-cell')).toBeVisible({ timeout: 5_000 })
}

const dismissContextMenu = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// ---------------------------------------------------------------------------
// Context Menu Actions - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Context Menu Actions - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click cell shows copy cell option and clicking it causes no error', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openContextMenuOnCell(window, 0, 'name')

    const copyCellOption = window.getByTestId('grid-ctx-copy-cell')
    await expect(copyCellOption).toBeVisible()
    await copyCellOption.click()

    await window.waitForTimeout(500)
    await assertNoErrorToast(window)
  })

  test('right-click cell shows refresh option and clicking it reloads the grid', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await openContextMenuOnCell(window, 0, 'name')

    const refreshOption = window.getByTestId('grid-ctx-refresh')
    await expect(refreshOption).toBeVisible()
    await refreshOption.click()

    // Wait for grid to reload
    await window.waitForTimeout(1000)

    // Grid table should still be visible after refresh
    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('right-click cell shows add row option on editable table', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off for editable grid
    await actions.disableSafeMode()

    await actions.openTable('customers')

    await openContextMenuOnCell(window, 0, 'name')

    const addRowOption = window.getByTestId('grid-ctx-add-row')
    await expect(addRowOption).toBeVisible()

    await dismissContextMenu(window)
    await assertNoErrorToast(window)
  })

  test('right-click cell and click add row appends a new empty row', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.disableSafeMode()

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()

    await openContextMenuOnCell(window, 0, 'name')

    const addRowOption = window.getByTestId('grid-ctx-add-row')
    await addRowOption.click()

    await window.waitForTimeout(500)

    // Row count should increase by one
    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBe(rowsBefore + 1)

    // Pending changes buttons should be visible (apply/discard)
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    // Discard the added row to avoid side effects
    await actions.discardChanges()
  })

  test('right-click cell and click delete marks row for deletion with pending changes visible', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.disableSafeMode()

    await actions.openTable('products')

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const deleteOption = window.getByTestId('grid-ctx-delete')
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()

    await window.waitForTimeout(300)

    // Pending changes button should be visible after marking for deletion
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    // Discard the deletion to avoid side effects
    await actions.discardChanges()
  })

  test('right-click cell shows all expected menu items', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.disableSafeMode()

    await actions.openTable('customers')

    await openContextMenuOnCell(window, 0, 'name')

    // Read-only items
    await expect(window.getByTestId('grid-ctx-refresh')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-copy-cell')).toBeVisible()

    // Editable items (safe mode is off)
    await expect(window.getByTestId('grid-ctx-paste')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-add-row')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-delete')).toBeVisible()

    await dismissContextMenu(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Context Menu Actions - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Context Menu Actions - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click cell shows copy cell option', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    await openContextMenuOnCell(window, 0, 'name')

    const copyCellOption = window.getByTestId('grid-ctx-copy-cell')
    await expect(copyCellOption).toBeVisible()

    await dismissContextMenu(window)
    await assertNoErrorToast(window)
  })

  test('right-click cell and add row creates pending changes', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.disableSafeMode()

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()

    await openContextMenuOnCell(window, 0, 'name')

    const addRowOption = window.getByTestId('grid-ctx-add-row')
    await expect(addRowOption).toBeVisible()
    await addRowOption.click()

    await window.waitForTimeout(500)

    // Row count should increase
    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBe(rowsBefore + 1)

    // Pending changes should be visible
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    // Discard to avoid side effects
    await actions.discardChanges()
  })
})

// ---------------------------------------------------------------------------
// Context Menu - Read-Only (ClickHouse)
// ---------------------------------------------------------------------------
test.describe.serial('Context Menu - Read-Only (ClickHouse)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click on ClickHouse table shows read-only context menu items', async () => {
    const actions = await connectTo(window, 'clickhouse')

    // Enable safe mode to make grid non-editable
    await actions.enableSafeMode()

    await actions.openTable('events')

    await openContextMenuOnCell(window, 0, 'event_type')

    // Read-only items should be visible
    await expect(window.getByTestId('grid-ctx-refresh')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-copy-cell')).toBeVisible()

    // Editable items should NOT be visible in safe mode
    await expect(window.getByTestId('grid-ctx-add-row')).not.toBeVisible()
    await expect(window.getByTestId('grid-ctx-delete')).not.toBeVisible()
    await expect(window.getByTestId('grid-ctx-paste')).not.toBeVisible()

    await dismissContextMenu(window)
    await assertNoErrorToast(window)
  })

  test('copy cell works on ClickHouse read-only table', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openTable('events')

    await openContextMenuOnCell(window, 0, 'event_type')

    const copyCellOption = window.getByTestId('grid-ctx-copy-cell')
    await copyCellOption.click()

    await window.waitForTimeout(500)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Context Menu - Safe Mode Interaction (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Context Menu - Safe Mode Interaction', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('safe mode enabled hides add-row and delete from context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Enable safe mode
    await actions.enableSafeMode()

    // Right-click on a cell
    await openContextMenuOnCell(window, 0, 'name')

    // Read-only items should be visible
    await expect(window.getByTestId('grid-ctx-refresh')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-copy-cell')).toBeVisible()

    // Destructive items should NOT be visible
    await expect(window.getByTestId('grid-ctx-add-row')).not.toBeVisible()
    await expect(window.getByTestId('grid-ctx-delete')).not.toBeVisible()
    await expect(window.getByTestId('grid-ctx-paste')).not.toBeVisible()

    await dismissContextMenu(window)
    await assertNoErrorToast(window)
  })

  test('safe mode disabled shows add-row and delete in context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    await actions.openTable('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Right-click on a cell
    await openContextMenuOnCell(window, 0, 'name')

    // All items should be visible
    await expect(window.getByTestId('grid-ctx-refresh')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-copy-cell')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-add-row')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-delete')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-paste')).toBeVisible()

    await dismissContextMenu(window)
    await assertNoErrorToast(window)
  })

  test('toggling safe mode on then off restores editable context menu items', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.disableSafeMode()

    await actions.openTable('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Enable safe mode
    await actions.enableSafeMode()

    await openContextMenuOnCell(window, 0, 'name')
    await expect(window.getByTestId('grid-ctx-add-row')).not.toBeVisible()
    await expect(window.getByTestId('grid-ctx-delete')).not.toBeVisible()
    await dismissContextMenu(window)

    // Disable safe mode
    await actions.disableSafeMode()

    await openContextMenuOnCell(window, 0, 'name')
    await expect(window.getByTestId('grid-ctx-add-row')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-delete')).toBeVisible()
    await dismissContextMenu(window)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Context Menu - Copy Cell (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Context Menu - Copy Cell', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('copy cell value on a cell with known content produces no error', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    // Verify the cell has content
    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    const cellText = (await cell.innerText()).trim()
    expect(cellText.length).toBeGreaterThan(0)

    // Right-click and copy cell value
    await cell.click({ button: 'right' })
    const copyCellOption = window.getByTestId('grid-ctx-copy-cell')
    await expect(copyCellOption).toBeVisible({ timeout: 5_000 })
    await copyCellOption.click()

    await window.waitForTimeout(500)
    await assertNoErrorToast(window)
  })

  test('copy cell value on an id column produces no error', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const cell = window.getByTestId('grid-cell-0-id')
    await expect(cell).toBeVisible({ timeout: 10_000 })

    await cell.click({ button: 'right' })
    const copyCellOption = window.getByTestId('grid-ctx-copy-cell')
    await expect(copyCellOption).toBeVisible({ timeout: 5_000 })
    await copyCellOption.click()

    await window.waitForTimeout(500)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Context Menu Actions - SQLite
// ---------------------------------------------------------------------------
test.describe.serial('Context Menu Actions - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click shows context menu with all items', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.disableSafeMode()

    await actions.openTable('customers')

    await openContextMenuOnCell(window, 0, 'name')

    await expect(window.getByTestId('grid-ctx-refresh')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-copy-cell')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-add-row')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-delete')).toBeVisible()

    await dismissContextMenu(window)
    await assertNoErrorToast(window)
  })

  test('add row via context menu appends a new row', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.disableSafeMode()

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()

    await openContextMenuOnCell(window, 0, 'name')

    const addRowOption = window.getByTestId('grid-ctx-add-row')
    await addRowOption.click()

    await window.waitForTimeout(500)

    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBe(rowsBefore + 1)

    // Pending changes should appear
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    await actions.discardChanges()
  })

  test('delete row via context menu marks row for deletion', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.disableSafeMode()

    await actions.openTable('products')

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const deleteOption = window.getByTestId('grid-ctx-delete')
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()

    await window.waitForTimeout(300)

    // Pending changes should appear
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    await actions.discardChanges()
  })

  test('copy cell via context menu produces no error', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('customers')

    await openContextMenuOnCell(window, 0, 'name')

    const copyCellOption = window.getByTestId('grid-ctx-copy-cell')
    await copyCellOption.click()

    await window.waitForTimeout(500)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Context Menu Actions - SQL Server
// ---------------------------------------------------------------------------
test.describe.serial('Context Menu Actions - SQL Server', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click cell shows copy cell option and clicking it causes no error', async () => {
    const actions = await connectTo(window, 'sqlserver')

    await actions.openTable('customers')

    await openContextMenuOnCell(window, 0, 'name')

    const copyCellOption = window.getByTestId('grid-ctx-copy-cell')
    await expect(copyCellOption).toBeVisible()
    await copyCellOption.click()

    await window.waitForTimeout(500)
    await assertNoErrorToast(window)
  })

  test('add row via context menu appends a new row', async () => {
    const actions = await connectTo(window, 'sqlserver')

    await actions.disableSafeMode()

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()

    await openContextMenuOnCell(window, 0, 'name')

    const addRowOption = window.getByTestId('grid-ctx-add-row')
    await expect(addRowOption).toBeVisible()
    await addRowOption.click()

    await window.waitForTimeout(500)

    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBe(rowsBefore + 1)

    // Pending changes should be visible
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    await actions.discardChanges()
  })

  test('delete row via context menu marks row for deletion', async () => {
    const actions = await connectTo(window, 'sqlserver')

    await actions.disableSafeMode()

    await actions.openTable('products')

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const deleteOption = window.getByTestId('grid-ctx-delete')
    await expect(deleteOption).toBeVisible({ timeout: 5_000 })
    await deleteOption.click()

    await window.waitForTimeout(300)

    // Pending changes should appear
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    await actions.discardChanges()
  })

  test('right-click cell shows all expected menu items when editable', async () => {
    const actions = await connectTo(window, 'sqlserver')

    await actions.disableSafeMode()

    await actions.openTable('customers')

    await openContextMenuOnCell(window, 0, 'name')

    await expect(window.getByTestId('grid-ctx-refresh')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-copy-cell')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-paste')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-add-row')).toBeVisible()
    await expect(window.getByTestId('grid-ctx-delete')).toBeVisible()

    await dismissContextMenu(window)
    await assertNoErrorToast(window)
  })
})
