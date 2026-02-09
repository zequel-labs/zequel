import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// PostgreSQL Date Picker
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Date Picker', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit created_at with date picker and apply', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('orders')

    // Double-click a created_at cell to open the date picker
    const cell = window.getByTestId('grid-cell-0-created_at')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    await cell.dblclick()

    // Verify the date picker editor appears
    const editor = window.getByTestId('date-cell-editor')
    await expect(editor).toBeVisible({ timeout: 5_000 })

    // Click "Now" to set current date/time
    const nowBtn = window.getByTestId('date-editor-now')
    await nowBtn.click()
    await window.waitForTimeout(200)

    // Click "Apply"
    const applyBtn = window.getByTestId('date-editor-apply')
    await applyBtn.click()
    await window.waitForTimeout(200)

    // Cell should show modified (yellow background via bg-yellow-500/20 on the td)
    const td = cell
    await expect(td).toHaveClass(/bg-yellow/, { timeout: 5_000 })

    // Apply changes to persist
    await actions.applyChanges()
  })

  test('cancel date picker does not modify cell', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('orders')

    const cell = window.getByTestId('grid-cell-0-created_at')
    await expect(cell).toBeVisible({ timeout: 10_000 })
    const originalText = (await cell.innerText()).trim()

    await cell.dblclick()

    const editor = window.getByTestId('date-cell-editor')
    await expect(editor).toBeVisible({ timeout: 5_000 })

    // Click "Cancel"
    const cancelBtn = window.getByTestId('date-editor-cancel')
    await cancelBtn.click()
    await window.waitForTimeout(200)

    // Editor should be hidden
    await expect(editor).not.toBeVisible()

    // Cell text should remain unchanged
    const afterText = (await cell.innerText()).trim()
    expect(afterText).toBe(originalText)
  })
})

// ---------------------------------------------------------------------------
// MySQL Date Picker
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Date Picker', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit created_at with date picker and apply', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('orders')

    await actions.editDateCell(0, 'created_at')
    await actions.applyChanges()
  })
})

// ---------------------------------------------------------------------------
// MariaDB Date Picker
// ---------------------------------------------------------------------------
test.describe.serial('MariaDB Date Picker', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit created_at with date picker and apply', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openTable('orders')

    await actions.editDateCell(0, 'created_at')
    await actions.applyChanges()
  })
})

// ---------------------------------------------------------------------------
// SQLite — skipped: created_at is declared as TEXT, not TIMESTAMP,
// so the app opens a plain text input instead of the date picker.
// ---------------------------------------------------------------------------
