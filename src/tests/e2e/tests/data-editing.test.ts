import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// PostgreSQL CRUD
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL CRUD', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit cell and apply', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const cityCell = window.getByTestId('grid-cell-0-city')
    await expect(cityCell).toBeVisible({ timeout: 10_000 })

    const currentCity = (await cityCell.innerText()).trim()
    const newCity = currentCity === 'E2E PG City A' ? 'E2E PG City B' : 'E2E PG City A'

    await actions.editCell(0, 'city', newCity)
    await actions.applyChanges()

    // After apply, the grid refreshes and row order may change (PostgreSQL heap order).
    // Verify the new value exists somewhere in the grid.
    await window.waitForTimeout(1000)
    const grid = window.getByTestId('data-grid-table')
    await expect(grid.locator(`text=${newCity}`).first()).toBeVisible({ timeout: 10_000 })
  })

  test('add row and apply', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    // Count rows before adding
    const rowsBefore = await actions.getRowCount()

    await actions.addRow()

    const uniqueName = `E2E PG Product ${Date.now()}`

    // The new row is appended at the end — find its index
    const rowsAfterAdd = await actions.getRowCount()
    const newRowIndex = rowsAfterAdd - 1

    await actions.editCell(newRowIndex, 'name', uniqueName)
    await actions.editCell(newRowIndex, 'category', 'E2E Category')
    await actions.editCell(newRowIndex, 'price', '19.99')
    await actions.editCell(newRowIndex, 'stock', '100')

    await actions.applyChanges()

    // Verify the new row is present
    const nameCell = window.getByTestId(`grid-cell-${newRowIndex}-name`)
    const nameText = await nameCell.innerText()
    expect(nameText).toContain(uniqueName)
  })

  test('delete row and apply', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()
    expect(rowsBefore).toBeGreaterThan(0)

    const lastRowIndex = rowsBefore - 1
    await actions.deleteRow(lastRowIndex, 'name')

    await actions.applyChanges()

    // Verify row count decreased
    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBeLessThan(rowsBefore)
  })

  test('discard pending changes', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const cityCell = window.getByTestId('grid-cell-0-city')
    await expect(cityCell).toBeVisible({ timeout: 10_000 })

    const originalCity = (await cityCell.innerText()).trim()
    const tempCity = `TempDiscard${Date.now()}`

    await actions.editCell(0, 'city', tempCity)

    // Discard changes instead of applying
    await actions.discardChanges()

    // Cell should revert to original value
    const revertedText = (await cityCell.innerText()).trim()
    expect(revertedText).toBe(originalCity)
  })
})

// ---------------------------------------------------------------------------
// MySQL CRUD
// ---------------------------------------------------------------------------
test.describe.serial('MySQL CRUD', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit cell and apply', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    const cityCell = window.getByTestId('grid-cell-0-city')
    await expect(cityCell).toBeVisible({ timeout: 10_000 })

    const currentCity = (await cityCell.innerText()).trim()
    const newCity = currentCity === 'E2E MY City A' ? 'E2E MY City B' : 'E2E MY City A'

    await actions.editCell(0, 'city', newCity)
    await actions.applyChanges()

    const updatedText = await cityCell.innerText()
    expect(updatedText).toContain(newCity)
  })

  test('add row and apply', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('products')

    await actions.addRow()

    const uniqueName = `E2E MY Product ${Date.now()}`

    const rowsAfterAdd = await actions.getRowCount()
    const newRowIndex = rowsAfterAdd - 1

    await actions.editCell(newRowIndex, 'name', uniqueName)
    await actions.editCell(newRowIndex, 'category', 'E2E Category')
    await actions.editCell(newRowIndex, 'price', '24.99')
    await actions.editCell(newRowIndex, 'stock', '50')

    await actions.applyChanges()

    const nameCell = window.getByTestId(`grid-cell-${newRowIndex}-name`)
    const nameText = await nameCell.innerText()
    expect(nameText).toContain(uniqueName)
  })

  test('delete row and apply', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()
    expect(rowsBefore).toBeGreaterThan(0)

    const lastRowIndex = rowsBefore - 1
    await actions.deleteRow(lastRowIndex, 'name')

    await actions.applyChanges()

    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBeLessThan(rowsBefore)
  })
})

