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

const assertTransactionActive = async (page: Page): Promise<void> => {
  const indicator = page.getByTestId('txn-active-indicator')
  await expect(indicator).toBeVisible({ timeout: 5_000 })
  const commitBtn = page.getByTestId('txn-commit-btn')
  const rollbackBtn = page.getByTestId('txn-rollback-btn')
  await expect(commitBtn).toBeVisible()
  await expect(rollbackBtn).toBeVisible()
}

const assertTransactionInactive = async (page: Page): Promise<void> => {
  const indicator = page.getByTestId('txn-active-indicator')
  await expect(indicator).not.toBeVisible({ timeout: 5_000 })
}

// ---------------------------------------------------------------------------
// PostgreSQL Transaction
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Transaction', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should show auto/manual commit toggle', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    // Type and run a query to make results visible (which shows the action bar)
    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    // The Auto/Manual toggle should be visible in the action bar
    const autoBtn = window.getByTestId('txn-auto-btn')
    const manualBtn = window.getByTestId('txn-manual-btn')
    await expect(autoBtn).toBeVisible({ timeout: 5_000 })
    await expect(manualBtn).toBeVisible()
  })

  test('should begin and commit a transaction', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    // Switch to manual commit mode
    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    // Click Begin
    const beginBtn = window.getByTestId('txn-begin-btn')
    await expect(beginBtn).toBeVisible({ timeout: 5_000 })
    await beginBtn.click()

    // The "Transaction active" indicator should appear with Commit/Rollback
    await assertTransactionActive(window)

    // Click Commit
    const commitBtn = window.getByTestId('txn-commit-btn')
    await commitBtn.click()

    // Transaction indicator should disappear
    await assertTransactionInactive(window)
    await assertNoErrorToast(window)
  })

  test('should begin and rollback a transaction', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    const beginBtn = window.getByTestId('txn-begin-btn')
    await beginBtn.click()

    await assertTransactionActive(window)

    const rollbackBtn = window.getByTestId('txn-rollback-btn')
    await rollbackBtn.click()

    await assertTransactionInactive(window)
    await assertNoErrorToast(window)
  })

  test('should execute queries within a transaction', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    // Switch to manual and begin
    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    const beginBtn = window.getByTestId('txn-begin-btn')
    await beginBtn.click()
    await assertTransactionActive(window)

    // Run a query within the transaction
    await actions.typeQuery('SELECT * FROM customers LIMIT 3')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })

    // Rollback to clean up
    const rollbackBtn = window.getByTestId('txn-rollback-btn')
    await rollbackBtn.click()
    await assertNoErrorToast(window)
  })

  test('should hide auto/manual toggle when transaction is active', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    // Switch to manual and begin transaction
    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    const beginBtn = window.getByTestId('txn-begin-btn')
    await beginBtn.click()
    await assertTransactionActive(window)

    // Auto/Manual toggle should be hidden while transaction is active
    const autoBtn = window.getByTestId('txn-auto-btn')
    await expect(autoBtn).not.toBeVisible({ timeout: 3_000 })
    await expect(manualBtn).not.toBeVisible({ timeout: 3_000 })

    // Rollback to restore the toggle
    const rollbackBtn = window.getByTestId('txn-rollback-btn')
    await rollbackBtn.click()
    await assertTransactionInactive(window)

    // Toggle should be visible again
    await expect(autoBtn).toBeVisible({ timeout: 5_000 })
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Transaction
// ---------------------------------------------------------------------------
test.describe('MySQL Transaction', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should begin and commit a transaction', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    const beginBtn = window.getByTestId('txn-begin-btn')
    await beginBtn.click()
    await assertTransactionActive(window)

    const commitBtn = window.getByTestId('txn-commit-btn')
    await commitBtn.click()
    await assertTransactionInactive(window)

    await assertNoErrorToast(window)
  })

  test('should begin and rollback a transaction', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    const beginBtn = window.getByTestId('txn-begin-btn')
    await beginBtn.click()
    await assertTransactionActive(window)

    const rollbackBtn = window.getByTestId('txn-rollback-btn')
    await rollbackBtn.click()
    await assertTransactionInactive(window)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite Transaction
// ---------------------------------------------------------------------------
test.describe('SQLite Transaction', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should begin and commit a transaction', async () => {
    const actions = await connectTo(window, 'sqlite')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    const beginBtn = window.getByTestId('txn-begin-btn')
    await beginBtn.click()
    await assertTransactionActive(window)

    const commitBtn = window.getByTestId('txn-commit-btn')
    await commitBtn.click()
    await assertTransactionInactive(window)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// DuckDB Transaction
// ---------------------------------------------------------------------------
test.describe('DuckDB Transaction', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should begin and commit a transaction', async () => {
    const actions = await connectTo(window, 'duckdb')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    const beginBtn = window.getByTestId('txn-begin-btn')
    await beginBtn.click()
    await assertTransactionActive(window)

    const commitBtn = window.getByTestId('txn-commit-btn')
    await commitBtn.click()
    await assertTransactionInactive(window)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQL Server Transaction
// ---------------------------------------------------------------------------
test.describe('SQL Server Transaction', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should begin and commit a transaction', async () => {
    const actions = await connectTo(window, 'sqlserver')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    const beginBtn = window.getByTestId('txn-begin-btn')
    await beginBtn.click()
    await assertTransactionActive(window)

    const commitBtn = window.getByTestId('txn-commit-btn')
    await commitBtn.click()
    await assertTransactionInactive(window)

    await assertNoErrorToast(window)
  })

  test('should begin and rollback a transaction', async () => {
    const actions = await connectTo(window, 'sqlserver')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    const manualBtn = window.getByTestId('txn-manual-btn')
    await manualBtn.click()

    const beginBtn = window.getByTestId('txn-begin-btn')
    await beginBtn.click()
    await assertTransactionActive(window)

    const rollbackBtn = window.getByTestId('txn-rollback-btn')
    await rollbackBtn.click()
    await assertTransactionInactive(window)

    await assertNoErrorToast(window)
  })
})
