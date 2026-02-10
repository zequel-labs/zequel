import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const openMoreMenu = async (page: Page): Promise<void> => {
  // Dismiss any open dropdown/dialog/overlay left from a prior test
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const trigger = page.getByTestId('header-more-btn')
  await trigger.click()
}

// ---------------------------------------------------------------------------
// PostgreSQL Export Tests
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Export', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open export/backup menu item', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })

    // Verify the button text
    await expect(exportBtn).toContainText('Backup / Export')
  })

  test('click export triggers native dialog without error', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await exportBtn.click()

    // The export triggers a native file save dialog. In the E2E environment
    // the dialog will either appear (and we cannot interact with it) or the
    // API call may return a canceled result. Either way, we should not see
    // an error toast from the application itself.
    await window.waitForTimeout(2_000)
    await assertNoErrorToast(window)
  })

  test('export button accessible after opening a table', async () => {
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(exportBtn).toContainText('Backup / Export')
  })

  test('export button accessible from query editor', async () => {
    await actions.openQueryEditor()
    await expect(window.getByTestId('monaco-editor')).toBeVisible({ timeout: 10_000 })

    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// MySQL Export Tests
// ---------------------------------------------------------------------------
test.describe('MySQL Export', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'mysql')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open export/backup menu item', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(exportBtn).toContainText('Backup / Export')
  })

  test('click export triggers native dialog without error', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await exportBtn.click()

    await window.waitForTimeout(2_000)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL Import Tests
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Import', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open import/restore menu item', async () => {
    await openMoreMenu(window)

    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 5_000 })
    await expect(importBtn).toContainText('Restore / Import')
  })

  test('click import triggers native dialog without error', async () => {
    await openMoreMenu(window)

    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 5_000 })
    await importBtn.click()

    // The import triggers a native file open dialog. In the E2E environment
    // the dialog will either appear or the API call returns a canceled result.
    // We verify the app does not produce an error toast.
    await window.waitForTimeout(2_000)
    await assertNoErrorToast(window)
  })

  test('both export and import items visible in menu', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    const importBtn = window.getByTestId('header-import-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(importBtn).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// SQLite Export Tests
// ---------------------------------------------------------------------------
test.describe('SQLite Export', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'sqlite')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open export/backup menu item', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(exportBtn).toContainText('Backup / Export')
  })

  test('click export triggers native dialog without error', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await exportBtn.click()

    await window.waitForTimeout(2_000)
    await assertNoErrorToast(window)
  })

  test('import menu item visible for SQLite', async () => {
    await openMoreMenu(window)

    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 5_000 })
    await expect(importBtn).toContainText('Restore / Import')
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Export Tests
// ---------------------------------------------------------------------------
test.describe('ClickHouse Export', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'clickhouse')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open export/backup menu item', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(exportBtn).toContainText('Backup / Export')
  })

  test('click export triggers native dialog without error', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await exportBtn.click()

    await window.waitForTimeout(2_000)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MongoDB Export Tests
// ---------------------------------------------------------------------------
test.describe('MongoDB Export', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'mongodb')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open export/backup menu item', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(exportBtn).toContainText('Backup / Export')
  })

  test('click export triggers native dialog without error', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await exportBtn.click()

    await window.waitForTimeout(2_000)
    await assertNoErrorToast(window)
  })

  test('import menu item visible for MongoDB', async () => {
    await openMoreMenu(window)

    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 5_000 })
    await expect(importBtn).toContainText('Restore / Import')
  })
})

