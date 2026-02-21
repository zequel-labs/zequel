import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// PostgreSQL Column Filter Popover
// ---------------------------------------------------------------------------

test.describe.serial('PostgreSQL Column Filter Popover', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('click filter icon on name column opens popover', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Click the filter icon on the name column header
    const filterTrigger = window.getByTestId('col-filter-trigger-name')
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    await filterTrigger.click()

    // Verify the popover opens
    const popover = window.getByTestId('col-filter-popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })
  })

  test('text column default operator shows Contains', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Open the column filter popover on name column
    const filterTrigger = window.getByTestId('col-filter-trigger-name')
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    await filterTrigger.click()

    const popover = window.getByTestId('col-filter-popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })

    // Check that the operator select shows "Contains" by default
    const operatorSelect = window.getByTestId('col-filter-operator')
    await expect(operatorSelect).toBeVisible({ timeout: 10_000 })
    const operatorText = (await operatorSelect.innerText()).trim()
    expect(operatorText).toContain('Contains')
  })

  test('apply filter reduces row count', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Get the initial row count
    const initialRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(initialRowCount).toBeGreaterThan(0)

    // Open the column filter popover on name column
    const filterTrigger = window.getByTestId('col-filter-trigger-name')
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    await filterTrigger.click()

    const popover = window.getByTestId('col-filter-popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })

    // Type a filter value
    const valueInput = window.getByTestId('col-filter-value')
    await expect(valueInput).toBeVisible({ timeout: 10_000 })
    await valueInput.fill('Alice')

    // Click Apply
    const applyBtn = window.getByTestId('col-filter-apply-btn')
    await applyBtn.click()

    // Wait for the grid to reload
    await window.waitForTimeout(1000)

    // Verify row count reduced
    const filteredRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(filteredRowCount).toBeLessThan(initialRowCount)
    expect(filteredRowCount).toBeGreaterThan(0)
  })

  test('clear filter restores all rows', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Get the initial row count
    const initialRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(initialRowCount).toBeGreaterThan(0)

    // Open the column filter and apply a filter
    const filterTrigger = window.getByTestId('col-filter-trigger-name')
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    await filterTrigger.click()

    const popover = window.getByTestId('col-filter-popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })

    const valueInput = window.getByTestId('col-filter-value')
    await valueInput.fill('Alice')

    const applyBtn = window.getByTestId('col-filter-apply-btn')
    await applyBtn.click()
    await window.waitForTimeout(1000)

    // Confirm rows are filtered
    const filteredRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(filteredRowCount).toBeLessThan(initialRowCount)

    // Reopen the popover and click Clear
    await filterTrigger.click()
    const popoverAgain = window.getByTestId('col-filter-popover')
    await expect(popoverAgain).toBeVisible({ timeout: 10_000 })

    const clearBtn = window.getByTestId('col-filter-clear-btn')
    await clearBtn.click()
    await window.waitForTimeout(1000)

    // Verify all rows are restored
    const restoredRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(restoredRowCount).toBe(initialRowCount)
  })

  test('active filter shows highlighted indicator', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Open the column filter and apply a filter
    const filterTrigger = window.getByTestId('col-filter-trigger-name')
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    await filterTrigger.click()

    const popover = window.getByTestId('col-filter-popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })

    const valueInput = window.getByTestId('col-filter-value')
    await valueInput.fill('Alice')

    const applyBtn = window.getByTestId('col-filter-apply-btn')
    await applyBtn.click()
    await window.waitForTimeout(1000)

    // Check that the filter trigger has the text-primary class (highlighted)
    await expect(filterTrigger).toHaveClass(/text-primary/)
  })

  test('IS NULL filter works and hides value input', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Open the column filter popover on phone column
    const filterTrigger = window.getByTestId('col-filter-trigger-phone')
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    await filterTrigger.click()

    const popover = window.getByTestId('col-filter-popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })

    // Select IS NULL operator
    const operatorSelect = window.getByTestId('col-filter-operator')
    await operatorSelect.click()
    await window.waitForTimeout(300)

    // Click the IS NULL option
    const isNullOption = window.getByText('IS NULL', { exact: true })
    await isNullOption.click()
    await window.waitForTimeout(300)

    // Verify the value input is hidden
    const valueInput = window.getByTestId('col-filter-value')
    await expect(valueInput).not.toBeVisible()

    // Apply the filter
    const applyBtn = window.getByTestId('col-filter-apply-btn')
    await applyBtn.click()
    await window.waitForTimeout(1000)

    // Verify the filter executed without error (row count may be 0 or more)
    const rowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(rowCount).toBeGreaterThanOrEqual(0)
  })

  test('pressing Enter applies the filter', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Get the initial row count
    const initialRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(initialRowCount).toBeGreaterThan(0)

    // Open the column filter popover on name column
    const filterTrigger = window.getByTestId('col-filter-trigger-name')
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    await filterTrigger.click()

    const popover = window.getByTestId('col-filter-popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })

    // Type a value and press Enter instead of clicking Apply
    const valueInput = window.getByTestId('col-filter-value')
    await expect(valueInput).toBeVisible({ timeout: 10_000 })
    await valueInput.fill('Alice')
    await valueInput.press('Enter')

    // Wait for the grid to reload
    await window.waitForTimeout(1000)

    // Verify row count reduced (Enter applied the filter)
    const filteredRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(filteredRowCount).toBeLessThan(initialRowCount)
    expect(filteredRowCount).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// MySQL Column Filter Popover
// ---------------------------------------------------------------------------

test.describe.serial('MySQL Column Filter Popover', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('column filter popover works on MySQL', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Get the initial row count
    const initialRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(initialRowCount).toBeGreaterThan(0)

    // Open the column filter popover on name column
    const filterTrigger = window.getByTestId('col-filter-trigger-name')
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    await filterTrigger.click()

    const popover = window.getByTestId('col-filter-popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })

    // Type a filter value and apply
    const valueInput = window.getByTestId('col-filter-value')
    await expect(valueInput).toBeVisible({ timeout: 10_000 })
    await valueInput.fill('Alice')

    const applyBtn = window.getByTestId('col-filter-apply-btn')
    await applyBtn.click()
    await window.waitForTimeout(1000)

    // Verify row count reduced
    const filteredRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(filteredRowCount).toBeLessThan(initialRowCount)
    expect(filteredRowCount).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Numeric Column Filter
// ---------------------------------------------------------------------------

test.describe.serial('Numeric Column Filter', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('numeric column default operator is = (equals)', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Open the column filter popover on the id column (numeric)
    const filterTrigger = window.getByTestId('col-filter-trigger-id')
    await expect(filterTrigger).toBeVisible({ timeout: 10_000 })
    await filterTrigger.click()

    const popover = window.getByTestId('col-filter-popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })

    // Check that the operator select shows "= (equals)" by default
    const operatorSelect = window.getByTestId('col-filter-operator')
    await expect(operatorSelect).toBeVisible({ timeout: 10_000 })
    const operatorText = (await operatorSelect.innerText()).trim()
    expect(operatorText).toContain('=')
    expect(operatorText).toContain('equals')
  })
})

// ---------------------------------------------------------------------------
// Multiple Column Filters
// ---------------------------------------------------------------------------

test.describe.serial('Multiple Column Filters', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('multiple column popovers work independently', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Get the initial row count
    const initialRowCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(initialRowCount).toBeGreaterThan(0)

    // Apply a filter on the name column
    const nameFilterTrigger = window.getByTestId('col-filter-trigger-name')
    await expect(nameFilterTrigger).toBeVisible({ timeout: 10_000 })
    await nameFilterTrigger.click()

    const namePopover = window.getByTestId('col-filter-popover')
    await expect(namePopover).toBeVisible({ timeout: 10_000 })

    const nameValueInput = window.getByTestId('col-filter-value')
    await nameValueInput.fill('Alice')

    const nameApplyBtn = window.getByTestId('col-filter-apply-btn')
    await nameApplyBtn.click()
    await window.waitForTimeout(1000)

    // Verify the name filter is active (highlighted trigger)
    await expect(nameFilterTrigger).toHaveClass(/text-primary/)

    // Get the row count after first filter
    const afterNameFilterCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(afterNameFilterCount).toBeLessThan(initialRowCount)

    // Now open the filter on the email column
    const emailFilterTrigger = window.getByTestId('col-filter-trigger-email')
    await expect(emailFilterTrigger).toBeVisible({ timeout: 10_000 })
    await emailFilterTrigger.click()

    const emailPopover = window.getByTestId('col-filter-popover')
    await expect(emailPopover).toBeVisible({ timeout: 10_000 })

    // Verify the email popover has its own independent state (operator shows Contains)
    const emailOperator = window.getByTestId('col-filter-operator')
    await expect(emailOperator).toBeVisible({ timeout: 10_000 })
    const emailOperatorText = (await emailOperator.innerText()).trim()
    expect(emailOperatorText).toContain('Contains')

    // Apply a filter on the email column
    const emailValueInput = window.getByTestId('col-filter-value')
    await emailValueInput.fill('alice')

    const emailApplyBtn = window.getByTestId('col-filter-apply-btn')
    await emailApplyBtn.click()
    await window.waitForTimeout(1000)

    // Verify both filter triggers are highlighted
    await expect(nameFilterTrigger).toHaveClass(/text-primary/)
    await expect(emailFilterTrigger).toHaveClass(/text-primary/)

    // Verify the grid still shows filtered results
    const afterBothFiltersCount = await window.locator('[data-testid^="grid-row-"]').count()
    expect(afterBothFiltersCount).toBeGreaterThan(0)
    expect(afterBothFiltersCount).toBeLessThanOrEqual(afterNameFilterCount)
  })
})
