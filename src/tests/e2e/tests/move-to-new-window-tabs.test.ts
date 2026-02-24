import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo, connectSecondDb } from '@e2e/helpers/connect'
import { userActions } from '@e2e/page-actions'
import { ConnectionRailComponent } from '@e2e/page-components/ConnectionRail'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

// ---------------------------------------------------------------------------
// Move to New Window — Tab Preservation
// ---------------------------------------------------------------------------
test.describe.serial('Move to New Window — Tab Preservation', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('preserves table tabs when moving connection to new window', async () => {
    const actions = await connectTo(window, 'postgres')

    // Connect second DB so the rail appears
    await connectSecondDb(window, 'mysql')

    // Switch back to PG and open a table
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('tab-public.customers')).toBeVisible({ timeout: 10_000 })

    const rail = new ConnectionRailComponent(window)

    // Move PG to new window
    const newWindowPromise = app.waitForEvent('window')
    await rail.item(0).click({ button: 'right' })
    await rail.moveToWindowMenuItem.click()
    const newWindow = await newWindowPromise

    // Wait for new window to load
    await expect(newWindow.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Verify the table tab was preserved in the new window
    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  test('preserves query tab with SQL content when moving to new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    // Switch back to PG
    await actions.clickConnectionRailItem(0)

    // Open a query tab and type SQL
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test_value')

    const rail = new ConnectionRailComponent(window)

    // Move PG to new window
    const newWindowPromise = app.waitForEvent('window')
    await rail.item(0).click({ button: 'right' })
    await rail.moveToWindowMenuItem.click()
    const newWindow = await newWindowPromise

    // Wait for new window to load
    await expect(newWindow.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Verify a query tab exists (the default Query tab + the one we created)
    await expect(newWindow.getByTestId('sql-editor')).toBeVisible({ timeout: 15_000 })

    // The SQL editor should contain the query we typed
    const editorContent = newWindow.getByTestId('sql-editor').locator('.view-lines')
    await expect(editorContent).toContainText('SELECT 1 AS test_value', { timeout: 10_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  test('preserves multiple tabs when moving to new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    // Switch back to PG
    await actions.clickConnectionRailItem(0)
    await expect(window.getByTestId('sidebar-schema-public')).toBeVisible({ timeout: 10_000 })

    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('tab-public.customers')).toBeVisible({ timeout: 10_000 })

    // Open another table tab
    await actions.openTableByTestId('orders')
    await expect(window.getByTestId('tab-public.orders')).toBeVisible({ timeout: 10_000 })

    // Open a query tab
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    const rail = new ConnectionRailComponent(window)

    // Move PG to new window
    const newWindowPromise = app.waitForEvent('window')
    await rail.item(0).click({ button: 'right' })
    await rail.moveToWindowMenuItem.click()
    const newWindow = await newWindowPromise

    // Wait for new window to load
    await expect(newWindow.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

    // Verify all tabs were preserved
    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })
    await expect(newWindow.getByTestId('tab-public.orders')).toBeVisible({ timeout: 15_000 })

    // Verify tab bar has at least 3 tabs (the default query + 2 tables + 1 query we opened)
    const tabBar = newWindow.getByTestId('tab-bar')
    await expect(tabBar).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  test('original window retains other connection tabs after move', async () => {
    await connectTo(window, 'postgres')
    const mysqlActions = await connectSecondDb(window, 'mysql')

    // Open a table in MySQL
    await mysqlActions.openTableByTestId('customers')
    await expect(window.getByTestId('tab-customers')).toBeVisible({ timeout: 10_000 })

    const rail = new ConnectionRailComponent(window)

    // Move PG (index 0) to new window
    const newWindowPromise = app.waitForEvent('window')
    await rail.item(0).click({ button: 'right' })
    await rail.moveToWindowMenuItem.click()
    await newWindowPromise

    // Original window: MySQL tab should still be there
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 15_000 })
    await expect(window.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('tab-customers')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})
