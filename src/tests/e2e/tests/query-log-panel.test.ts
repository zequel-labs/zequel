import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

test.describe.serial('Query Log Panel - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query history tab shows entries after running queries', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run a query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test_val')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to history tab in the sidebar
    await actions.switchSidebarTab('history')

    // Verify history entries appear
    const historyItems = window.locator('[data-testid^="sidebar-history-"]')
    const count = await historyItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('multiple queries appear in history', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run first query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS first_query')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Run second query
    await window.keyboard.press('Meta+a')
    await actions.typeQuery('SELECT 2 AS second_query')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to history tab
    await actions.switchSidebarTab('history')

    // Verify at least 2 history entries
    const historyItems = window.locator('[data-testid^="sidebar-history-"]')
    const count = await historyItems.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('switching back to items tab works after viewing history', async () => {
    const actions = await connectTo(window, 'postgres')

    // Run a query so there's history
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    // Switch to history
    await actions.switchSidebarTab('history')
    await window.waitForTimeout(500)

    // Switch back to items
    await actions.switchSidebarTab('items')

    // Verify tables are visible again
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })
  })

  test('saved queries tab shows queries section', async () => {
    const actions = await connectTo(window, 'postgres')

    // Switch to queries tab
    await actions.switchSidebarTab('queries')
    await window.waitForTimeout(500)

    // The queries tab should be visible
    await expect(window.getByTestId('sidebar-tab-queries')).toBeVisible()
  })
})

test.describe.serial('Query Log Panel - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query history works on MySQL', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test_val')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })

    await actions.switchSidebarTab('history')

    const historyItems = window.locator('[data-testid^="sidebar-history-"]')
    const count = await historyItems.count()
    expect(count).toBeGreaterThan(0)
  })
})
