import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

let app: ElectronApplication
let window: Page

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
    // order_items has 50 rows, default limit is 100 so all fit on one page
    expect(range).toContain('of 50')
    expect(range).toMatch(/^1-50 of 50$/)
  })

  test('navigate pages after reducing page size', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('order_items')

    // Verify initial state shows all 50 rows
    const initialRange = await actions.getRecordRange()
    expect(initialRange).toContain('of 50')

    // Open settings popover and reduce the limit to 20 to enable pagination
    const settingsBtn = window.getByTestId('statusbar-settings-btn')
    await settingsBtn.click()

    const limitInput = window.locator('input[type="number"]').first()
    await expect(limitInput).toBeVisible({ timeout: 5_000 })
    await limitInput.fill('20')

    // Click the Apply button inside the popover
    const popoverApplyBtn = window.locator('[role="dialog"] button:has-text("Apply")')
    await popoverApplyBtn.click()
    await window.waitForTimeout(1_000)

    // Now we should see page 1: 1-20 of 50
    const page1Range = await actions.getRecordRange()
    expect(page1Range).toMatch(/^1-20 of 50$/)

    // Navigate to next page
    await actions.goToNextPage()
    const page2Range = await actions.getRecordRange()
    expect(page2Range).toMatch(/^21-40 of 50$/)

    // Navigate to previous page
    await actions.goToPreviousPage()
    const backToPage1Range = await actions.getRecordRange()
    expect(backToPage1Range).toMatch(/^1-20 of 50$/)
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
    // orders has 30 rows, default limit is 100 so all fit on one page
    expect(range).toContain('of 30')
    expect(range).toMatch(/^1-30 of 30$/)

    // Verify next page button is disabled since all rows fit on one page
    const nextBtn = window.getByTestId('statusbar-next-page-btn')
    await expect(nextBtn).toBeDisabled()
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
    // events has 100 rows
    expect(range).toContain('of 100')
    expect(range).toMatch(/^1-100 of 100$/)
  })

  test('navigate pages after reducing page size', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openTable('events')

    // Verify initial state shows all 100 rows on one page
    const initialRange = await actions.getRecordRange()
    expect(initialRange).toContain('of 100')

    // Open settings popover and reduce the limit to 50 to enable pagination
    const settingsBtn = window.getByTestId('statusbar-settings-btn')
    await settingsBtn.click()

    const limitInput = window.locator('input[type="number"]').first()
    await expect(limitInput).toBeVisible({ timeout: 5_000 })
    await limitInput.fill('50')

    // Click the Apply button inside the popover
    const popoverApplyBtn = window.locator('[role="dialog"] button:has-text("Apply")')
    await popoverApplyBtn.click()
    await window.waitForTimeout(1_000)

    // Now we should see page 1: 1-50 of 100
    const page1Range = await actions.getRecordRange()
    expect(page1Range).toMatch(/^1-50 of 100$/)

    // Navigate to next page
    await actions.goToNextPage()
    const page2Range = await actions.getRecordRange()
    expect(page2Range).toMatch(/^51-100 of 100$/)

    // Navigate back to previous page
    await actions.goToPreviousPage()
    const backToPage1Range = await actions.getRecordRange()
    expect(backToPage1Range).toMatch(/^1-50 of 100$/)
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
    // orders collection has 30 documents
    expect(range).toContain('of 30')
    expect(range).toMatch(/^1-30 of 30$/)
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
    // order_items has 50 rows
    expect(range).toContain('of 50')
    expect(range).toMatch(/^1-50 of 50$/)
  })
})
