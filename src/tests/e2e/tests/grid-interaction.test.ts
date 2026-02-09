import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// Grid Sorting
// ---------------------------------------------------------------------------
test.describe('Grid Sorting', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: sort by name column', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstCellBefore = window.getByTestId('grid-cell-0-name')
    await expect(firstCellBefore).toBeVisible({ timeout: 10_000 })

    // Click the "name" column header to trigger sorting
    await window.locator('th').filter({ hasText: 'name' }).click()
    await window.waitForTimeout(500)

    const firstCellAfter = window.getByTestId('grid-cell-0-name')
    await expect(firstCellAfter).toBeVisible({ timeout: 10_000 })
    const valueAfter = (await firstCellAfter.innerText()).trim()
    expect(valueAfter.length).toBeGreaterThan(0)
  })

  test('PostgreSQL: sort by price column', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    await window.locator('th').filter({ hasText: 'price' }).click()
    await window.waitForTimeout(500)

    const firstCellAfter = window.getByTestId('grid-cell-0-price')
    await expect(firstCellAfter).toBeVisible({ timeout: 10_000 })
    const valueAfter = (await firstCellAfter.innerText()).trim()
    expect(valueAfter.length).toBeGreaterThan(0)
  })

  test('MySQL: sort by name column', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('products')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    await window.locator('th').filter({ hasText: 'name' }).click()
    await window.waitForTimeout(500)

    const firstCellAfter = window.getByTestId('grid-cell-0-name')
    await expect(firstCellAfter).toBeVisible({ timeout: 10_000 })
    const valueAfter = (await firstCellAfter.innerText()).trim()
    expect(valueAfter.length).toBeGreaterThan(0)
  })

  test('MariaDB: sort by name column', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openTable('products')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    await window.locator('th').filter({ hasText: 'name' }).click()
    await window.waitForTimeout(500)

    const firstCellAfter = window.getByTestId('grid-cell-0-name')
    await expect(firstCellAfter).toBeVisible({ timeout: 10_000 })
    const valueAfter = (await firstCellAfter.innerText()).trim()
    expect(valueAfter.length).toBeGreaterThan(0)
  })

  test('SQLite: sort by name column', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('products')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    await window.locator('th').filter({ hasText: 'name' }).click()
    await window.waitForTimeout(500)

    const firstCellAfter = window.getByTestId('grid-cell-0-name')
    await expect(firstCellAfter).toBeVisible({ timeout: 10_000 })
    const valueAfter = (await firstCellAfter.innerText()).trim()
    expect(valueAfter.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Structure View
// ---------------------------------------------------------------------------
test.describe('Structure View', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL structure view shows column definitions', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)

    await expect(window.locator('[data-col-name-input][value="id"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-col-name-input][value="name"]').first()).toBeVisible({ timeout: 5_000 })
    await expect(window.locator('[data-col-name-input][value="email"]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('MySQL structure view shows column definitions', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('products')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)

    await expect(window.locator('[data-col-name-input][value="id"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-col-name-input][value="name"]').first()).toBeVisible({ timeout: 5_000 })
    await expect(window.locator('[data-col-name-input][value="price"]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('MariaDB structure view shows column definitions', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openTable('products')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)

    await expect(window.locator('[data-col-name-input][value="id"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-col-name-input][value="name"]').first()).toBeVisible({ timeout: 5_000 })
    await expect(window.locator('[data-col-name-input][value="price"]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('SQLite structure view shows column definitions', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('orders')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)

    await expect(window.locator('[data-col-name-input][value="id"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-col-name-input][value="status"]').first()).toBeVisible({ timeout: 5_000 })
  })

  test('ClickHouse structure view shows column definitions', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openTable('events')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)

    await expect(window.locator('[data-col-name-input][value="event_type"]').first()).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// View Data
// ---------------------------------------------------------------------------
test.describe('View Data', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('switch between data and structure tabs', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    await actions.switchToStructureTab()
    await window.waitForTimeout(1000)

    await expect(window.locator('text=id').first()).toBeVisible({ timeout: 10_000 })

    await actions.switchToDataTab()
    await window.waitForTimeout(1000)

    await expect(grid).toBeVisible({ timeout: 10_000 })
  })

  test('verify cell content is not empty', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })

    const cellText = (await cell.innerText()).trim()
    expect(cellText.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Grid Context Menu
// ---------------------------------------------------------------------------
test.describe('Grid Context Menu', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: right-click cell shows context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const copyCellOption = window.getByText('Copy Cell Value')
    await expect(copyCellOption).toBeVisible({ timeout: 5_000 })
  })

  test('MySQL: right-click cell shows context menu', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const copyCellOption = window.getByText('Copy Cell Value')
    await expect(copyCellOption).toBeVisible({ timeout: 5_000 })
  })

  test('SQLite: right-click cell shows context menu', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('customers')

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const copyCellOption = window.getByText('Copy Cell Value')
    await expect(copyCellOption).toBeVisible({ timeout: 5_000 })
  })
})
