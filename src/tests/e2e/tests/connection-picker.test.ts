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
// Connection Picker Dialog - PostgreSQL
// ---------------------------------------------------------------------------
test.describe('Connection Picker Dialog - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('opens connection picker with title and search input', async () => {
    await connectTo(window, 'postgres')

    // Click the connection picker button in the header
    const pickerBtn = window.getByTestId('header-connection-picker-btn')
    await expect(pickerBtn).toBeVisible({ timeout: 5_000 })
    await pickerBtn.click()

    // Dialog should appear with correct title
    const dialog = window.getByTestId('connection-picker-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('connection-picker-title')).toBeVisible()
    await expect(window.getByTestId('connection-picker-title')).toContainText('Open Connection')

    // Search input should be visible
    const searchInput = window.getByTestId('connection-picker-search')
    await expect(searchInput).toBeVisible()

    // At least one connection item should be visible
    const connectionItems = dialog.locator('[data-testid^="connection-picker-item-"]')
    await expect(connectionItems.first()).toBeVisible({ timeout: 5_000 })
    const count = await connectionItems.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // Close dialog with Escape
    await window.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Connection Picker Search
// ---------------------------------------------------------------------------
test.describe('Connection Picker Search', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('filters connections by search text and clears to show all', async () => {
    await connectTo(window, 'postgres')

    // Open the connection picker
    const pickerBtn = window.getByTestId('header-connection-picker-btn')
    await pickerBtn.click()

    const dialog = window.getByTestId('connection-picker-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Count initial connections
    const connectionItems = dialog.locator('[data-testid^="connection-picker-item-"]')
    await expect(connectionItems.first()).toBeVisible({ timeout: 5_000 })
    const initialCount = await connectionItems.count()

    // Type search text to filter connections
    const searchInput = window.getByTestId('connection-picker-search')
    await searchInput.fill('postgres')
    await window.waitForTimeout(500)

    // Filtered results should still contain at least one item (PostgreSQL)
    const filteredItems = dialog.locator('[data-testid^="connection-picker-item-"]')
    await expect(filteredItems.first()).toBeVisible({ timeout: 5_000 })

    // Clear search input to show all connections again
    await searchInput.clear()
    await window.waitForTimeout(500)

    // All connections should be visible again
    const restoredItems = dialog.locator('[data-testid^="connection-picker-item-"]')
    await expect(restoredItems.first()).toBeVisible({ timeout: 5_000 })
    const restoredCount = await restoredItems.count()
    expect(restoredCount).toBe(initialCount)

    // Close dialog
    await window.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// New Connection While Connected
// ---------------------------------------------------------------------------
test.describe('New Connection While Connected', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Cmd+N opens new connection dialog with database type selector', async () => {
    await connectTo(window, 'postgres')

    // Press Cmd+N to open new connection dialog
    await window.keyboard.press('Meta+n')

    // New connection dialog should appear
    const dialog = window.getByTestId('new-connection-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Database type selector should be visible inside the dialog
    const databaseTypeTrigger = window.getByTestId('database-type-trigger')
    await expect(databaseTypeTrigger).toBeVisible({ timeout: 5_000 })

    // Close dialog with Escape
    await window.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Disconnect and Return Home
// ---------------------------------------------------------------------------
test.describe('Disconnect and Return Home', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('disconnects and returns to connection form', async () => {
    await connectTo(window, 'postgres')

    // Verify sidebar is visible (connected state)
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Click disconnect button
    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()

    // Sidebar should no longer be visible
    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    // Connection form should be visible for reconnecting (home screen)
    const connectButton = window.getByTestId('connection-connect-btn')
    await expect(connectButton).toBeVisible({ timeout: 10_000 })

    // Database type selector should also be visible on the home screen
    const databaseTypeTrigger = window.getByTestId('database-type-trigger')
    await expect(databaseTypeTrigger).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Test Connection Feature
// ---------------------------------------------------------------------------
test.describe('Test Connection Feature', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('tests PostgreSQL connection and shows success indicator', async () => {
    const { userActions } = await import('@e2e/page-actions')
    const { postgresConfig } = await import('@e2e/config/postgres')
    const actions = userActions(window)

    // Select PostgreSQL database type
    await actions.selectDatabaseType(postgresConfig.type)

    // Fill in connection details
    await actions.fillConnectionDetails(postgresConfig as Parameters<typeof actions.fillConnectionDetails>[0])

    // Click test connection button and verify success
    await actions.testConnection()

    // Test success indicator should be visible
    const testSuccess = window.getByTestId('connection-test-success')
    await expect(testSuccess).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Connect to Different Databases Sequentially
// ---------------------------------------------------------------------------
test.describe('Connect to Different Databases Sequentially', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('connects to PostgreSQL, MySQL, then SQLite sequentially', async () => {
    // Connect to PostgreSQL
    await connectTo(window, 'postgres')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Disconnect from PostgreSQL
    const disconnectBtn = window.getByTestId('header-disconnect-btn')
    await disconnectBtn.click()
    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)

    // Connect to MySQL
    await connectTo(window, 'mysql')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Disconnect from MySQL
    await disconnectBtn.click()
    await expect(window.getByTestId('sidebar-tab-items')).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)

    // Connect to SQLite
    await connectTo(window, 'sqlite')
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Verify SQLite is connected — sidebar should show tables
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })
})
