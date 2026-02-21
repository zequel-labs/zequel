import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// PostgreSQL – Multiple Cell Edits Before Apply
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL – Multiple Cell Edits Before Apply', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit two cells in different rows and apply at once', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    // Capture original values
    const cell0 = window.getByTestId('grid-cell-0-name')
    await expect(cell0).toBeVisible({ timeout: 10_000 })
    const original0 = (await cell0.innerText()).trim()

    const cell1 = window.getByTestId('grid-cell-1-name')
    await expect(cell1).toBeVisible({ timeout: 10_000 })
    const original1 = (await cell1.innerText()).trim()

    const newName0 = `E2E Batch0 ${Date.now()}`
    const newName1 = `E2E Batch1 ${Date.now()}`

    // Edit row 0
    await actions.editCell(0, 'name', newName0)

    // Edit row 1
    await actions.editCell(1, 'name', newName1)

    // Both edits are pending — apply button should be visible
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    // Apply all at once
    await actions.applyChanges()

    // After apply, verify the grid contains both new values
    await window.waitForTimeout(1000)
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toContainText(newName0, { timeout: 10_000 })
    await expect(grid).toContainText(newName1, { timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL – Edit Then Discard
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL – Edit Then Discard', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit a cell and discard reverts to original value', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const nameCell = window.getByTestId('grid-cell-0-name')
    await expect(nameCell).toBeVisible({ timeout: 10_000 })

    const originalName = (await nameCell.innerText()).trim()
    const tempName = `TempDiscard${Date.now()}`

    await actions.editCell(0, 'name', tempName)

    // Discard button should appear
    const discardBtn = window.getByTestId('discard-data-changes-btn')
    await expect(discardBtn).toBeVisible({ timeout: 5_000 })

    // Discard changes
    await actions.discardChanges()

    // Cell should revert to original value
    const revertedText = (await nameCell.innerText()).trim()
    expect(revertedText).toBe(originalName)

    // Apply button should no longer be visible
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).not.toBeVisible({ timeout: 3_000 })
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL – Add Multiple Rows
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL – Add Multiple Rows', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('add two rows, fill values, and apply at once', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()

    // Add first row
    await actions.addRow()
    const rowsAfterFirst = await actions.getRowCount()
    const firstNewIndex = rowsAfterFirst - 1

    const uniqueName1 = `E2E PG Multi1 ${Date.now()}`
    await actions.editCell(firstNewIndex, 'name', uniqueName1)
    await actions.editCell(firstNewIndex, 'category', 'E2E Category')
    await actions.editCell(firstNewIndex, 'price', '11.11')
    await actions.editCell(firstNewIndex, 'stock', '10')

    // Add second row
    await actions.addRow()
    const rowsAfterSecond = await actions.getRowCount()
    const secondNewIndex = rowsAfterSecond - 1

    const uniqueName2 = `E2E PG Multi2 ${Date.now()}`
    await actions.editCell(secondNewIndex, 'name', uniqueName2)
    await actions.editCell(secondNewIndex, 'category', 'E2E Category')
    await actions.editCell(secondNewIndex, 'price', '22.22')
    await actions.editCell(secondNewIndex, 'stock', '20')

    // Apply all at once
    await actions.applyChanges()

    // Verify both rows are present in the grid
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toContainText(uniqueName1, { timeout: 10_000 })
    await expect(grid).toContainText(uniqueName2, { timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL – Delete Multiple Rows
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL – Delete Multiple Rows', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('delete two rows and apply at once', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()
    expect(rowsBefore).toBeGreaterThanOrEqual(2)

    // Delete row 0, then row 1 (which shifts to index 0 after first delete
    // is marked pending — but the grid keeps pending deletes visible with
    // strikethrough, so indices remain stable until apply).
    await actions.deleteRow(0, 'name')
    await actions.deleteRow(1, 'name')

    // Apply button should be visible
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    await actions.applyChanges()

    // Verify row count decreased by 2
    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore - 2)
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL – Mixed Operations (edit + add + delete)
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL – Mixed Operations', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit a cell, add a new row, delete another row, then apply', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()
    expect(rowsBefore).toBeGreaterThanOrEqual(2)

    // 1. Edit an existing cell
    const editedName = `E2E Mixed Edit ${Date.now()}`
    await actions.editCell(0, 'name', editedName)

    // 2. Add a new row
    await actions.addRow()
    const rowsAfterAdd = await actions.getRowCount()
    const newRowIndex = rowsAfterAdd - 1

    const addedName = `E2E Mixed Add ${Date.now()}`
    await actions.editCell(newRowIndex, 'name', addedName)
    await actions.editCell(newRowIndex, 'category', 'E2E Mixed')
    await actions.editCell(newRowIndex, 'price', '33.33')
    await actions.editCell(newRowIndex, 'stock', '30')

    // 3. Delete another row (row 1)
    await actions.deleteRow(1, 'name')

    // Apply all mixed changes
    await actions.applyChanges()

    // Verify the edited and added names exist in the grid
    await window.waitForTimeout(1000)
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toContainText(editedName, { timeout: 10_000 })
    await expect(grid).toContainText(addedName, { timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL – Cancel Edit with Escape
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL – Cancel Edit with Escape', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('double-click to edit, press Escape to cancel, no pending changes', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })

    const originalValue = (await cell.innerText()).trim()

    // Double-click to start editing
    await cell.dblclick()

    const input = window.getByTestId('grid-cell-edit-input')
    await expect(input).toBeVisible({ timeout: 5_000 })

    // Type something but do not confirm
    await input.fill('ShouldNotPersist')

    // Press Escape to cancel
    await input.press('Escape')
    await expect(input).not.toBeVisible({ timeout: 3_000 })

    // Cell should still show the original value
    const currentValue = (await cell.innerText()).trim()
    expect(currentValue).toBe(originalValue)

    // No pending changes — apply button should not be visible
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).not.toBeVisible({ timeout: 3_000 })
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL – Edit Cell with Empty Value
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL – Edit Cell with Empty Value', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit name cell to empty string', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const nameCell = window.getByTestId('grid-cell-0-name')
    await expect(nameCell).toBeVisible({ timeout: 10_000 })

    // Edit cell to empty string
    await actions.editCell(0, 'name', '')

    // The apply button should appear (there is a pending change)
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    // Discard to avoid side effects on other tests
    await actions.discardChanges()
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL – Add Row and Delete Before Apply
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL – Add Row and Delete Before Apply', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('add a new row then delete it before applying cancels out', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()

    // Add a new row
    await actions.addRow()
    const rowsAfterAdd = await actions.getRowCount()
    expect(rowsAfterAdd).toBe(rowsBefore + 1)

    const newRowIndex = rowsAfterAdd - 1

    // Delete the newly added row before applying
    await actions.deleteRow(newRowIndex, 'name')

    // Discard any remaining pending state to clean up
    // If the add and delete cancel out, apply button may or may not be visible.
    // Either discard or verify no pending changes remain.
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    const isPending = await applyBtn.isVisible().catch(() => false)

    if (isPending) {
      // If there are still pending changes, discard them
      await actions.discardChanges()
    }

    // Row count should be back to original
    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBe(rowsBefore)
  })
})

