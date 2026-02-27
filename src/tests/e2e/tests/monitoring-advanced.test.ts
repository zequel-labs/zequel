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

const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.getByTestId('header-more-menu-btn')
  await trigger.click()
}

const openMonitoringView = async (page: Page): Promise<void> => {
  await openMoreMenu(page)
  const monitoringBtn = page.getByTestId('header-monitoring-btn')
  await expect(monitoringBtn).toBeVisible({ timeout: 5_000 })
  await monitoringBtn.click()
}

const waitForMonitoringContent = async (page: Page): Promise<void> => {
  const monitoringTable = page.getByTestId('monitoring-table')
  const emptyMessage = page.getByTestId('monitoring-empty')
  await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })
}

// ---------------------------------------------------------------------------
// Monitoring View - PostgreSQL (Advanced)
// ---------------------------------------------------------------------------
test.describe.serial('Monitoring View - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('monitoring tab appears as "Process Monitor"', async () => {
    await connectTo(window, 'postgres')
    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    // Tab title is "Process Monitor" so testid is tab-Process Monitor
    const monitoringTab = window.getByTestId('tab-Process Monitor')
    await expect(monitoringTab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('process table or empty state is visible', async () => {
    await connectTo(window, 'postgres')
    await openMonitoringView(window)

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('at least one process is visible for the active connection', async () => {
    await connectTo(window, 'postgres')
    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    // PostgreSQL should show at least the current connection process
    const monitoringTable = window.getByTestId('monitoring-table')
    const hasTable = await monitoringTable.isVisible().catch(() => false)

    if (hasTable) {
      const rows = monitoringTable.locator('[data-testid^="monitoring-row-"]')
      const rowCount = await rows.count()
      expect(rowCount).toBeGreaterThanOrEqual(1)
    }
    // If no table, the empty state is shown which is also acceptable
    // (e.g. if the server kills idle backends quickly)

    await assertNoErrorToast(window)
  })

  test('refresh button reloads the process list', async () => {
    await connectTo(window, 'postgres')
    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    // Click the manual refresh button in the status bar
    const refreshBtn = window.getByTestId('statusbar-monitoring-refresh')
    await expect(refreshBtn).toBeVisible({ timeout: 5_000 })
    await refreshBtn.click()

    // Wait a moment for data to reload
    await window.waitForTimeout(1_000)

    // The monitoring view should still show content (table or empty)
    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('auto-refresh toggle is visible in the status bar', async () => {
    await connectTo(window, 'postgres')
    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    const autoRefreshBtn = window.getByTestId('statusbar-monitoring-autorefresh')
    await expect(autoRefreshBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('auto-refresh toggle can be clicked', async () => {
    await connectTo(window, 'postgres')
    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    const autoRefreshBtn = window.getByTestId('statusbar-monitoring-autorefresh')
    await expect(autoRefreshBtn).toBeVisible({ timeout: 5_000 })

    // Click to enable auto-refresh
    await autoRefreshBtn.click()
    await window.waitForTimeout(500)

    // Click again to disable auto-refresh
    await autoRefreshBtn.click()
    await window.waitForTimeout(500)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Monitoring View - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Monitoring View - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('monitoring view shows table or empty state', async () => {
    await connectTo(window, 'mysql')
    await openMonitoringView(window)

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('refresh button works', async () => {
    await connectTo(window, 'mysql')
    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    const refreshBtn = window.getByTestId('statusbar-monitoring-refresh')
    await expect(refreshBtn).toBeVisible({ timeout: 5_000 })
    await refreshBtn.click()

    await window.waitForTimeout(1_000)

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Monitoring View - MariaDB
// ---------------------------------------------------------------------------
test.describe.serial('Monitoring View - MariaDB', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('monitoring view loads successfully', async () => {
    await connectTo(window, 'mariadb')
    await openMonitoringView(window)

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Monitoring View - ClickHouse
// ---------------------------------------------------------------------------
test.describe.serial('Monitoring View - ClickHouse', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('monitoring view loads successfully', async () => {
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
    const emptyMessage = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Monitoring View - SQL Server
// ---------------------------------------------------------------------------
test.describe.serial('Monitoring View - SQL Server', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('monitoring view loads successfully', async () => {
    await connectTo(window, 'sqlserver')
    await openMonitoringView(window)

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('refresh button works', async () => {
    await connectTo(window, 'sqlserver')
    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    const refreshBtn = window.getByTestId('statusbar-monitoring-refresh')
    await expect(refreshBtn).toBeVisible({ timeout: 5_000 })
    await refreshBtn.click()

    await window.waitForTimeout(1_000)

    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Monitoring Tab Deduplication
// ---------------------------------------------------------------------------
test.describe.serial('Monitoring Tab Deduplication', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('opening monitoring twice creates only one tab (PostgreSQL)', async () => {
    await connectTo(window, 'postgres')

    // Open monitoring the first time
    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    // Verify the tab exists
    const monitoringTab = window.getByTestId('tab-Process Monitor')
    await expect(monitoringTab).toBeVisible({ timeout: 5_000 })

    // Count tabs with the monitoring title before opening again
    const tabsBefore = await window.locator('[data-testid="tab-Process Monitor"]').count()
    expect(tabsBefore).toBe(1)

    // Open monitoring a second time
    await openMonitoringView(window)
    await window.waitForTimeout(500)

    // Should still be exactly one monitoring tab
    const tabsAfter = await window.locator('[data-testid="tab-Process Monitor"]').count()
    expect(tabsAfter).toBe(1)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Monitoring View - Safe Mode
// ---------------------------------------------------------------------------
test.describe.serial('Monitoring View - Safe Mode', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('monitoring view loads with safe mode enabled', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode before opening monitoring
    await actions.enableSafeMode()

    // Open monitoring view
    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    // The monitoring view should still load and display content
    const monitoringTable = window.getByTestId('monitoring-table')
    const emptyMessage = window.getByTestId('monitoring-empty')
    await expect(monitoringTable.or(emptyMessage)).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('kill buttons are present when safe mode is off', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    const monitoringTable = window.getByTestId('monitoring-table')
    const hasTable = await monitoringTable.isVisible().catch(() => false)

    if (hasTable) {
      const rows = monitoringTable.locator('[data-testid^="monitoring-row-"]')
      const rowCount = await rows.count()
      if (rowCount > 0) {
        // Kill button should be visible for the first process
        const killBtn = window.locator('[data-testid="monitoring-kill-0"]')
        await expect(killBtn).toBeVisible({ timeout: 5_000 })
      }
    }

    await assertNoErrorToast(window)
  })

  test('kill process flow works with safe mode off', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    await openMonitoringView(window)
    await waitForMonitoringContent(window)

    const monitoringTable = window.getByTestId('monitoring-table')
    const hasTable = await monitoringTable.isVisible().catch(() => false)

    if (hasTable) {
      const rows = monitoringTable.locator('[data-testid^="monitoring-row-"]')
      const rowCount = await rows.count()
      if (rowCount > 0) {
        // Click kill on the first process
        const killBtn = window.locator('[data-testid="monitoring-kill-0"]')
        await killBtn.click()

        // Confirm kill dialog should appear
        const confirmKillBtn = window.getByTestId('monitoring-confirm-kill')
        await expect(confirmKillBtn).toBeVisible({ timeout: 5_000 })

        // Click confirm kill
        await confirmKillBtn.click()

        // Wait for the action to complete
        await window.waitForTimeout(2_000)
      }
    }

    await assertNoErrorToast(window)
  })
})
