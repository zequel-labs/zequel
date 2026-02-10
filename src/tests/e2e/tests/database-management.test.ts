import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'
import type { userActions } from '../page-actions'

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const openDatabaseManager = async (page: Page): Promise<void> => {
  const dbManagerBtn = page.getByTestId('header-dbmanager-btn')
  await expect(dbManagerBtn).toBeVisible({ timeout: 5_000 })
  await dbManagerBtn.click()
  // Wait for the dialog heading (use role to avoid matching Monaco editor text)
  await expect(page.getByRole('heading', { name: 'Databases' })).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// PostgreSQL Database Management
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Database Management', () => {
  let app: ElectronApplication
  let window: Page
  let actions: ReturnType<typeof userActions>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open database manager dialog', async () => {
    await openDatabaseManager(window)

    // Verify databases are listed
    const dialogContent = window.getByTestId('database-manager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)

    // Dismiss the dialog so it doesn't block subsequent tests
    await window.keyboard.press('Escape')
    await window.waitForTimeout(500)
  })

  test('create and drop database via query', async () => {
    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP DATABASE IF EXISTS e2e_test_db')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create database
    await actions.typeQuery('CREATE DATABASE e2e_test_db')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Drop database
    await actions.typeQuery('DROP DATABASE e2e_test_db')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

})

// ---------------------------------------------------------------------------
// MySQL Database Management
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Database Management', () => {
  let app: ElectronApplication
  let window: Page
  let actions: ReturnType<typeof userActions>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mysql')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open database manager dialog', async () => {
    await openDatabaseManager(window)

    const dialogContent = window.getByTestId('database-manager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)

    // Dismiss the dialog so it doesn't block subsequent tests
    await window.keyboard.press('Escape')
    await window.waitForTimeout(500)
  })

  test('create and drop database via query', async () => {
    await actions.openQueryEditor()

    await actions.typeQuery('DROP DATABASE IF EXISTS e2e_test_db')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    await actions.typeQuery('CREATE DATABASE e2e_test_db')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP DATABASE e2e_test_db')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('switch database', async () => {
    await openDatabaseManager(window)
    await window.waitForTimeout(1000)

    // Find a database that isn't the current one and click it
    const dialogContent = window.getByTestId('database-manager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    // The current database has a green check icon; look for one without it
    const dbItems = dialogContent.locator('.cursor-pointer')
    const count = await dbItems.count()
    if (count > 1) {
      // Click the second database (first is likely the current one)
      await dbItems.nth(1).click()
      await window.waitForTimeout(2000)
      // Verify the sidebar refreshed (connection still alive)
      await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })
    }

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MariaDB Database Management
// ---------------------------------------------------------------------------
test.describe.serial('MariaDB Database Management', () => {
  let app: ElectronApplication
  let window: Page
  let actions: ReturnType<typeof userActions>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mariadb')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open database manager dialog', async () => {
    await openDatabaseManager(window)

    const dialogContent = window.getByTestId('database-manager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)

    // Dismiss the dialog so it doesn't block subsequent tests
    await window.keyboard.press('Escape')
    await window.waitForTimeout(500)
  })

  test('create and drop database via query', async () => {
    await actions.openQueryEditor()

    await actions.typeQuery('DROP DATABASE IF EXISTS e2e_test_db')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    await actions.typeQuery('CREATE DATABASE e2e_test_db')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP DATABASE e2e_test_db')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Database Management
// ---------------------------------------------------------------------------
test.describe.serial('ClickHouse Database Management', () => {
  let app: ElectronApplication
  let window: Page
  let actions: ReturnType<typeof userActions>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'clickhouse')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open database manager dialog', async () => {
    await openDatabaseManager(window)

    const dialogContent = window.getByTestId('database-manager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)

    // Dismiss the dialog so it doesn't block subsequent tests
    await window.keyboard.press('Escape')
    await window.waitForTimeout(500)
  })

  test('create and drop database via query', async () => {
    await actions.openQueryEditor()

    await actions.typeQuery('DROP DATABASE IF EXISTS e2e_test_db')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    await actions.typeQuery('CREATE DATABASE e2e_test_db')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP DATABASE e2e_test_db')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})