// ---------------------------------------------------------------------------
// MySQL – Multiple Cell Edits
// ---------------------------------------------------------------------------
test.describe.serial('MySQL – Multiple Cell Edits', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit two cells in different rows and apply at once', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('products')

    const cell0 = window.getByTestId('grid-cell-0-name')
    await expect(cell0).toBeVisible({ timeout: 10_000 })

    const cell1 = window.getByTestId('grid-cell-1-name')
    await expect(cell1).toBeVisible({ timeout: 10_000 })

    const newName0 = `E2E MY Batch0 ${Date.now()}`
    const newName1 = `E2E MY Batch1 ${Date.now()}`

    await actions.editCell(0, 'name', newName0)
    await actions.editCell(1, 'name', newName1)

    // Apply button should be visible with pending changes
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    await actions.applyChanges()

    // Verify changes persisted
    const updatedCell0 = await cell0.innerText()
    expect(updatedCell0).toContain(newName0)

    const updatedCell1 = await cell1.innerText()
    expect(updatedCell1).toContain(newName1)
  })
})

// ---------------------------------------------------------------------------
// SQLite – Multiple Cell Edits
// ---------------------------------------------------------------------------
test.describe.serial('SQLite – Multiple Cell Edits', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit two cells in different rows and apply at once', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('products')

    const cell0 = window.getByTestId('grid-cell-0-name')
    await expect(cell0).toBeVisible({ timeout: 10_000 })

    const cell1 = window.getByTestId('grid-cell-1-name')
    await expect(cell1).toBeVisible({ timeout: 10_000 })

    const newName0 = `E2E SL Batch0 ${Date.now()}`
    const newName1 = `E2E SL Batch1 ${Date.now()}`

    await actions.editCell(0, 'name', newName0)
    await actions.editCell(1, 'name', newName1)

    // Apply button should be visible with pending changes
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    await actions.applyChanges()

    // Verify changes persisted
    const updatedCell0 = await cell0.innerText()
    expect(updatedCell0).toContain(newName0)

    const updatedCell1 = await cell1.innerText()
    expect(updatedCell1).toContain(newName1)
  })
})

// ---------------------------------------------------------------------------
// SQL Server – Multiple Cell Edits
// ---------------------------------------------------------------------------
test.describe.serial('SQL Server – Multiple Cell Edits', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit two cells in different rows and apply at once', async () => {
    const actions = await connectTo(window, 'sqlserver')

    await actions.openTable('products')

    const cell0 = window.getByTestId('grid-cell-0-name')
    await expect(cell0).toBeVisible({ timeout: 10_000 })

    const cell1 = window.getByTestId('grid-cell-1-name')
    await expect(cell1).toBeVisible({ timeout: 10_000 })

    const newName0 = `E2E SS Batch0 ${Date.now()}`
    const newName1 = `E2E SS Batch1 ${Date.now()}`

    await actions.editCell(0, 'name', newName0)
    await actions.editCell(1, 'name', newName1)

    // Apply button should be visible with pending changes
    const applyBtn = window.getByTestId('apply-data-changes-btn')
    await expect(applyBtn).toBeVisible({ timeout: 5_000 })

    await actions.applyChanges()

    // After apply, verify the grid contains both new values.
    // SQL Server row order may change after apply, so check the grid broadly.
    await window.waitForTimeout(1000)
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toContainText(newName0, { timeout: 10_000 })
    await expect(grid).toContainText(newName1, { timeout: 10_000 })
  })
})
