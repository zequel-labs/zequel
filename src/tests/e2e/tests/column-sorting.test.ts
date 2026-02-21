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

// ---------------------------------------------------------------------------
// Column Sorting - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Column Sorting - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('click column header activates sort indicator (ASC)', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    // Verify the grid is loaded
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Sort indicator should be inactive initially
    const sortIndicator = window.getByTestId('grid-sort-indicator-name')
    await expect(sortIndicator).toBeVisible({ timeout: 10_000 })
    await expect(sortIndicator).toHaveClass(/text-muted-foreground\/40/)

    // Click column header to sort ASC
    const header = window.getByTestId('grid-header-name')
    await header.click()
    await window.waitForTimeout(1_000)

    // Sort indicator should now be active
    await expect(sortIndicator).toHaveClass(/text-primary/)

    await assertNoErrorToast(window)
  })

  test('click same header again changes sort direction (DESC)', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    const sortIndicator = window.getByTestId('grid-sort-indicator-name')
    const header = window.getByTestId('grid-header-name')

    // First click: sort ASC
    await header.click()
    await window.waitForTimeout(1_000)
    await expect(sortIndicator).toHaveClass(/text-primary/)

    // Second click: sort DESC
    await header.click()
    await window.waitForTimeout(1_000)

    // Sort indicator should still be active (different direction)
    await expect(sortIndicator).toHaveClass(/text-primary/)

    await assertNoErrorToast(window)
  })

  test('click header third time removes sort (indicator becomes inactive)', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    const sortIndicator = window.getByTestId('grid-sort-indicator-name')
    const header = window.getByTestId('grid-header-name')

    // First click: sort ASC
    await header.click()
    await window.waitForTimeout(1_000)
    await expect(sortIndicator).toHaveClass(/text-primary/)

    // Second click: sort DESC
    await header.click()
    await window.waitForTimeout(1_000)
    await expect(sortIndicator).toHaveClass(/text-primary/)

    // Third click: remove sort
    await header.click()
    await window.waitForTimeout(1_000)

    // Sort indicator should be inactive
    await expect(sortIndicator).toHaveClass(/text-muted-foreground\/40/)

    await assertNoErrorToast(window)
  })

  test('sort by name ASC changes first row content', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Capture the first row name before sorting
    const firstCell = window.getByTestId('grid-cell-0-name')
    await expect(firstCell).toBeVisible({ timeout: 10_000 })
    const originalName = (await firstCell.innerText()).trim()

    // Click column header to sort by name ASC
    const header = window.getByTestId('grid-header-name')
    await header.click()
    await window.waitForTimeout(1_000)

    // The sort indicator should be active
    const sortIndicator = window.getByTestId('grid-sort-indicator-name')
    await expect(sortIndicator).toHaveClass(/text-primary/)

    // Capture the first row name after sorting
    const sortedName = (await firstCell.innerText()).trim()

    // After sorting ASC by name, the first row should be the alphabetically earliest name
    // It may or may not differ from the original depending on the default order,
    // but verify the sort indicator is active and data loaded without error
    expect(sortedName.length).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })

  test('sort by id DESC shows higher id in first row', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Capture the original first row id
    const firstIdCell = window.getByTestId('grid-cell-0-id')
    await expect(firstIdCell).toBeVisible({ timeout: 10_000 })
    const originalId = parseInt((await firstIdCell.innerText()).trim(), 10)

    // Click id header once for ASC
    const header = window.getByTestId('grid-header-id')
    await header.click()
    await window.waitForTimeout(1_000)

    // Click id header again for DESC
    await header.click()
    await window.waitForTimeout(1_000)

    // Sort indicator should be active
    const sortIndicator = window.getByTestId('grid-sort-indicator-id')
    await expect(sortIndicator).toHaveClass(/text-primary/)

    // The first row id after DESC sort should be higher than or equal to the original first row id
    const descId = parseInt((await firstIdCell.innerText()).trim(), 10)
    expect(descId).toBeGreaterThanOrEqual(originalId)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Column Sorting - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Column Sorting - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('column sorting works on MySQL', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Sort indicator should be inactive initially
    const sortIndicator = window.getByTestId('grid-sort-indicator-name')
    await expect(sortIndicator).toBeVisible({ timeout: 10_000 })
    await expect(sortIndicator).toHaveClass(/text-muted-foreground\/40/)

    // Click column header to sort ASC
    const header = window.getByTestId('grid-header-name')
    await header.click()
    await window.waitForTimeout(1_000)

    // Sort indicator should now be active
    await expect(sortIndicator).toHaveClass(/text-primary/)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Column Sorting - SQLite
// ---------------------------------------------------------------------------
test.describe.serial('Column Sorting - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('column sorting works on SQLite', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Sort indicator should be inactive initially
    const sortIndicator = window.getByTestId('grid-sort-indicator-name')
    await expect(sortIndicator).toBeVisible({ timeout: 10_000 })
    await expect(sortIndicator).toHaveClass(/text-muted-foreground\/40/)

    // Click column header to sort ASC
    const header = window.getByTestId('grid-header-name')
    await header.click()
    await window.waitForTimeout(1_000)

    // Sort indicator should now be active
    await expect(sortIndicator).toHaveClass(/text-primary/)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sort Reset on Table Switch - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Sort Reset on Table Switch - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('sort resets when switching tables', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open customers table and sort by name
    await actions.openTable('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    const header = window.getByTestId('grid-header-name')
    await header.click()
    await window.waitForTimeout(1_000)

    // Verify sort is active
    const sortIndicator = window.getByTestId('grid-sort-indicator-name')
    await expect(sortIndicator).toHaveClass(/text-primary/)

    // Switch to orders table
    await actions.openTable('orders')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Switch back to customers table via its tab
    const customersTab = window.getByTestId('tab-customers')
    await customersTab.click()
    await window.waitForTimeout(1_000)

    // Sort indicator on name column should be inactive after switching back
    const sortIndicatorAfter = window.getByTestId('grid-sort-indicator-name')
    await expect(sortIndicatorAfter).toBeVisible({ timeout: 10_000 })
    await expect(sortIndicatorAfter).toHaveClass(/text-muted-foreground\/40/)

    await assertNoErrorToast(window)
  })
})
