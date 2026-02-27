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
// PostgreSQL Database Management
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Database Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open database manager dialog', async () => {
    await connectTo(window, 'postgres')

    await openDatabaseManager(window)

    // Verify databases are listed
    const dialogContent = window.getByTestId('dbmanager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('create and drop database via query', async () => {
    const actions = await connectTo(window, 'postgres')

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
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open database manager dialog', async () => {
    await connectTo(window, 'mysql')

    await openDatabaseManager(window)

    const dialogContent = window.getByTestId('dbmanager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('create and drop database via query', async () => {
    const actions = await connectTo(window, 'mysql')

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
    await connectTo(window, 'mysql')

    await openDatabaseManager(window)
    await window.waitForTimeout(1000)

    // Find a database that isn't the current one and click it
    const dialogContent = window.getByTestId('dbmanager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    // The current database has a green check icon; look for one without it
    const dbItems = dialogContent.locator('[data-testid^="dbmanager-db-"]')
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
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open database manager dialog', async () => {
    await connectTo(window, 'mariadb')

    await openDatabaseManager(window)

    const dialogContent = window.getByTestId('dbmanager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('create and drop database via query', async () => {
    const actions = await connectTo(window, 'mariadb')

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
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open database manager dialog', async () => {
    await connectTo(window, 'clickhouse')

    await openDatabaseManager(window)

    const dialogContent = window.getByTestId('dbmanager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('create and drop database via query', async () => {
    const actions = await connectTo(window, 'clickhouse')

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
// SQL Server Database Management
// ---------------------------------------------------------------------------
test.describe.serial('SQL Server Database Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open database manager dialog', async () => {
    await connectTo(window, 'sqlserver')

    await openDatabaseManager(window)

    const dialogContent = window.getByTestId('dbmanager-dialog')
    await expect(dialogContent).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('create and drop database via query', async () => {
    const actions = await connectTo(window, 'sqlserver')

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