// ---------------------------------------------------------------------------
// MariaDB CRUD
// ---------------------------------------------------------------------------
test.describe.serial('MariaDB CRUD', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit cell and apply', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openTable('customers')

    const cityCell = window.getByTestId('grid-cell-0-city')
    await expect(cityCell).toBeVisible({ timeout: 10_000 })

    const currentCity = (await cityCell.innerText()).trim()
    const newCity = currentCity === 'E2E MA City A' ? 'E2E MA City B' : 'E2E MA City A'

    await actions.editCell(0, 'city', newCity)
    await actions.applyChanges()

    const updatedText = await cityCell.innerText()
    expect(updatedText).toContain(newCity)
  })

  test('add row and apply', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openTable('products')

    await actions.addRow()

    const uniqueName = `E2E MA Product ${Date.now()}`

    const rowsAfterAdd = await actions.getRowCount()
    const newRowIndex = rowsAfterAdd - 1

    await actions.editCell(newRowIndex, 'name', uniqueName)
    await actions.editCell(newRowIndex, 'category', 'E2E Category')
    await actions.editCell(newRowIndex, 'price', '14.99')
    await actions.editCell(newRowIndex, 'stock', '75')

    await actions.applyChanges()

    const nameCell = window.getByTestId(`grid-cell-${newRowIndex}-name`)
    const nameText = await nameCell.innerText()
    expect(nameText).toContain(uniqueName)
  })

  test('delete row and apply', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()
    expect(rowsBefore).toBeGreaterThan(0)

    const lastRowIndex = rowsBefore - 1
    await actions.deleteRow(lastRowIndex, 'name')

    await actions.applyChanges()

    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBeLessThan(rowsBefore)
  })
})

// ---------------------------------------------------------------------------
// SQLite CRUD
// ---------------------------------------------------------------------------
test.describe.serial('SQLite CRUD', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit cell and apply', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('customers')

    const cityCell = window.getByTestId('grid-cell-0-city')
    await expect(cityCell).toBeVisible({ timeout: 10_000 })

    const currentCity = (await cityCell.innerText()).trim()
    const newCity = currentCity === 'E2E SL City A' ? 'E2E SL City B' : 'E2E SL City A'

    await actions.editCell(0, 'city', newCity)
    await actions.applyChanges()

    const updatedText = await cityCell.innerText()
    expect(updatedText).toContain(newCity)
  })

  test('add row and apply', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('products')

    await actions.addRow()

    const uniqueName = `E2E SL Product ${Date.now()}`

    const rowsAfterAdd = await actions.getRowCount()
    const newRowIndex = rowsAfterAdd - 1

    await actions.editCell(newRowIndex, 'name', uniqueName)
    await actions.editCell(newRowIndex, 'category', 'E2E Category')
    await actions.editCell(newRowIndex, 'price', '9.99')
    await actions.editCell(newRowIndex, 'stock', '200')

    await actions.applyChanges()

    const nameCell = window.getByTestId(`grid-cell-${newRowIndex}-name`)
    const nameText = await nameCell.innerText()
    expect(nameText).toContain(uniqueName)
  })

  test('delete row and apply', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('products')

    const rowsBefore = await actions.getRowCount()
    expect(rowsBefore).toBeGreaterThan(0)

    const lastRowIndex = rowsBefore - 1
    await actions.deleteRow(lastRowIndex, 'name')

    await actions.applyChanges()

    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBeLessThan(rowsBefore)
  })
})

