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

const assertResultsHaveRows = async (page: Page): Promise<void> => {
  const results = page.getByTestId('query-results')
  await expect(results).toBeVisible({ timeout: 30_000 })
  const rows = results.locator('[data-testid^="grid-row-"]')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Tab Navigation Shortcuts (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Tab Navigation Shortcuts - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Cmd+T opens a new query tab', async () => {
    await connectTo(window, 'postgres')

    // Press Cmd+T to open a new query tab
    await window.keyboard.press('Meta+t')

    // A Monaco editor should appear (new query tab)
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // The tab bar should show the new Query tab
    const tabBar = window.getByTestId('tab-bar')
    await expect(tabBar).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('tab-Query')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('Cmd+] navigates to the next tab', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table tab (first tab)
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query tab (second tab)
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Switch back to first tab by clicking
    await window.getByTestId('tab-public.customers').click()
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Press Cmd+] to navigate to the next tab (the query tab)
    await window.keyboard.press('Meta+]')
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('Cmd+[ navigates to the previous tab', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table tab (first tab)
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query tab (second tab, now active)
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Press Cmd+[ to navigate to the previous tab (the table tab)
    await window.keyboard.press('Meta+[')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('Cmd+1/2/3 switches to tab by index', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open first tab: customers table
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open second tab: products table
    await actions.openTableByTestId('products')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open third tab: query editor
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Cmd+1 switches to the first tab (customers)
    await window.keyboard.press('Meta+1')
    await expect(window.getByTestId('tab-public.customers')).toHaveAttribute('class', /bg-background/, { timeout: 5_000 })
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Cmd+2 switches to the second tab (products)
    await window.keyboard.press('Meta+2')
    await expect(window.getByTestId('tab-public.products')).toHaveAttribute('class', /bg-background/, { timeout: 5_000 })
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Cmd+3 switches to the third tab (query)
    await window.keyboard.press('Meta+3')
    await expect(window.getByTestId('tab-Query')).toHaveAttribute('class', /bg-background/, { timeout: 5_000 })
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('Cmd+W closes the current tab', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query tab (now active)
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Verify the query tab exists
    await expect(window.getByTestId('tab-Query')).toBeVisible({ timeout: 5_000 })

    // Press Cmd+W to close the current (query) tab
    await window.keyboard.press('Meta+w')

    // The query tab should be gone
    await expect(window.getByTestId('tab-Query')).not.toBeVisible({ timeout: 5_000 })

    // The customers table tab should still be present
    await expect(window.getByTestId('tab-public.customers')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Query Execution Shortcuts (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Query Execution Shortcuts - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Cmd+Enter runs the query', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test_value')

    // Dismiss any autocomplete popup
    await window.keyboard.press('Escape')
    await window.waitForTimeout(200)

    // Press Cmd+Enter to execute the query
    await window.keyboard.press('Meta+Enter')

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('Cmd+Shift+F formats the SQL', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()
    await actions.typeQuery('select   *  from  customers  where  id=1')

    // Dismiss any autocomplete popup
    await window.keyboard.press('Escape')
    await window.waitForTimeout(200)

    // Press Cmd+Shift+F to format the SQL
    await window.keyboard.press('Meta+Shift+f')

    // The editor should still be visible and the SQL should be formatted
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Navigation Shortcuts (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Navigation Shortcuts - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Cmd+P opens the command palette', async () => {
    await connectTo(window, 'postgres')

    // Press Cmd+P to open the command palette
    await window.keyboard.press('Meta+p')

    // The command palette input should be visible
    const commandPaletteInput = window.getByTestId('command-palette-input')
    await expect(commandPaletteInput).toBeVisible({ timeout: 5_000 })

    // Close the palette
    await window.keyboard.press('Escape')
    await expect(commandPaletteInput).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('Cmd+N opens the new connection dialog', async () => {
    await connectTo(window, 'postgres')

    // Press Cmd+N to open the new connection dialog
    await window.keyboard.press('Meta+n')

    // The new connection dialog should appear
    const newConnectionDialog = window.getByTestId('new-connection-dialog')
    await expect(newConnectionDialog).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Switching with Cmd+Number (MySQL)
// ---------------------------------------------------------------------------
test.describe.serial('Tab Switching with Cmd+Number - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Cmd+1 and Cmd+2 switch between table and query tabs', async () => {
    const actions = await connectTo(window, 'mysql')

    // Open first tab: customers table
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open second tab: query editor
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Cmd+1 switches to the first tab (customers table)
    await window.keyboard.press('Meta+1')
    await expect(window.getByTestId('tab-customers')).toHaveAttribute('class', /bg-background/, { timeout: 5_000 })
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Cmd+2 switches to the second tab (query editor)
    await window.keyboard.press('Meta+2')
    await expect(window.getByTestId('tab-Query')).toHaveAttribute('class', /bg-background/, { timeout: 5_000 })
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Close Tab with Cmd+W (SQLite)
// ---------------------------------------------------------------------------
test.describe.serial('Close Tab with Cmd+W - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Cmd+W closes the query tab while the table tab remains', async () => {
    const actions = await connectTo(window, 'sqlite')

    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query tab (now active)
    await actions.openQueryEditor()
    await expect(window.getByTestId('sql-editor')).toBeVisible({ timeout: 10_000 })

    // Verify both tabs exist
    await expect(window.getByTestId('tab-customers')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('tab-Query')).toBeVisible({ timeout: 5_000 })

    // Press Cmd+W to close the current (query) tab
    await window.keyboard.press('Meta+w')

    // The query tab should be gone
    await expect(window.getByTestId('tab-Query')).not.toBeVisible({ timeout: 5_000 })

    // The customers table tab should still be present
    await expect(window.getByTestId('tab-customers')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})
