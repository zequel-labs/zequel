import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

let app: ElectronApplication
let window: Page

/** Parse "1-N of M" into { start, end, total } or null */
const parseRange = (range: string): { start: number; end: number; total: number } | null => {
  const m = range.match(/^(\d+)-(\d+) of (\d+)$/)
  return m ? { start: Number(m[1]), end: Number(m[2]), total: Number(m[3]) } : null
}

test.describe('PostgreSQL Pagination', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('view record range for order_items', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('order_items')

    const range = await actions.getRecordRange()
    // order_items has ≥50 seed rows; count may grow from E2E data-editing runs
    const parsed = parseRange(range)
    expect(parsed).not.toBeNull()
    expect(parsed!.total).toBeGreaterThanOrEqual(50)
    expect(parsed!.start).toBe(1)
  })

  test('navigate pages after reducing page size', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('order_items')

    // Verify initial state shows rows (≥50 seed rows)
    const initialRange = await actions.getRecordRange()
    expect(parseRange(initialRange)!.total).toBeGreaterThanOrEqual(50)

    // Open settings popover and reduce the limit to 20 to enable pagination
    const settingsBtn = window.getByTestId('statusbar-settings-btn')
    await settingsBtn.click()

    // Scope the limit input to the popover (avoid matching filter bar inputs)
    const popoverApplyBtn = window.getByTestId('statusbar-settings-apply')
    await expect(popoverApplyBtn).toBeVisible({ timeout: 5_000 })
    const popoverContainer = popoverApplyBtn.locator('..')
    const limitInput = popoverContainer.locator('input[type="number"]').first()
    await limitInput.fill('20')

    // Click the Apply button inside the popover
    await popoverApplyBtn.click()
    await window.waitForTimeout(1_000)

    // Now we should see page 1: 1-20 of N
    const page1Range = await actions.getRecordRange()
    expect(page1Range).toMatch(/^1-20 of \d+$/)

    // Navigate to next page
    await actions.goToNextPage()
    const page2Range = await actions.getRecordRange()
    expect(page2Range).toMatch(/^21-40 of \d+$/)

    // Navigate to previous page
    await actions.goToPreviousPage()
    const backToPage1Range = await actions.getRecordRange()
    expect(backToPage1Range).toMatch(/^1-20 of \d+$/)
  })
})

test.describe('MySQL Pagination', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('view record range and navigate for orders', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('orders')

    const range = await actions.getRecordRange()
    // orders has ≥30 seed rows; count may grow from E2E data-editing runs
    const parsed = parseRange(range)
    expect(parsed).not.toBeNull()
    expect(parsed!.total).toBeGreaterThanOrEqual(30)
    expect(parsed!.start).toBe(1)
  })
})

test.describe('ClickHouse Pagination', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('view record range for events', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openTable('events')

    const range = await actions.getRecordRange()
    // events has ≥100 seed rows; count may grow from E2E data-editing runs
    const parsed = parseRange(range)
    expect(parsed).not.toBeNull()
    expect(parsed!.total).toBeGreaterThanOrEqual(100)
    expect(parsed!.start).toBe(1)
  })

  test('navigate pages after reducing page size', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openTable('events')

    // Verify initial state shows rows (≥100 seed rows)
    const initialRange = await actions.getRecordRange()
    expect(parseRange(initialRange)!.total).toBeGreaterThanOrEqual(100)

    // Open settings popover and reduce the limit to 50 to enable pagination
    const settingsBtn = window.getByTestId('statusbar-settings-btn')
    await settingsBtn.click()

    // Scope the limit input to the popover (avoid matching filter bar inputs)
    const popoverApplyBtn = window.getByTestId('statusbar-settings-apply')
    await expect(popoverApplyBtn).toBeVisible({ timeout: 5_000 })
    const popoverContainer = popoverApplyBtn.locator('..')
    const limitInput = popoverContainer.locator('input[type="number"]').first()
    await limitInput.fill('50')

    // Click the Apply button inside the popover
    await popoverApplyBtn.click()
    await window.waitForTimeout(1_000)

    // Now we should see page 1: 1-50 of N
    const page1Range = await actions.getRecordRange()
    expect(page1Range).toMatch(/^1-50 of \d+$/)

    // Navigate to next page
    await actions.goToNextPage()
    const page2Range = await actions.getRecordRange()
    expect(page2Range).toMatch(/^51-\d+ of \d+$/)

    // Navigate back to previous page
    await actions.goToPreviousPage()
    const backToPage1Range = await actions.getRecordRange()
    expect(backToPage1Range).toMatch(/^1-50 of \d+$/)
  })
})

test.describe('MongoDB Pagination', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('view record range for orders collection', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollection('orders')

    const range = await actions.getRecordRange()
    // orders collection has ≥30 seed documents
    const parsed = parseRange(range)
    expect(parsed).not.toBeNull()
    expect(parsed!.total).toBeGreaterThanOrEqual(30)
    expect(parsed!.start).toBe(1)
  })
})

test.describe('SQLite Pagination', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('view record range for order_items', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('order_items')

    const range = await actions.getRecordRange()
    // order_items has ≥50 seed rows
    const parsed = parseRange(range)
    expect(parsed).not.toBeNull()
    expect(parsed!.total).toBeGreaterThanOrEqual(50)
    expect(parsed!.start).toBe(1)
  })
})

test.describe('DuckDB Pagination', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('view record range for order_items', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openTable('order_items')

    const range = await actions.getRecordRange()
    // order_items has 13 seed rows
    const parsed = parseRange(range)
    expect(parsed).not.toBeNull()
    expect(parsed!.total).toBeGreaterThanOrEqual(10)
    expect(parsed!.start).toBe(1)
  })
})
