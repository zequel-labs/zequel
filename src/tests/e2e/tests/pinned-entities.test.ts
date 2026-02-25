import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// PostgreSQL Pinned Entities
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Pinned Entities', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('pin a table from sidebar context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    // Right-click table → Pin to Top
    await actions.pinTableByContextMenu('customers')

    // Verify pinned section appears with the entity
    await expect(window.getByTestId('pinned-section')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('pinned-entity-customers')).toBeVisible({ timeout: 10_000 })
  })

  test('unpin a table from pinned section context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    // Pin first
    await actions.pinTableByContextMenu('customers')
    await expect(window.getByTestId('pinned-entity-customers')).toBeVisible({ timeout: 10_000 })

    // Unpin via context menu on pinned entity
    await actions.unpinEntityByContextMenu('customers')

    // Pinned section should disappear (no more pinned items)
    await expect(window.getByTestId('pinned-section')).not.toBeVisible({ timeout: 10_000 })
  })

  test('pin multiple tables', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.pinTableByContextMenu('customers')
    await actions.pinTableByContextMenu('products')

    await expect(window.getByTestId('pinned-entity-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('pinned-entity-products')).toBeVisible({ timeout: 10_000 })
  })

  test('click pinned entity opens data grid', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.pinTableByContextMenu('customers')

    // Click the pinned entity
    await window.getByTestId('pinned-entity-customers').click()

    // Data grid should open
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// MySQL Pinned Entities
// ---------------------------------------------------------------------------
test.describe('MySQL Pinned Entities', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('pin and unpin a table', async () => {
    const actions = await connectTo(window, 'mysql')

    // Pin
    await actions.pinTableByContextMenu('customers')
    await expect(window.getByTestId('pinned-entity-customers')).toBeVisible({ timeout: 10_000 })

    // Unpin
    await actions.unpinEntityByContextMenu('customers')
    await expect(window.getByTestId('pinned-section')).not.toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// SQLite Pinned Entities
// ---------------------------------------------------------------------------
test.describe('SQLite Pinned Entities', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('pin and unpin a table', async () => {
    const actions = await connectTo(window, 'sqlite')

    // Pin
    await actions.pinTableByContextMenu('customers')
    await expect(window.getByTestId('pinned-entity-customers')).toBeVisible({ timeout: 10_000 })

    // Unpin
    await actions.unpinEntityByContextMenu('customers')
    await expect(window.getByTestId('pinned-section')).not.toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Pinned Entities
// ---------------------------------------------------------------------------
test.describe('ClickHouse Pinned Entities', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('pin and unpin a table', async () => {
    const actions = await connectTo(window, 'clickhouse')

    // Pin
    await actions.pinTableByContextMenu('events')
    await expect(window.getByTestId('pinned-entity-events')).toBeVisible({ timeout: 10_000 })

    // Unpin
    await actions.unpinEntityByContextMenu('events')
    await expect(window.getByTestId('pinned-section')).not.toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// MongoDB Pinned Entities
// ---------------------------------------------------------------------------
test.describe('MongoDB Pinned Entities', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('pin and unpin a collection', async () => {
    const actions = await connectTo(window, 'mongodb')

    // Pin
    await actions.pinCollectionByContextMenu('customers')
    await expect(window.getByTestId('pinned-entity-customers')).toBeVisible({ timeout: 10_000 })

    // Unpin
    await actions.unpinEntityByContextMenu('customers')
    await expect(window.getByTestId('pinned-section')).not.toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// SQL Server Pinned Entities
// ---------------------------------------------------------------------------
test.describe('SQL Server Pinned Entities', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('pin and unpin a table', async () => {
    const actions = await connectTo(window, 'sqlserver')

    // Pin
    await actions.pinTableByContextMenu('customers')
    await expect(window.getByTestId('pinned-entity-customers')).toBeVisible({ timeout: 10_000 })

    // Unpin
    await actions.unpinEntityByContextMenu('customers')
    await expect(window.getByTestId('pinned-section')).not.toBeVisible({ timeout: 10_000 })
  })
})
