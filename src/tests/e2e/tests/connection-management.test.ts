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

// ---------------------------------------------------------------------------
// Disconnect
// ---------------------------------------------------------------------------
test.describe('Disconnect', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: disconnect returns to home', async () => {
    await connectTo(window, 'postgres')

    // Verify we're connected
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Click disconnect
    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    // Should return to the connection form / home view
    // The sidebar tabs should no longer be visible, and the connection form should appear
    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('MySQL: disconnect returns to home', async () => {
    await connectTo(window, 'mysql')

    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('MariaDB: disconnect returns to home', async () => {
    await connectTo(window, 'mariadb')

    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('SQLite: disconnect returns to home', async () => {
    await connectTo(window, 'sqlite')

    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('ClickHouse: disconnect returns to home', async () => {
    await connectTo(window, 'clickhouse')

    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('MongoDB: disconnect returns to home', async () => {
    await connectTo(window, 'mongodb')

    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('Redis: disconnect returns to home', async () => {
    await connectTo(window, 'redis')

    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('SQL Server: disconnect returns to home', async () => {
    await connectTo(window, 'sqlserver')

    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Test Connection
// ---------------------------------------------------------------------------
test.describe('Test Connection', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: test connection succeeds', async () => {
    const { userActions } = await import('@e2e/page-actions')
    const { postgresConfig } = await import('@e2e/config/postgres')
    const actions = userActions(window)

    await actions.selectDatabaseType(postgresConfig.type)
    await actions.fillConnectionDetails(postgresConfig as Parameters<typeof actions.fillConnectionDetails>[0])
    await actions.testConnection()

    await assertNoErrorToast(window)
  })

  test('MySQL: test connection succeeds', async () => {
    const { userActions } = await import('@e2e/page-actions')
    const { mysqlConfig } = await import('@e2e/config/mysql')
    const actions = userActions(window)

    await actions.selectDatabaseType(mysqlConfig.type)
    await actions.fillConnectionDetails(mysqlConfig as Parameters<typeof actions.fillConnectionDetails>[0])
    await actions.testConnection()

    await assertNoErrorToast(window)
  })

  test('SQLite: test connection succeeds', async () => {
    const { userActions } = await import('@e2e/page-actions')
    const { sqliteConfig } = await import('@e2e/config/sqlite')
    const actions = userActions(window)

    await actions.selectDatabaseType(sqliteConfig.type)
    await actions.fillConnectionDetails(sqliteConfig as Parameters<typeof actions.fillConnectionDetails>[0])
    await actions.testConnection()

    await assertNoErrorToast(window)
  })

  test('SQL Server: test connection succeeds', async () => {
    const { userActions } = await import('@e2e/page-actions')
    const { sqlserverConfig } = await import('@e2e/config/sqlserver')
    const actions = userActions(window)

    await actions.selectDatabaseType(sqlserverConfig.type)
    await actions.fillConnectionDetails(sqlserverConfig as Parameters<typeof actions.fillConnectionDetails>[0])
    await actions.enableTrustServerCertificate()
    await actions.testConnection()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Reconnect after Disconnect
// ---------------------------------------------------------------------------
test.describe('Reconnect after Disconnect', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: disconnect and reconnect', async () => {
    await connectTo(window, 'postgres')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Disconnect
    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()
    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    // Reconnect
    await connectTo(window, 'postgres')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('MySQL: disconnect and reconnect', async () => {
    await connectTo(window, 'mysql')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()
    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await connectTo(window, 'mysql')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('SQL Server: disconnect and reconnect', async () => {
    await connectTo(window, 'sqlserver')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()
    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await connectTo(window, 'sqlserver')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})
