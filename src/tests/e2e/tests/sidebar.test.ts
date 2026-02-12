import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// PostgreSQL Sidebar
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Sidebar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('tables visible in sidebar', async () => {
    await connectTo(window, 'postgres')

    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-order_items')).toBeVisible({ timeout: 10_000 })
  })

  test('open table from sidebar', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })

  test('switch sidebar tabs', async () => {
    const actions = await connectTo(window, 'postgres')

    // Switch to queries tab
    await actions.switchSidebarTab('queries')
    await expect(window.getByTestId('sidebar-tab-queries')).toBeVisible({ timeout: 10_000 })

    // Switch to history tab
    await actions.switchSidebarTab('history')
    await expect(window.getByTestId('sidebar-tab-history')).toBeVisible({ timeout: 10_000 })

    // Switch back to items tab
    await actions.switchSidebarTab('items')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// MySQL Sidebar
// ---------------------------------------------------------------------------
test.describe('MySQL Sidebar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('tables visible in sidebar', async () => {
    await connectTo(window, 'mysql')

    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-order_items')).toBeVisible({ timeout: 10_000 })
  })

  test('open table from sidebar', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTableByTestId('products')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// MariaDB Sidebar
// ---------------------------------------------------------------------------
test.describe('MariaDB Sidebar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('tables visible and open table', async () => {
    const actions = await connectTo(window, 'mariadb')

    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-order_items')).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('customers')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// SQLite Sidebar
// ---------------------------------------------------------------------------
test.describe('SQLite Sidebar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('tables visible in sidebar', async () => {
    await connectTo(window, 'sqlite')

    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-order_items')).toBeVisible({ timeout: 10_000 })
  })

  test('open table from sidebar', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTableByTestId('orders')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// DuckDB Sidebar
// ---------------------------------------------------------------------------
test.describe('DuckDB Sidebar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('tables visible in sidebar', async () => {
    await connectTo(window, 'duckdb')

    await expect(window.getByTestId('sidebar-table-users')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-order_items')).toBeVisible({ timeout: 10_000 })
  })

  test('open table from sidebar', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openTableByTestId('products')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Sidebar
// ---------------------------------------------------------------------------
test.describe('ClickHouse Sidebar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('tables visible in sidebar', async () => {
    await connectTo(window, 'clickhouse')

    await expect(window.getByTestId('sidebar-table-events')).toBeVisible({ timeout: 10_000 })
  })

  test('open table from sidebar', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openTableByTestId('events')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// MongoDB Sidebar
// ---------------------------------------------------------------------------
test.describe('MongoDB Sidebar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('collections visible in sidebar', async () => {
    await connectTo(window, 'mongodb')

    await expect(window.getByTestId('sidebar-collection-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-collection-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-collection-orders')).toBeVisible({ timeout: 10_000 })
  })

  test('open collection from sidebar', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollectionByTestId('customers')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Redis Sidebar
// ---------------------------------------------------------------------------
test.describe('Redis Sidebar', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('keys visible in sidebar', async () => {
    await connectTo(window, 'redis')

    // Redis keys use the sidebar-redis-key-{name} test ID pattern
    // Verify at least one key is visible in the sidebar
    const redisKeys = window.locator('[data-testid^="sidebar-redis-key-"]')
    await expect(redisKeys.first()).toBeVisible({ timeout: 10_000 })
  })

  test('open key from sidebar', async () => {
    const actions = await connectTo(window, 'redis')

    // Wait for keys to load, then click the first available key
    const redisKeys = window.locator('[data-testid^="sidebar-redis-key-"]')
    await expect(redisKeys.first()).toBeVisible({ timeout: 10_000 })
    await redisKeys.first().click()

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})