// ---------------------------------------------------------------------------
// DuckDB CRUD
// ---------------------------------------------------------------------------
test.describe.serial('DuckDB CRUD', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit cell and apply', async () => {
    const actions = await connectTo(window, 'duckdb')

    // Use order_items table — it's a leaf table with no incoming FKs,
    // so DuckDB won't reject UPDATEs due to FK constraint limitations.
    await actions.openTable('order_items')

    const qtyCell = window.getByTestId('grid-cell-0-quantity')
    await expect(qtyCell).toBeVisible({ timeout: 10_000 })

    const currentQty = (await qtyCell.innerText()).trim()
    const newQty = currentQty === '99' ? '98' : '99'

    await actions.editCell(0, 'quantity', newQty)
    await actions.applyChanges()

    const updatedText = await qtyCell.innerText()
    expect(updatedText).toContain(newQty)
  })

  test('add row and apply', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openTable('order_items')

    await actions.addRow()

    const rowsAfterAdd = await actions.getRowCount()
    const newRowIndex = rowsAfterAdd - 1

    // DuckDB order_items has no auto-increment — provide an explicit id
    await actions.editCell(newRowIndex, 'id', '999')
    await actions.editCell(newRowIndex, 'order_id', '1')
    await actions.editCell(newRowIndex, 'product_id', '1')
    await actions.editCell(newRowIndex, 'quantity', '5')
    await actions.editCell(newRowIndex, 'unit_price', '9.99')

    await actions.applyChanges()

    const qtyCell = window.getByTestId(`grid-cell-${newRowIndex}-quantity`)
    const qtyText = await qtyCell.innerText()
    expect(qtyText).toContain('5')
  })

  test('delete row and apply', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openTable('order_items')

    const rowsBefore = await actions.getRowCount()
    expect(rowsBefore).toBeGreaterThan(0)

    const lastRowIndex = rowsBefore - 1
    await actions.deleteRow(lastRowIndex, 'quantity')

    await actions.applyChanges()

    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBeLessThan(rowsBefore)
  })
})

// ---------------------------------------------------------------------------
// MongoDB CRUD
// ---------------------------------------------------------------------------
test.describe.serial('MongoDB CRUD', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit cell and apply', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollection('customers')

    const cityCell = window.getByTestId('grid-cell-0-city')
    await expect(cityCell).toBeVisible({ timeout: 10_000 })

    const currentCity = (await cityCell.innerText()).trim()
    const newCity = currentCity === 'E2E MO City A' ? 'E2E MO City B' : 'E2E MO City A'

    await actions.editCell(0, 'city', newCity)
    await actions.applyChanges()

    const updatedText = await cityCell.innerText()
    expect(updatedText).toContain(newCity)
  })

  test('add row and apply', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollection('customers')

    await actions.addRow()

    const rowsAfterAdd = await actions.getRowCount()
    const newRowIndex = rowsAfterAdd - 1

    const uniqueName = `E2E MO Customer ${Date.now()}`

    await actions.editCell(newRowIndex, 'name', uniqueName)
    await actions.editCell(newRowIndex, 'email', `e2e-mongo-${Date.now()}@test.com`)
    await actions.editCell(newRowIndex, 'phone', '+1-555-0199')
    await actions.editCell(newRowIndex, 'city', 'E2E Mongo City')
    await actions.editCell(newRowIndex, 'country', 'E2E Country')

    await actions.applyChanges()

    const nameCell = window.getByTestId(`grid-cell-${newRowIndex}-name`)
    const nameText = await nameCell.innerText()
    expect(nameText).toContain(uniqueName)
  })

  test('delete row and apply', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollection('customers')

    const rowsBefore = await actions.getRowCount()
    expect(rowsBefore).toBeGreaterThan(0)

    const lastRowIndex = rowsBefore - 1
    await actions.deleteRow(lastRowIndex, 'name')

    await actions.applyChanges()

    const rowsAfter = await actions.getRowCount()
    expect(rowsAfter).toBeLessThan(rowsBefore)
  })
})
