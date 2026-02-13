import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.locator('button:has(.tabler-icon-dots-vertical)')
  await trigger.click()
}

// ---------------------------------------------------------------------------
// PostgreSQL Monitoring
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Monitoring', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open monitoring view', async () => {
    await connectTo(window, 'postgres')

    await openMoreMenu(window)

    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    await expect(monitoringBtn).toBeVisible({ timeout: 5_000 })
    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByText('No active processes found')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('kill process from monitoring view', async () => {
    await connectTo(window, 'postgres')

    await openMoreMenu(window)

    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByText('No active processes found')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    // Only attempt kill if there are processes to kill
    const hasTable = await monitoringTable.isVisible().catch(() => false)
    if (hasTable) {
      const rows = monitoringTable.locator('tbody tr')
      const rowCount = await rows.count()
      if (rowCount > 0) {
        // Click kill on the first process
        const killBtn = window.getByTestId('monitoring-kill-0')
        await killBtn.click()

        // Confirm kill in the dialog
        const confirmKillBtn = window.getByRole('button', { name: 'Kill Process' })
        await expect(confirmKillBtn).toBeVisible({ timeout: 5_000 })
        await confirmKillBtn.click()

        // Should not produce an error (process may or may not exist)
        await window.waitForTimeout(2000)
      }
    }

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Monitoring
// ---------------------------------------------------------------------------
test.describe('MySQL Monitoring', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open monitoring view', async () => {
    await connectTo(window, 'mysql')

    await openMoreMenu(window)

    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    await expect(monitoringBtn).toBeVisible({ timeout: 5_000 })
    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByText('No active processes found')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MariaDB Monitoring
// ---------------------------------------------------------------------------
test.describe('MariaDB Monitoring', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open monitoring view', async () => {
    await connectTo(window, 'mariadb')

    await openMoreMenu(window)

    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    await expect(monitoringBtn).toBeVisible({ timeout: 5_000 })
    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByText('No active processes found')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Monitoring
// ---------------------------------------------------------------------------
test.describe('ClickHouse Monitoring', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open monitoring view', async () => {
    await connectTo(window, 'clickhouse')

    await openMoreMenu(window)

    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    const isVisible = await monitoringBtn.isVisible().catch(() => false)

    if (!isVisible) {
      test.skip()
      return
    }

    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByText('No active processes found')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MongoDB Monitoring
// ---------------------------------------------------------------------------
test.describe('MongoDB Monitoring', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open monitoring view', async () => {
    await connectTo(window, 'mongodb')

    await openMoreMenu(window)

    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    const isVisible = await monitoringBtn.isVisible().catch(() => false)

    if (!isVisible) {
      test.skip()
      return
    }

    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByText('No active processes found')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Redis Monitoring
// ---------------------------------------------------------------------------
test.describe('Redis Monitoring', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open monitoring view', async () => {
    await connectTo(window, 'redis')

    await openMoreMenu(window)

    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    const isVisible = await monitoringBtn.isVisible().catch(() => false)

    if (!isVisible) {
      test.skip()
      return
    }

    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByText('No active processes found')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQL Server Monitoring
// ---------------------------------------------------------------------------
test.describe('SQL Server Monitoring', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open monitoring view', async () => {
    await connectTo(window, 'sqlserver')

    await openMoreMenu(window)

    const monitoringBtn = window.getByTestId('header-monitoring-btn')
    await expect(monitoringBtn).toBeVisible({ timeout: 5_000 })
    await monitoringBtn.click()

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByText('No active processes found')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})
