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

const openDatabaseManager = async (page: Page): Promise<void> => {
  const dbManagerBtn = page.getByTestId('header-dbmanager-btn')
  await expect(dbManagerBtn).toBeVisible({ timeout: 5_000 })
  await dbManagerBtn.click()
  await expect(page.getByTestId('dbmanager-dialog')).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Database Manager Dialog - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Database Manager Dialog - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('dialog opens with correct title', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const title = window.getByTestId('dbmanager-title')
    await expect(title).toBeVisible()
    await expect(title).toHaveText('Databases')

    await assertNoErrorToast(window)
  })

  test('dialog lists existing databases including the connected one', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const dialog = window.getByTestId('dbmanager-dialog')
    await expect(dialog).toBeVisible()

    // The connected database "zequel" should appear in the list
    const currentDb = window.getByTestId('dbmanager-db-zequel')
    await expect(currentDb).toBeVisible({ timeout: 10_000 })

    // There should be at least one database item listed
    const dbItems = dialog.locator('[data-testid^="dbmanager-db-"]')
    const count = await dbItems.count()
    expect(count).toBeGreaterThanOrEqual(1)

    await assertNoErrorToast(window)
  })

  test('create button is visible', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('dialog closes on Escape key', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const dialog = window.getByTestId('dbmanager-dialog')
    await expect(dialog).toBeVisible()

    // Press Escape to close the dialog
    await window.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('current database shows check icon styling', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    // The connected database should have the primary highlight class
    const currentDb = window.getByTestId('dbmanager-db-zequel')
    await expect(currentDb).toBeVisible({ timeout: 10_000 })
    await expect(currentDb).toHaveClass(/bg-primary/)

    await assertNoErrorToast(window)
  })

  test('search input filters the database list', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const dialog = window.getByTestId('dbmanager-dialog')

    // Get the initial count of databases
    const dbItems = dialog.locator('[data-testid^="dbmanager-db-"]')
    const initialCount = await dbItems.count()
    expect(initialCount).toBeGreaterThanOrEqual(1)

    // Type a search query that should match the connected database
    const searchInput = dialog.getByPlaceholder('Search databases...')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('zequel')

    // The connected database should still be visible
    await expect(window.getByTestId('dbmanager-db-zequel')).toBeVisible()

    // Type a search query that matches nothing
    await searchInput.fill('nonexistent_database_xyz')
    await window.waitForTimeout(500)

    // No database items should match
    const filteredCount = await dbItems.count()
    expect(filteredCount).toBe(0)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Database Manager Dialog - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Database Manager Dialog - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('dialog opens and shows databases', async () => {
    await connectTo(window, 'mysql')

    await openDatabaseManager(window)

    const dialog = window.getByTestId('dbmanager-dialog')
    await expect(dialog).toBeVisible()

    const title = window.getByTestId('dbmanager-title')
    await expect(title).toHaveText('Databases')

    // There should be at least one database listed
    const dbItems = dialog.locator('[data-testid^="dbmanager-db-"]')
    const count = await dbItems.count()
    expect(count).toBeGreaterThanOrEqual(1)

    await assertNoErrorToast(window)
  })

  test('current database is visible and highlighted in the list', async () => {
    await connectTo(window, 'mysql')

    await openDatabaseManager(window)

    // The connected database "zequel" should appear with primary styling
    const currentDb = window.getByTestId('dbmanager-db-zequel')
    await expect(currentDb).toBeVisible({ timeout: 10_000 })
    await expect(currentDb).toHaveClass(/bg-primary/)

    await assertNoErrorToast(window)
  })

  test('create button is visible for MySQL', async () => {
    await connectTo(window, 'mysql')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('dialog closes on Escape key', async () => {
    await connectTo(window, 'mysql')

    await openDatabaseManager(window)

    const dialog = window.getByTestId('dbmanager-dialog')
    await expect(dialog).toBeVisible()

    await window.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Database Manager Dialog - ClickHouse
// ---------------------------------------------------------------------------
test.describe.serial('Database Manager Dialog - ClickHouse', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('dialog opens and lists databases', async () => {
    await connectTo(window, 'clickhouse')

    await openDatabaseManager(window)

    const dialog = window.getByTestId('dbmanager-dialog')
    await expect(dialog).toBeVisible()

    const title = window.getByTestId('dbmanager-title')
    await expect(title).toHaveText('Databases')

    // ClickHouse should list at least one database
    const dbItems = dialog.locator('[data-testid^="dbmanager-db-"]')
    const count = await dbItems.count()
    expect(count).toBeGreaterThanOrEqual(1)

    await assertNoErrorToast(window)
  })

  test('connected database is highlighted', async () => {
    await connectTo(window, 'clickhouse')

    await openDatabaseManager(window)

    const currentDb = window.getByTestId('dbmanager-db-zequel')
    await expect(currentDb).toBeVisible({ timeout: 10_000 })
    await expect(currentDb).toHaveClass(/bg-primary/)

    await assertNoErrorToast(window)
  })

  test('create button is visible for ClickHouse', async () => {
    await connectTo(window, 'clickhouse')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Database Manager Dialog - SQL Server
// ---------------------------------------------------------------------------
test.describe.serial('Database Manager Dialog - SQL Server', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('dialog opens and lists databases', async () => {
    await connectTo(window, 'sqlserver')

    await openDatabaseManager(window)

    const dialog = window.getByTestId('dbmanager-dialog')
    await expect(dialog).toBeVisible()

    const title = window.getByTestId('dbmanager-title')
    await expect(title).toHaveText('Databases')

    // SQL Server should list at least the connected database
    const dbItems = dialog.locator('[data-testid^="dbmanager-db-"]')
    const count = await dbItems.count()
    expect(count).toBeGreaterThanOrEqual(1)

    await assertNoErrorToast(window)
  })

  test('connected database is highlighted', async () => {
    await connectTo(window, 'sqlserver')

    await openDatabaseManager(window)

    const currentDb = window.getByTestId('dbmanager-db-zequel')
    await expect(currentDb).toBeVisible({ timeout: 10_000 })
    await expect(currentDb).toHaveClass(/bg-primary/)

    await assertNoErrorToast(window)
  })

  test('create button is visible for SQL Server', async () => {
    await connectTo(window, 'sqlserver')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Database Manager - Create Dialog
// ---------------------------------------------------------------------------
test.describe.serial('Database Manager - Create Dialog', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('clicking Create opens the create database dialog with name input', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })
    await createBtn.click()

    // The create database name input should be visible
    const nameInput = window.getByTestId('create-db-name')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })

    // Submit button should also be visible
    const submitBtn = window.getByTestId('create-db-submit')
    await expect(submitBtn).toBeVisible()

    await assertNoErrorToast(window)
  })

  test('submit button is disabled when name is empty', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await createBtn.click()

    const nameInput = window.getByTestId('create-db-name')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })

    // Ensure the input is empty
    await nameInput.fill('')

    // Submit should be disabled when name is empty
    const submitBtn = window.getByTestId('create-db-submit')
    await expect(submitBtn).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('submit button is enabled when a valid name is typed', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await createBtn.click()

    const nameInput = window.getByTestId('create-db-name')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })

    // Type a valid database name
    await nameInput.fill('test_valid_db')

    // Submit should be enabled
    const submitBtn = window.getByTestId('create-db-submit')
    await expect(submitBtn).toBeEnabled()

    await assertNoErrorToast(window)
  })

  test('submit button is disabled when name already exists', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await createBtn.click()

    const nameInput = window.getByTestId('create-db-name')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })

    // Type a name that already exists (the connected database)
    await nameInput.fill('zequel')
    await window.waitForTimeout(500)

    // Submit should be disabled because the name already exists
    const submitBtn = window.getByTestId('create-db-submit')
    await expect(submitBtn).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('create dialog closes on Escape without creating', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await createBtn.click()

    const nameInput = window.getByTestId('create-db-name')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })

    // Type a name but then press Escape
    await nameInput.fill('should_not_be_created')
    await window.keyboard.press('Escape')

    // The create dialog input should no longer be visible
    await expect(nameInput).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('MySQL: create dialog shows name input and submit button', async () => {
    await connectTo(window, 'mysql')

    await openDatabaseManager(window)

    const createBtn = window.getByTestId('dbmanager-create-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })
    await createBtn.click()

    const nameInput = window.getByTestId('create-db-name')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })

    const submitBtn = window.getByTestId('create-db-submit')
    await expect(submitBtn).toBeVisible()

    // Empty name should keep submit disabled
    await nameInput.fill('')
    await expect(submitBtn).toBeDisabled()

    // Valid name should enable submit
    await nameInput.fill('test_mysql_db')
    await expect(submitBtn).toBeEnabled()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Database Manager - Safe Mode
// ---------------------------------------------------------------------------
test.describe.serial('Database Manager - Safe Mode', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('DB manager button is still visible when safe mode is enabled', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode
    await actions.enableSafeMode()

    // The DB manager button should still be visible (safe mode does not hide it)
    const dbManagerBtn = window.getByTestId('header-dbmanager-btn')
    await expect(dbManagerBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('dialog opens normally in safe mode', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.enableSafeMode()

    await openDatabaseManager(window)

    const dialog = window.getByTestId('dbmanager-dialog')
    await expect(dialog).toBeVisible()

    const title = window.getByTestId('dbmanager-title')
    await expect(title).toHaveText('Databases')

    // Databases should still be listed
    const dbItems = dialog.locator('[data-testid^="dbmanager-db-"]')
    const count = await dbItems.count()
    expect(count).toBeGreaterThanOrEqual(1)

    await assertNoErrorToast(window)
  })

  test('create button is still visible in safe mode', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.enableSafeMode()

    await openDatabaseManager(window)

    // The create button should still be visible (safe mode blocks the action, not the button)
    const createBtn = window.getByTestId('dbmanager-create-btn')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('creating a database in safe mode shows info toast', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.enableSafeMode()

    await openDatabaseManager(window)

    // Open create dialog
    const createBtn = window.getByTestId('dbmanager-create-btn')
    await createBtn.click()

    const nameInput = window.getByTestId('create-db-name')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })

    // Type a name and attempt to submit
    await nameInput.fill('safe_mode_test_db')
    const submitBtn = window.getByTestId('create-db-submit')
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // A safe mode info toast should appear
    const infoToast = window.locator('[data-sonner-toast][data-type="info"]')
    await expect(infoToast).toBeVisible({ timeout: 5_000 })
    await expect(infoToast).toContainText('Safe Mode')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Database Manager - Not Available for SQLite/DuckDB
// ---------------------------------------------------------------------------
test.describe.serial('Database Manager - Not Available', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('DB manager button is not visible for SQLite', async () => {
    await connectTo(window, 'sqlite')

    // The DB manager button should not be rendered for SQLite
    const dbManagerBtn = window.getByTestId('header-dbmanager-btn')
    await expect(dbManagerBtn).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })

  test('DB manager button is not visible for DuckDB', async () => {
    await connectTo(window, 'duckdb')

    // The DB manager button should not be rendered for DuckDB
    const dbManagerBtn = window.getByTestId('header-dbmanager-btn')
    await expect(dbManagerBtn).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})
