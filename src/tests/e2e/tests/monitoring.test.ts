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
  const trigger = page.locator('button:has(.tabler-icon-dots-vertical)')
  await trigger.click()
}

// ---------------------------------------------------------------------------
// PostgreSQL Monitoring
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Monitoring', () => {
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

  test('open monitoring view', async () => {
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

  test('open monitoring view', async () => {
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

  test('open monitoring view', async () => {
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

  test('open monitoring view', async () => {
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

  test('open monitoring view', async () => {
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

  test('open monitoring view', async () => {
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