// ---------------------------------------------------------------------------
// MariaDB Export Tests
// ---------------------------------------------------------------------------
test.describe('MariaDB Export', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'mariadb')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open export/backup menu item', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(exportBtn).toContainText('Backup / Export')
  })

  test('click export triggers native dialog without error', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await exportBtn.click()

    await window.waitForTimeout(2_000)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Redis Export Tests
// ---------------------------------------------------------------------------
test.describe('Redis Export', () => {
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

  test('open export/backup menu item', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(exportBtn).toContainText('Backup / Export')
  })

  test('click export triggers native dialog without error', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await exportBtn.click()

    await window.waitForTimeout(2_000)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Export Dialog — Table View
// ---------------------------------------------------------------------------
test.describe('Export Dialog — Table View', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('export button visible in status bar after opening table', async () => {
    const exportBtn = window.getByTestId('statusbar-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(exportBtn).toContainText('Export')
  })

  test('clicking export button opens export dialog', async () => {
    await actions.clickExport()

    // Dialog should be visible with format tabs
    await expect(window.getByTestId('export-format-csv')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-format-json')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-format-sql')).toBeVisible({ timeout: 5_000 })
  })

  test('CSV format shows CSV-specific options', async () => {
    await actions.clickExport()

    // CSV is the default format
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-include-headers')).toBeVisible()
    await expect(window.getByTestId('export-null-as-empty')).toBeVisible()

    // JSON and SQL options should not be visible
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()
    await expect(window.getByTestId('export-sql-options')).not.toBeVisible()
  })

  test('switching to JSON format shows JSON-specific options', async () => {
    await actions.clickExport()
    await window.getByTestId('export-format-json').click()

    await expect(window.getByTestId('export-json-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-pretty-print')).toBeVisible()

    // CSV and SQL options should not be visible
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()
    await expect(window.getByTestId('export-sql-options')).not.toBeVisible()
  })

  test('switching to SQL format hides CSV and JSON options', async () => {
    await actions.clickExport()
    await window.getByTestId('export-format-sql').click()
    await window.waitForTimeout(300)

    // CSV and JSON options should not be visible when SQL is selected
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()
  })

  test('cancel button closes export dialog', async () => {
    await actions.clickExport()
    await expect(window.getByTestId('export-format-csv')).toBeVisible({ timeout: 5_000 })

    await window.getByTestId('export-cancel-btn').click()

    // Dialog should close
    await expect(window.getByTestId('export-format-csv')).not.toBeVisible({ timeout: 5_000 })
  })

  test('export dialog shows submit button', async () => {
    await actions.clickExport()

    await expect(window.getByTestId('export-submit-btn')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-submit-btn')).toContainText('Export')
  })

  test('format tabs can be toggled back and forth', async () => {
    await actions.clickExport()

    // Start with CSV
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })

    // Switch to JSON
    await window.getByTestId('export-format-json').click()
    await expect(window.getByTestId('export-json-options')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()

    // Switch to SQL — SQL options container may be empty, just verify others are hidden
    await window.getByTestId('export-format-sql').click()
    await window.waitForTimeout(300)
    await expect(window.getByTestId('export-json-options')).not.toBeVisible()
    await expect(window.getByTestId('export-csv-options')).not.toBeVisible()

    // Back to CSV
    await window.getByTestId('export-format-csv').click()
    await expect(window.getByTestId('export-csv-options')).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Export Dialog — Query View
// ---------------------------------------------------------------------------
test.describe('Export Dialog — Query View', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()
    await expect(window.getByTestId('monaco-editor')).toBeVisible({ timeout: 10_000 })
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('export button visible in status bar for query view', async () => {
    const exportBtn = window.getByTestId('statusbar-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await expect(exportBtn).toContainText('Export')
  })

  test('export dialog opens from query view after running a query', async () => {
    await actions.typeQuery('SELECT 1 AS test_col')
    await actions.runQuery()

    // Wait for results to appear
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 10_000 })

    await actions.clickExport()

    // Dialog should open with format tabs
    await expect(window.getByTestId('export-format-csv')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-format-json')).toBeVisible()
    await expect(window.getByTestId('export-format-sql')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog — MySQL Table View
// ---------------------------------------------------------------------------
test.describe('Export Dialog — MySQL Table View', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mysql')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('export button visible and dialog opens for MySQL table', async () => {
    await actions.clickExport()

    await expect(window.getByTestId('export-format-csv')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-csv-options')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog — SQLite Table View
// ---------------------------------------------------------------------------
test.describe('Export Dialog — SQLite Table View', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'sqlite')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('export button visible and dialog opens for SQLite table', async () => {
    await actions.clickExport()

    await expect(window.getByTestId('export-format-csv')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-csv-options')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog — ClickHouse Table View
// ---------------------------------------------------------------------------
test.describe('Export Dialog — ClickHouse Table View', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'clickhouse')
    await actions.openTableByTestId('events')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('export button visible and dialog opens for ClickHouse table', async () => {
    await actions.clickExport()

    await expect(window.getByTestId('export-format-csv')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-csv-options')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Export Dialog — MariaDB Table View
// ---------------------------------------------------------------------------
test.describe('Export Dialog — MariaDB Table View', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'mariadb')
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('export button visible and dialog opens for MariaDB table', async () => {
    await actions.clickExport()

    await expect(window.getByTestId('export-format-csv')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('export-csv-options')).toBeVisible()
  })
})
