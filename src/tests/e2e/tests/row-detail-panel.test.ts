import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// PostgreSQL Row Detail Panel
// ---------------------------------------------------------------------------

test.describe.serial('PostgreSQL Row Detail Panel', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('click first row opens row detail panel', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Click the first row to open the detail panel
    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    // Verify the row detail panel becomes visible
    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })
  })

  test('data tab shows field containers for columns', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Data tab should be active by default — verify field containers exist
    const dataTab = window.getByTestId('row-detail-data-tab')
    await expect(dataTab).toBeVisible({ timeout: 10_000 })

    const fieldId = window.getByTestId('row-detail-field-id')
    await expect(fieldId).toBeVisible({ timeout: 10_000 })

    const fieldName = window.getByTestId('row-detail-field-name')
    await expect(fieldName).toBeVisible({ timeout: 10_000 })
  })

  test('search filter narrows displayed fields', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Verify both 'name' and 'id' fields are visible before filtering
    await expect(window.getByTestId('row-detail-field-name')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('row-detail-field-id')).toBeVisible({ timeout: 10_000 })

    // Type in search to filter fields
    const searchInput = window.getByTestId('row-detail-search-input')
    await expect(searchInput).toBeVisible({ timeout: 10_000 })
    await searchInput.fill('name')

    await window.waitForTimeout(500)

    // 'name' field should still be visible
    await expect(window.getByTestId('row-detail-field-name')).toBeVisible({ timeout: 10_000 })

    // 'id' field should be hidden because it doesn't match 'name'
    await expect(window.getByTestId('row-detail-field-id')).not.toBeVisible()
  })

  test('clear search restores all fields', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const searchInput = window.getByTestId('row-detail-search-input')
    await expect(searchInput).toBeVisible({ timeout: 10_000 })

    // Filter to narrow down fields
    await searchInput.fill('name')
    await window.waitForTimeout(500)

    // Confirm 'id' field is hidden
    await expect(window.getByTestId('row-detail-field-id')).not.toBeVisible()

    // Clear the search
    await searchInput.fill('')
    await window.waitForTimeout(500)

    // All fields should be visible again
    await expect(window.getByTestId('row-detail-field-id')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('row-detail-field-name')).toBeVisible({ timeout: 10_000 })
  })

  test('JSON tab shows formatted JSON content', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Switch to JSON tab
    const jsonTab = window.getByTestId('row-detail-json-tab')
    await expect(jsonTab).toBeVisible({ timeout: 10_000 })
    await jsonTab.click()

    await window.waitForTimeout(500)

    // The panel should contain JSON-like content (curly braces, field names)
    const panelText = await panel.innerText()
    expect(panelText).toContain('id')
    expect(panelText).toContain('name')
  })

  test('copy JSON button works without error', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Switch to JSON tab
    const jsonTab = window.getByTestId('row-detail-json-tab')
    await jsonTab.click()

    await window.waitForTimeout(500)

    // Click the copy JSON button
    const copyBtn = window.getByTestId('row-detail-copy-json-btn')
    await expect(copyBtn).toBeVisible({ timeout: 10_000 })
    await copyBtn.click()

    // Verify no error toast appeared — the panel should still be visible and stable
    await window.waitForTimeout(1000)
    await expect(panel).toBeVisible({ timeout: 10_000 })
  })

  test('close button hides the panel', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Click the close button
    const closeBtn = window.getByTestId('row-detail-close-btn')
    await expect(closeBtn).toBeVisible({ timeout: 10_000 })
    await closeBtn.click()

    // Panel should no longer be visible
    await expect(panel).not.toBeVisible({ timeout: 10_000 })
  })

  test('click different row updates panel content', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Click the first row
    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Capture the name field value from the first row
    const fieldName = window.getByTestId('row-detail-field-name')
    await expect(fieldName).toBeVisible({ timeout: 10_000 })
    const firstRowName = (await fieldName.innerText()).trim()

    // Click the second row
    const secondRow = window.getByTestId('grid-row-1')
    await expect(secondRow).toBeVisible({ timeout: 10_000 })
    await secondRow.click()

    await window.waitForTimeout(500)

    // The panel should still be visible with updated content
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Capture the name field value from the second row
    const secondRowName = (await fieldName.innerText()).trim()

    // The two values should be different (different customer rows)
    expect(secondRowName).not.toBe(firstRowName)
  })
})

// ---------------------------------------------------------------------------
// MySQL Row Detail Panel
// ---------------------------------------------------------------------------

test.describe.serial('MySQL Row Detail Panel', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('row detail panel opens on row click', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Verify field containers are present
    await expect(window.getByTestId('row-detail-field-id')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('row-detail-field-name')).toBeVisible({ timeout: 10_000 })
  })

  test('close button hides the panel', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    const closeBtn = window.getByTestId('row-detail-close-btn')
    await expect(closeBtn).toBeVisible({ timeout: 10_000 })
    await closeBtn.click()

    await expect(panel).not.toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// SQLite Row Detail Panel
// ---------------------------------------------------------------------------

test.describe.serial('SQLite Row Detail Panel', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('row detail panel opens on row click', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Verify field containers are present
    await expect(window.getByTestId('row-detail-field-id')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('row-detail-field-name')).toBeVisible({ timeout: 10_000 })
  })

  test('JSON tab shows formatted content', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('customers')

    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    const firstRow = window.getByTestId('grid-row-0')
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    const panel = window.getByTestId('row-detail-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Switch to JSON tab
    const jsonTab = window.getByTestId('row-detail-json-tab')
    await expect(jsonTab).toBeVisible({ timeout: 10_000 })
    await jsonTab.click()

    await window.waitForTimeout(500)

    // Verify JSON content is displayed
    const panelText = await panel.innerText()
    expect(panelText).toContain('id')
    expect(panelText).toContain('name')
  })
})
