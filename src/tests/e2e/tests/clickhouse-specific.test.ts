import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

test.describe.serial('ClickHouse Specific', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('tables are read-only - no add row button', async () => {
    const actions = await connectTo(window, 'clickhouse')
    await actions.openTable('customers')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })

    // Add row button should not be visible for ClickHouse
    const addRowBtn = window.getByTestId('statusbar-add-row-btn')
    await expect(addRowBtn).not.toBeVisible({ timeout: 3_000 })
  })

  test('context menu lacks destructive options', async () => {
    const actions = await connectTo(window, 'clickhouse')
    await actions.openTable('customers')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })

    // Right-click a cell to open context menu
    const cell = window.getByTestId('grid-cell-0-name')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.click({ button: 'right' })

    // Delete option should not be visible
    const deleteOption = window.getByTestId('grid-ctx-delete')
    await expect(deleteOption).not.toBeVisible({ timeout: 3_000 })
  })

  test('query runs correctly', async () => {
    const actions = await connectTo(window, 'clickhouse')
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS result')
    await actions.runQuery()

    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
  })

  test('structure tab is view-only - no add column button', async () => {
    const actions = await connectTo(window, 'clickhouse')
    await actions.openTable('customers')

    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
    await actions.switchToStructureTab()

    // Columns tab should be visible
    await expect(window.getByTestId('structure-columns-tab')).toBeVisible({ timeout: 10_000 })

    // Add column button should not be visible (safe mode is off but ClickHouse is read-only)
    const addBtn = window.getByTestId('structure-add-column-btn')
    await expect(addBtn).not.toBeVisible({ timeout: 3_000 })
  })
})
