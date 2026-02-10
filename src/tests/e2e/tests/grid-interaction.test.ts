import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'
import type { UserActions } from '../page-actions'

// ---------------------------------------------------------------------------
// Grid Sorting - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Grid Sorting - PostgreSQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
    await actions.openTable('products')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('sort by name column', async () => {
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

  test('sort by price column', async () => {
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    await window.locator('th').filter({ hasText: 'price' }).click()
    await window.waitForTimeout(500)

    const firstCellAfter = window.getByTestId('grid-cell-0-price')
    await expect(firstCellAfter).toBeVisible({ timeout: 10_000 })
    const valueAfter = (await firstCellAfter.innerText()).trim()
    expect(valueAfter.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Grid Sorting - MySQL
// ---------------------------------------------------------------------------
test.describe('Grid Sorting - MySQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mysql')
    await actions.openTable('products')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('sort by name column', async () => {
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
// Grid Sorting - MariaDB
// ---------------------------------------------------------------------------
test.describe('Grid Sorting - MariaDB', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mariadb')
    await actions.openTable('products')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('sort by name column', async () => {
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
// Grid Sorting - SQLite
// ---------------------------------------------------------------------------
test.describe('Grid Sorting - SQLite', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'sqlite')
    await actions.openTable('products')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('sort by name column', async () => {
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
// Structure View - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Structure View - PostgreSQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
    await actions.openTable('customers')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('shows column definitions', async () => {
    await expect(window.locator('[data-col-name-input][value="id"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-col-name-input][value="name"]').first()).toBeVisible({ timeout: 5_000 })
    await expect(window.locator('[data-col-name-input][value="email"]').first()).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Structure View - MySQL
// ---------------------------------------------------------------------------
test.describe('Structure View - MySQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mysql')
    await actions.openTable('products')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('shows column definitions', async () => {
    await expect(window.locator('[data-col-name-input][value="id"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-col-name-input][value="name"]').first()).toBeVisible({ timeout: 5_000 })
    await expect(window.locator('[data-col-name-input][value="price"]').first()).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Structure View - MariaDB
// ---------------------------------------------------------------------------
test.describe('Structure View - MariaDB', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mariadb')
    await actions.openTable('products')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('shows column definitions', async () => {
    await expect(window.locator('[data-col-name-input][value="id"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-col-name-input][value="name"]').first()).toBeVisible({ timeout: 5_000 })
    await expect(window.locator('[data-col-name-input][value="price"]').first()).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Structure View - SQLite
// ---------------------------------------------------------------------------
test.describe('Structure View - SQLite', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'sqlite')
    await actions.openTable('orders')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('shows column definitions', async () => {
    await expect(window.locator('[data-col-name-input][value="id"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-col-name-input][value="status"]').first()).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Structure View - ClickHouse
// ---------------------------------------------------------------------------
test.describe('Structure View - ClickHouse', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'clickhouse')
    await actions.openTable('events')
    await actions.switchToStructureTab()
    await window.waitForTimeout(2000)
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('shows column definitions', async () => {
    await expect(window.locator('[data-col-name-input][value="event_type"]').first()).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// View Data
// ---------------------------------------------------------------------------
test.describe('View Data', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('switch between data and structure tabs', async () => {
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
    await actions.openTable('customers')

    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })

    const cellText = (await cell.innerText()).trim()
    expect(cellText.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Grid Context Menu - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Grid Context Menu - PostgreSQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
    await actions.openTable('customers')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('right-click cell shows context menu', async () => {
    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const copyCellOption = window.getByText('Copy Cell Value')
    await expect(copyCellOption).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Grid Context Menu - MySQL
// ---------------------------------------------------------------------------
test.describe('Grid Context Menu - MySQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mysql')
    await actions.openTable('customers')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('right-click cell shows context menu', async () => {
    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const copyCellOption = window.getByText('Copy Cell Value')
    await expect(copyCellOption).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Grid Context Menu - SQLite
// ---------------------------------------------------------------------------
test.describe('Grid Context Menu - SQLite', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'sqlite')
    await actions.openTable('customers')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('right-click cell shows context menu', async () => {
    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    const copyCellOption = window.getByText('Copy Cell Value')
    await expect(copyCellOption).toBeVisible({ timeout: 5_000 })
  })
})
