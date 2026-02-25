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

const runQueryAndWaitForResult = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('query-run-btn')
  await btn.click()
  await expect(page.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
}

// ---------------------------------------------------------------------------
// Privacy Mode - Toggle (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Privacy Mode - Toggle (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('privacy mode button is visible', async () => {
    await connectTo(window, 'postgres')

    const btn = window.getByTestId('header-privacy-btn')
    await expect(btn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('default state is OFF (privacy-icon-off visible)', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure privacy mode is OFF first (in case localStorage persisted)
    await actions.disablePrivacyMode()

    const offIcon = window.getByTestId('privacy-icon-off')
    await expect(offIcon).toBeVisible()

    // On icon should NOT be visible
    const onIcon = window.getByTestId('privacy-icon-on')
    await expect(onIcon).not.toBeVisible()

    await assertNoErrorToast(window)
  })

  test('clicking toggle switches to ON (privacy-icon-on visible)', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.enablePrivacyMode()

    // On icon (eye-off) should be visible
    const onIcon = window.getByTestId('privacy-icon-on')
    await expect(onIcon).toBeVisible()

    // Off icon should NOT be visible
    const offIcon = window.getByTestId('privacy-icon-off')
    await expect(offIcon).not.toBeVisible()

    await assertNoErrorToast(window)
  })

  test('clicking toggle again switches back to OFF (privacy-icon-off visible)', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable then disable
    await actions.enablePrivacyMode()
    const onIcon = window.getByTestId('privacy-icon-on')
    await expect(onIcon).toBeVisible()

    await actions.disablePrivacyMode()
    const offIcon = window.getByTestId('privacy-icon-off')
    await expect(offIcon).toBeVisible()

    // On icon should NOT be visible
    await expect(onIcon).not.toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Privacy Mode - Grid Data Blur (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Privacy Mode - Grid Data Blur (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('cell text is visible with no blur when privacy mode is off', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure privacy mode is OFF
    await actions.disablePrivacyMode()

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Grid cells should NOT have blur-sm class
    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })

  test('enabling privacy mode applies blur-sm to cells', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table first
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Enable privacy mode
    await actions.enablePrivacyMode()

    // Grid cells should have blur-sm class
    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('disabling privacy mode removes blur from cells', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Enable privacy mode
    await actions.enablePrivacyMode()

    // Verify blur is applied
    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    // Disable privacy mode
    await actions.disablePrivacyMode()

    // Blur should be removed
    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Privacy Mode - Grid Data Blur (MySQL)
// ---------------------------------------------------------------------------
test.describe.serial('Privacy Mode - Grid Data Blur (MySQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('cell text is visible with no blur when privacy mode is off', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.disablePrivacyMode()

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })

  test('enabling privacy mode applies blur-sm to cells', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.enablePrivacyMode()

    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('disabling privacy mode removes blur from cells', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.enablePrivacyMode()

    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    await actions.disablePrivacyMode()

    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Privacy Mode - Grid Data Blur (SQLite)
// ---------------------------------------------------------------------------
test.describe.serial('Privacy Mode - Grid Data Blur (SQLite)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('cell text is visible with no blur when privacy mode is off', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.disablePrivacyMode()

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })

  test('enabling privacy mode applies blur-sm to cells', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.enablePrivacyMode()

    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('disabling privacy mode removes blur from cells', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.enablePrivacyMode()

    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    await actions.disablePrivacyMode()

    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Privacy Mode - Grid Data Blur (SQL Server)
// ---------------------------------------------------------------------------
test.describe.serial('Privacy Mode - Grid Data Blur (SQL Server)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('cell text is visible with no blur when privacy mode is off', async () => {
    const actions = await connectTo(window, 'sqlserver')

    await actions.disablePrivacyMode()

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })

  test('enabling privacy mode applies blur-sm to cells', async () => {
    const actions = await connectTo(window, 'sqlserver')

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.enablePrivacyMode()

    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('disabling privacy mode removes blur from cells', async () => {
    const actions = await connectTo(window, 'sqlserver')

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.enablePrivacyMode()

    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    await actions.disablePrivacyMode()

    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Privacy Mode - Query Results (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Privacy Mode - Query Results (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query results are visible when privacy mode is off', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure privacy mode is OFF
    await actions.disablePrivacyMode()

    // Open query editor and run a SELECT
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await runQueryAndWaitForResult(window)

    // Results should be visible without blur
    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 10_000 })

    // No blurred elements in the query results grid
    const blurredElements = results.locator('.blur-sm')
    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })

  test('enabling privacy mode blurs query result cells', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open query editor and run a SELECT
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await runQueryAndWaitForResult(window)

    // Enable privacy mode
    await actions.enablePrivacyMode()

    // Query result cells should have blur-sm class
    const results = window.getByTestId('query-results')
    const blurredElements = results.locator('.blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('disabling privacy mode removes blur from query result cells', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open query editor and run a SELECT
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await runQueryAndWaitForResult(window)

    // Enable then disable privacy mode
    await actions.enablePrivacyMode()

    const results = window.getByTestId('query-results')
    const blurredElements = results.locator('.blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    await actions.disablePrivacyMode()

    await expect(blurredElements).not.toBeVisible({ timeout: 3_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Privacy Mode - Persists Across Tab Switches (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Privacy Mode - Persists Across Tab Switches (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('privacy mode persists when switching between table tabs', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable privacy mode
    await actions.enablePrivacyMode()

    // Open table A (customers)
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify blur is applied on table A
    const blurredElements = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElements.first()).toBeVisible({ timeout: 5_000 })

    // Open table B (products)
    await actions.openTableByTestId('products')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify blur is applied on table B
    const blurredElementsB = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElementsB.first()).toBeVisible({ timeout: 5_000 })

    // Switch back to table A via tab bar
    const tabA = window.getByTestId('tab-public.customers')
    await tabA.click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify blur is still applied on table A
    const blurredElementsA = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredElementsA.first()).toBeVisible({ timeout: 5_000 })

    // Privacy icon should still show ON
    await expect(window.getByTestId('privacy-icon-on')).toBeVisible()

    await assertNoErrorToast(window)
  })

  test('privacy mode persists when switching between table and query tabs', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable privacy mode
    await actions.enablePrivacyMode()

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify blur on table grid
    const blurredTable = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredTable.first()).toBeVisible({ timeout: 5_000 })

    // Open query editor and run a query
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await runQueryAndWaitForResult(window)

    // Verify blur on query results
    const results = window.getByTestId('query-results')
    const blurredQuery = results.locator('.blur-sm')
    await expect(blurredQuery.first()).toBeVisible({ timeout: 5_000 })

    // Switch back to table tab
    const tabCustomers = window.getByTestId('tab-public.customers')
    await tabCustomers.click()
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Blur should still be applied
    const blurredTableAgain = window.locator('[data-testid^="grid-cell-"] .blur-sm')
    await expect(blurredTableAgain.first()).toBeVisible({ timeout: 5_000 })

    // Privacy icon should still show ON
    await expect(window.getByTestId('privacy-icon-on')).toBeVisible()

    await assertNoErrorToast(window)
  })
})
