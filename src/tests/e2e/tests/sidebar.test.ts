import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'
import type { UserActions } from '../page-actions'

// ---------------------------------------------------------------------------
// PostgreSQL Sidebar
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Sidebar', () => {
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

  test('tables visible in sidebar', async () => {
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-order_items')).toBeVisible({ timeout: 10_000 })
  })

  test('open table from sidebar', async () => {
    await actions.openTableByTestId('customers')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })

  test('switch sidebar tabs', async () => {
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
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mysql')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('tables visible in sidebar', async () => {
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-order_items')).toBeVisible({ timeout: 10_000 })
  })

  test('open table from sidebar', async () => {
    await actions.openTableByTestId('products')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// MariaDB Sidebar
// ---------------------------------------------------------------------------
test.describe('MariaDB Sidebar', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mariadb')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('tables visible and open table', async () => {
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
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'sqlite')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('tables visible in sidebar', async () => {
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-orders')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-table-order_items')).toBeVisible({ timeout: 10_000 })
  })

  test('open table from sidebar', async () => {
    await actions.openTableByTestId('orders')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Sidebar
// ---------------------------------------------------------------------------
test.describe('ClickHouse Sidebar', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'clickhouse')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('tables visible in sidebar', async () => {
    await expect(window.getByTestId('sidebar-table-events')).toBeVisible({ timeout: 10_000 })
  })

  test('open table from sidebar', async () => {
    await actions.openTableByTestId('events')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// MongoDB Sidebar
// ---------------------------------------------------------------------------
test.describe('MongoDB Sidebar', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mongodb')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('collections visible in sidebar', async () => {
    await expect(window.getByTestId('sidebar-collection-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-collection-products')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('sidebar-collection-orders')).toBeVisible({ timeout: 10_000 })
  })

  test('open collection from sidebar', async () => {
    await actions.openCollectionByTestId('customers')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Redis Sidebar
// ---------------------------------------------------------------------------
test.describe('Redis Sidebar', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'redis')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('keys visible in sidebar', async () => {
    // Redis keys use the sidebar-redis-key-{name} test ID pattern
    // Verify at least one key is visible in the sidebar
    const redisKeys = window.locator('[data-testid^="sidebar-redis-key-"]')
    await expect(redisKeys.first()).toBeVisible({ timeout: 10_000 })
  })

  test('open key from sidebar', async () => {
    // Wait for keys to load, then click the first available key
    const redisKeys = window.locator('[data-testid^="sidebar-redis-key-"]')
    await expect(redisKeys.first()).toBeVisible({ timeout: 10_000 })
    await redisKeys.first().click()

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })
})
