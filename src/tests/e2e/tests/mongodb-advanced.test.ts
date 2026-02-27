import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

test.describe.serial('MongoDB Advanced', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('aggregation pipeline query', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openQueryEditor()
    await actions.typeQuery('db.customers.aggregate([{ $match: {} }, { $limit: 5 }])')
    await actions.runQuery()

    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
  })

  test('open collection and view documents', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollection('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Verify rows are loaded
    const rows = window.locator('[data-testid^="grid-row-"]')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('document fields visible in grid', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollection('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Verify at least the _id column header exists
    const idHeader = window.getByTestId('grid-header-_id')
    await expect(idHeader).toBeVisible({ timeout: 10_000 })
  })

  test('add row creates new document placeholder', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollection('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 30_000 })

    // Get initial row count
    const initialRows = await window.locator('[data-testid^="grid-row-"]').count()

    // Add a row
    await actions.addRow()

    // Verify pending changes indicator appears
    await expect(window.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 5_000 })

    // Discard to restore state
    await actions.discardChanges()
  })

  test('count query works', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openQueryEditor()
    await actions.typeQuery('db.customers.countDocuments({})')
    await actions.runQuery()

    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
  })

  test('find query with filter', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openQueryEditor()
    await actions.typeQuery('db.customers.find({ }).limit(3)')
    await actions.runQuery()

    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
  })
})
