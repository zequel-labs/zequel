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
// Tab Context Menu - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Tab Context Menu - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('right-click tab shows context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Right-click the customers tab to open the context menu
    await window.getByTestId('tab-public.customers').click({ button: 'right' })

    // Verify the context menu is visible
    const closeItem = window.getByTestId('tab-ctx-close')
    await expect(closeItem).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('close single tab via context menu', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open two tables
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('orders')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify both tabs are visible
    const customersTab = window.getByTestId('tab-public.customers')
    const ordersTab = window.getByTestId('tab-public.orders')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).toBeVisible({ timeout: 5_000 })

    // Right-click the customers tab and click Close
    await customersTab.click({ button: 'right' })
    const closeItem = window.getByTestId('tab-ctx-close')
    await expect(closeItem).toBeVisible({ timeout: 5_000 })
    await closeItem.click()

    // Customers tab should be gone, orders tab should remain
    await expect(customersTab).not.toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('close others closes all except right-clicked tab', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open three tables
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('orders')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('products')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify all three tabs are visible
    const customersTab = window.getByTestId('tab-public.customers')
    const ordersTab = window.getByTestId('tab-public.orders')
    const productsTab = window.getByTestId('tab-public.products')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).toBeVisible({ timeout: 5_000 })
    await expect(productsTab).toBeVisible({ timeout: 5_000 })

    // Right-click the middle tab (orders) and click Close Others
    await ordersTab.click({ button: 'right' })
    const closeOthersItem = window.getByTestId('tab-ctx-close-others')
    await expect(closeOthersItem).toBeVisible({ timeout: 5_000 })
    await closeOthersItem.click()

    // Only orders tab should remain
    await expect(customersTab).not.toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).toBeVisible({ timeout: 5_000 })
    await expect(productsTab).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('close to left closes tabs before the target', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open three tables in order
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('orders')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('products')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify all three tabs are visible
    const customersTab = window.getByTestId('tab-public.customers')
    const ordersTab = window.getByTestId('tab-public.orders')
    const productsTab = window.getByTestId('tab-public.products')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).toBeVisible({ timeout: 5_000 })
    await expect(productsTab).toBeVisible({ timeout: 5_000 })

    // Right-click the last tab (products) and click Close to Left
    await productsTab.click({ button: 'right' })
    const closeLeftItem = window.getByTestId('tab-ctx-close-left')
    await expect(closeLeftItem).toBeVisible({ timeout: 5_000 })
    await closeLeftItem.click()

    // Customers and orders tabs should be gone, products should remain
    await expect(customersTab).not.toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).not.toBeVisible({ timeout: 5_000 })
    await expect(productsTab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('close to right closes tabs after the target', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open three tables in order
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('orders')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('products')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify all three tabs are visible
    const customersTab = window.getByTestId('tab-public.customers')
    const ordersTab = window.getByTestId('tab-public.orders')
    const productsTab = window.getByTestId('tab-public.products')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).toBeVisible({ timeout: 5_000 })
    await expect(productsTab).toBeVisible({ timeout: 5_000 })

    // Right-click the first tab (customers) and click Close to Right
    await customersTab.click({ button: 'right' })
    const closeRightItem = window.getByTestId('tab-ctx-close-right')
    await expect(closeRightItem).toBeVisible({ timeout: 5_000 })
    await closeRightItem.click()

    // Orders and products tabs should be gone, customers should remain
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).not.toBeVisible({ timeout: 5_000 })
    await expect(productsTab).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('close all closes every tab', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open two tables
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('orders')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify both tabs are visible
    const customersTab = window.getByTestId('tab-public.customers')
    const ordersTab = window.getByTestId('tab-public.orders')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).toBeVisible({ timeout: 5_000 })

    // Right-click one tab and click Close All
    await customersTab.click({ button: 'right' })
    const closeAllItem = window.getByTestId('tab-ctx-close-all')
    await expect(closeAllItem).toBeVisible({ timeout: 5_000 })
    await closeAllItem.click()

    // Both tabs should be gone
    await expect(customersTab).not.toBeVisible({ timeout: 5_000 })
    await expect(ordersTab).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('close to left disabled on first tab', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open two tables
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('orders')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Right-click the first tab (customers)
    await window.getByTestId('tab-public.customers').click({ button: 'right' })

    // Close to Left should be disabled on the first tab
    const closeLeftItem = window.getByTestId('tab-ctx-close-left')
    await expect(closeLeftItem).toBeVisible({ timeout: 5_000 })
    await expect(closeLeftItem).toHaveAttribute('data-disabled', '')

    await assertNoErrorToast(window)
  })

  test('close to right disabled on last tab', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open two tables
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await actions.openTableByTestId('orders')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Right-click the last tab (orders)
    await window.getByTestId('tab-public.orders').click({ button: 'right' })

    // Close to Right should be disabled on the last tab
    const closeRightItem = window.getByTestId('tab-ctx-close-right')
    await expect(closeRightItem).toBeVisible({ timeout: 5_000 })
    await expect(closeRightItem).toHaveAttribute('data-disabled', '')

    await assertNoErrorToast(window)
  })

  test('close others disabled when only one tab', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open only one table
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Right-click the only tab
    await window.getByTestId('tab-public.customers').click({ button: 'right' })

    // Close Others should be disabled when there is only one tab
    const closeOthersItem = window.getByTestId('tab-ctx-close-others')
    await expect(closeOthersItem).toBeVisible({ timeout: 5_000 })
    await expect(closeOthersItem).toHaveAttribute('data-disabled', '')

    await assertNoErrorToast(window)
  })

  test('context menu works across multiple tab types', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Open a query editor
    await actions.openQueryEditor()
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify both tabs are visible
    const customersTab = window.getByTestId('tab-public.customers')
    const queryTab = window.getByTestId('tab-Query 1')
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(queryTab).toBeVisible({ timeout: 5_000 })

    // Right-click the table tab and verify context menu works
    await customersTab.click({ button: 'right' })
    const closeItem = window.getByTestId('tab-ctx-close')
    await expect(closeItem).toBeVisible({ timeout: 5_000 })
    const closeOthersItem = window.getByTestId('tab-ctx-close-others')
    await expect(closeOthersItem).toBeVisible({ timeout: 5_000 })
    const closeAllItem = window.getByTestId('tab-ctx-close-all')
    await expect(closeAllItem).toBeVisible({ timeout: 5_000 })

    // Click Close Others to close the query tab and keep the table tab
    await closeOthersItem.click()

    // Table tab should remain, query tab should be gone
    await expect(customersTab).toBeVisible({ timeout: 5_000 })
    await expect(queryTab).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})
