import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'
import { userActions, type UserActions } from '@e2e/page-actions'

const assertNoErrorToast = async (page: Page): Promise<void> => {
  await page.waitForTimeout(500)
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible()
}

/** Open the create table view and click Add Column so a column row appears. */
const openCreateTableAndAddColumn = async (page: Page): Promise<void> => {
  const createBtn = page.getByTestId('sidebar-create-table-btn')
  await expect(createBtn).toBeVisible({ timeout: 5_000 })
  await createBtn.click()

  // Wait for the view to load — table name input is always visible
  const tableNameInput = page.locator('input[placeholder="Enter table name..."]')
  await expect(tableNameInput).toBeVisible({ timeout: 10_000 })

  // Component starts with empty columns — click Add Column to create one
  const addColumnBtn = page.getByTestId('add-column-btn')
  await expect(addColumnBtn).toBeVisible({ timeout: 5_000 })
  await addColumnBtn.click()
  await page.waitForTimeout(300)
}

// ---------------------------------------------------------------------------
// PostgreSQL Create Table (5 tests)
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Create Table', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should open create table view', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'postgres')

    await openCreateTableAndAddColumn(window)

    // Verify col-name-input is visible after adding a column
    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should show column editor with add column', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'postgres')

    await openCreateTableAndAddColumn(window)

    // Verify col-name-input is visible (column editor is shown)
    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    // Verify there is an Add Column button
    const addColumnBtn = window.getByTestId('add-column-btn')
    await expect(addColumnBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('should allow typing a column name', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'postgres')

    await openCreateTableAndAddColumn(window)

    // Wait for the column editor to appear
    const colNameInput = window.getByTestId('col-name-input').first()
    await expect(colNameInput).toBeVisible({ timeout: 10_000 })

    // Type a column name
    await colNameInput.fill('test_column')

    // Verify the value is entered
    await expect(colNameInput).toHaveValue('test_column')

    await assertNoErrorToast(window)
  })

  test('should show Columns, Indexes, Relations tabs', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'postgres')

    const createBtn = window.getByTestId('sidebar-create-table-btn')
    await createBtn.click()

    // Wait for the view to load
    const tableNameInput = window.locator('input[placeholder="Enter table name..."]')
    await expect(tableNameInput).toBeVisible({ timeout: 10_000 })

    // Verify the three tab buttons are visible
    const columnsTab = window.locator('button', { hasText: 'Columns' })
    const indexesTab = window.locator('button', { hasText: 'Indexes' })
    const relationsTab = window.locator('button', { hasText: 'Relations' })

    await expect(columnsTab.first()).toBeVisible({ timeout: 5_000 })
    await expect(indexesTab.first()).toBeVisible({ timeout: 5_000 })
    await expect(relationsTab.first()).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('should have a Cancel button', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'postgres')

    const createBtn = window.getByTestId('sidebar-create-table-btn')
    await createBtn.click()

    // Wait for view to load
    const tableNameInput = window.locator('input[placeholder="Enter table name..."]')
    await expect(tableNameInput).toBeVisible({ timeout: 10_000 })

    // Verify Cancel button is visible at the bottom
    const cancelBtn = window.locator('button', { hasText: 'Cancel' })
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Create Table (3 tests)
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Create Table', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should open create table view', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'mysql')

    await openCreateTableAndAddColumn(window)

    // Verify col-name-input is visible
    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should show column editor', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'mysql')

    await openCreateTableAndAddColumn(window)

    // Verify col-name-input is visible
    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should allow adding columns', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'mysql')

    await openCreateTableAndAddColumn(window)

    // Wait for column editor
    const colNameInput = window.getByTestId('col-name-input').first()
    await expect(colNameInput).toBeVisible({ timeout: 10_000 })

    // Type a column name
    await colNameInput.fill('my_column')

    // Verify the value is entered
    await expect(colNameInput).toHaveValue('my_column')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite Create Table (2 tests)
// ---------------------------------------------------------------------------
test.describe.serial('SQLite Create Table', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should open create table view', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'sqlite')

    await openCreateTableAndAddColumn(window)

    // Verify col-name-input is visible
    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should show column editor', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'sqlite')

    await openCreateTableAndAddColumn(window)

    // Verify col-name-input is visible
    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// DuckDB Create Table (2 tests)
// ---------------------------------------------------------------------------
test.describe.serial('DuckDB Create Table', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should open create table view', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'duckdb')

    await openCreateTableAndAddColumn(window)

    // Verify col-name-input is visible
    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should show column editor', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'duckdb')

    await openCreateTableAndAddColumn(window)

    // Verify col-name-input is visible
    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Safe Mode Interaction (2 tests)
// ---------------------------------------------------------------------------
test.describe.serial('Safe Mode Interaction', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should disable create table in safe mode', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off first so the button is visible
    await actions.disableSafeMode()

    await openCreateTableAndAddColumn(window)

    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    // Enable safe mode
    await actions.enableSafeMode()

    // Fill in a table name via the input (placeholder "Enter table name...")
    const tableNameInput = window.locator('input[placeholder="Enter table name..."]')
    await expect(tableNameInput).toBeVisible({ timeout: 5_000 })
    await tableNameInput.fill('safe_mode_test')

    // Type a column name
    await colNameInput.first().fill('id')

    // Try clicking the Create Table button
    const createTableBtn = window.locator('button', { hasText: 'Create Table' })
    await expect(createTableBtn).toBeVisible({ timeout: 5_000 })
    await createTableBtn.click()

    // Should show a safe mode info toast instead of creating the table
    const infoToast = window.locator('[data-sonner-toast][data-type="info"]')
    await expect(infoToast).toBeVisible({ timeout: 5_000 })
  })

  test('should allow create table view to open even in safe mode', async () => {
    test.setTimeout(120_000)
    actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off first so we can click the button
    await actions.disableSafeMode()

    await openCreateTableAndAddColumn(window)

    const colNameInput = window.getByTestId('col-name-input')
    await expect(colNameInput.first()).toBeVisible({ timeout: 10_000 })

    // Now enable safe mode — the view should remain open
    await actions.enableSafeMode()

    // The column editor should still be visible (view stays open)
    await expect(colNameInput.first()).toBeVisible({ timeout: 5_000 })

    // But the Create Table button click should be blocked (tested above)
    const createTableBtn = window.locator('button', { hasText: 'Create Table' })
    await expect(createTableBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})
