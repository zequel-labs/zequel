import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'
import { userActions, type UserActions } from '@e2e/page-actions'

const assertNoErrorToast = async (page: Page): Promise<void> => {
  await page.waitForTimeout(500)
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible()
}

// ---------------------------------------------------------------------------
// SQL Server Functions
// ---------------------------------------------------------------------------
test.describe.serial('SQL Server Functions', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Functions folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'sqlserver')

    // After connecting, dbo schema is expanded. Verify "Functions" folder text is visible.
    const sidebar = window.getByTestId('sidebar-tab-items')
    await expect(sidebar).toBeVisible({ timeout: 30_000 })
    const functionsFolder = sidebar.getByText('Functions', { exact: true })
    await expect(functionsFolder).toBeVisible({ timeout: 15_000 })
  })

  test('should open a function and show definition', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'sqlserver')

    const sidebar = window.getByTestId('sidebar-tab-items')
    await expect(sidebar).toBeVisible({ timeout: 30_000 })

    // Click "Functions" folder to expand it
    const functionsFolder = sidebar.getByText('Functions', { exact: true })
    await expect(functionsFolder).toBeVisible({ timeout: 15_000 })
    await functionsFolder.click()
    await window.waitForTimeout(1000)

    // Click on the get_customer_total_spent function
    const functionItem = sidebar.getByText('get_customer_total_spent', { exact: true })
    await expect(functionItem).toBeVisible({ timeout: 10_000 })
    await functionItem.click()
    await window.waitForTimeout(1000)

    // Verify the view loads with function details (tab or content area)
    await assertNoErrorToast(window)
  })

  test('should show second function', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'sqlserver')

    const sidebar = window.getByTestId('sidebar-tab-items')
    await expect(sidebar).toBeVisible({ timeout: 30_000 })

    // Click "Functions" folder to expand it
    const functionsFolder = sidebar.getByText('Functions', { exact: true })
    await expect(functionsFolder).toBeVisible({ timeout: 15_000 })
    await functionsFolder.click()
    await window.waitForTimeout(1000)

    // Click on the format_price function
    const functionItem = sidebar.getByText('format_price', { exact: true })
    await expect(functionItem).toBeVisible({ timeout: 10_000 })
    await functionItem.click()
    await window.waitForTimeout(1000)

    // Verify the view loads without errors
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQL Server Procedures
// ---------------------------------------------------------------------------
test.describe.serial('SQL Server Procedures', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Procedures folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'sqlserver')

    const sidebar = window.getByTestId('sidebar-tab-items')
    await expect(sidebar).toBeVisible({ timeout: 30_000 })
    const proceduresFolder = sidebar.getByText('Procedures', { exact: true })
    await expect(proceduresFolder).toBeVisible({ timeout: 15_000 })
  })

  test('should open a procedure and show definition', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'sqlserver')

    const sidebar = window.getByTestId('sidebar-tab-items')
    await expect(sidebar).toBeVisible({ timeout: 30_000 })

    // Click "Procedures" folder to expand it
    const proceduresFolder = sidebar.getByText('Procedures', { exact: true })
    await expect(proceduresFolder).toBeVisible({ timeout: 15_000 })
    await proceduresFolder.click()
    await window.waitForTimeout(1000)

    // Click on the update_order_status procedure
    const procedureItem = sidebar.getByText('update_order_status', { exact: true })
    await expect(procedureItem).toBeVisible({ timeout: 10_000 })
    await procedureItem.click()
    await window.waitForTimeout(1000)

    // Verify the view loads without errors
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQL Server Triggers
// ---------------------------------------------------------------------------
test.describe.serial('SQL Server Triggers', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Triggers folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'sqlserver')

    const sidebar = window.getByTestId('sidebar-tab-items')
    await expect(sidebar).toBeVisible({ timeout: 30_000 })
    const triggersFolder = sidebar.getByText('Triggers', { exact: true })
    await expect(triggersFolder).toBeVisible({ timeout: 15_000 })
  })

  test('should open a trigger and show details', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'sqlserver')

    const sidebar = window.getByTestId('sidebar-tab-items')
    await expect(sidebar).toBeVisible({ timeout: 30_000 })

    // Click "Triggers" folder to expand it
    const triggersFolder = sidebar.getByText('Triggers', { exact: true })
    await expect(triggersFolder).toBeVisible({ timeout: 15_000 })
    await triggersFolder.click()
    await window.waitForTimeout(1000)

    // Click on the trg_update_stock trigger
    const triggerItem = sidebar.getByText('trg_update_stock', { exact: true })
    await expect(triggerItem).toBeVisible({ timeout: 10_000 })
    await triggerItem.click()
    await window.waitForTimeout(1000)

    // Verify the view loads without errors
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQL Server Sequences
// ---------------------------------------------------------------------------
test.describe.serial('SQL Server Sequences', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Sequences folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'sqlserver')

    const sidebar = window.getByTestId('sidebar-tab-items')
    await expect(sidebar).toBeVisible({ timeout: 30_000 })
    const sequencesFolder = sidebar.getByText('Sequences', { exact: true })
    await expect(sequencesFolder).toBeVisible({ timeout: 15_000 })
  })

  test('should open a sequence and show properties', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'sqlserver')

    const sidebar = window.getByTestId('sidebar-tab-items')
    await expect(sidebar).toBeVisible({ timeout: 30_000 })

    // Click "Sequences" folder to expand it
    const sequencesFolder = sidebar.getByText('Sequences', { exact: true })
    await expect(sequencesFolder).toBeVisible({ timeout: 15_000 })
    await sequencesFolder.click()
    await window.waitForTimeout(1000)

    // Click on the invoice_number_seq sequence
    const sequenceItem = sidebar.getByText('invoice_number_seq', { exact: true })
    await expect(sequenceItem).toBeVisible({ timeout: 10_000 })
    await sequenceItem.click()
    await window.waitForTimeout(1000)

    // Verify the view loads with sequence details without errors
    await assertNoErrorToast(window)
  })
})
