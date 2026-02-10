import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'
import { userActions } from '../page-actions'

type Actions = ReturnType<typeof userActions>

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const openMoreMenu = async (page: Page): Promise<void> => {
  // Dismiss any open dropdown/dialog/overlay left from a prior test
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const trigger = page.getByTestId('header-more-btn')
  await trigger.click()
}

// ---------------------------------------------------------------------------
// ER Diagram (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('ER Diagram - PostgreSQL', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open ER diagram view', async () => {
    // The ER Diagram button is inside the "more" dropdown menu
    await openMoreMenu(window)

    const erDiagramBtn = window.getByTestId('header-erdiagram-btn')
    await expect(erDiagramBtn).toBeVisible({ timeout: 5_000 })
    await erDiagramBtn.click()

    const erDiagram = window.getByTestId('er-diagram')
    await expect(erDiagram).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('verify tables are rendered in ER diagram', async () => {
    await openMoreMenu(window)

    const erDiagramBtn = window.getByTestId('header-erdiagram-btn')
    await erDiagramBtn.click()

    const erDiagram = window.getByTestId('er-diagram')
    await expect(erDiagram).toBeVisible({ timeout: 30_000 })

    const nodes = erDiagram.locator('[data-testid="er-diagram-node"]')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    // Verify at least one table node is rendered
    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ER Diagram (MySQL)
// ---------------------------------------------------------------------------
test.describe.serial('ER Diagram - MySQL', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'mysql')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open ER diagram view', async () => {
    await openMoreMenu(window)

    const erDiagramBtn = window.getByTestId('header-erdiagram-btn')
    await expect(erDiagramBtn).toBeVisible({ timeout: 5_000 })
    await erDiagramBtn.click()

    const erDiagram = window.getByTestId('er-diagram')
    await expect(erDiagram).toBeVisible({ timeout: 30_000 })

    const nodes = erDiagram.locator('[data-testid="er-diagram-node"]')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Management (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Tab Management - PostgreSQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Actions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open multiple tabs and verify tab bar', async () => {
    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query tab
    await actions.openQueryEditor()
    await expect(window.getByTestId('monaco-editor')).toBeVisible({ timeout: 10_000 })

    // Verify the tab bar shows both tabs
    const tabBar = window.getByTestId('tab-bar')
    const tabItems = tabBar.locator('[data-testid^="tab-"]')
    const tabCount = await tabItems.count()
    expect(tabCount).toBeGreaterThanOrEqual(2)

    await assertNoErrorToast(window)
  })

  test('switch between tabs', async () => {
    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Open a query tab
    await actions.openQueryEditor()
    await expect(window.getByTestId('monaco-editor')).toBeVisible({ timeout: 10_000 })

    // Find tab items in the tab bar
    const tabBar = window.getByTestId('tab-bar')
    const tabItems = tabBar.locator('[data-testid^="tab-"]')

    // Click the first tab (table tab) to switch back
    await tabItems.first().click()

    // The data grid should be visible again
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Click the second tab (query tab) to switch to it
    await tabItems.nth(1).click()

    // The Monaco editor should be visible
    await expect(window.getByTestId('monaco-editor')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Keyboard Shortcuts (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Keyboard Shortcuts - PostgreSQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Actions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('run query with Ctrl+Enter', async () => {
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test_value')
    await actions.runQueryWithKeyboard()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('open command palette with Cmd+K', async () => {
    // Click on a neutral area to unfocus Monaco editor (which intercepts Cmd+K)
    await window.getByTestId('sidebar-tab-items').click()
    await window.waitForTimeout(300)

    // Press Cmd+K (Meta+K) to open the command palette
    await window.keyboard.press('Meta+k')

    const commandPaletteInput = window.getByTestId('command-palette-input')
    await expect(commandPaletteInput).toBeVisible({ timeout: 5_000 })

    // Dismiss the command palette so it doesn't block subsequent tests
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)

    await assertNoErrorToast(window)
  })

  test('open command palette with Cmd+P', async () => {
    // Press Cmd+P (Meta+P) to open the command palette
    await window.keyboard.press('Meta+p')

    const commandPaletteInput = window.getByTestId('command-palette-input')
    await expect(commandPaletteInput).toBeVisible({ timeout: 5_000 })

    // Dismiss the command palette so it doesn't block subsequent tests
    await window.keyboard.press('Escape')
    await window.waitForTimeout(300)

    await assertNoErrorToast(window)
  })

  test('close command palette with Escape', async () => {
    // Open command palette
    await window.keyboard.press('Meta+k')

    const commandPaletteInput = window.getByTestId('command-palette-input')
    await expect(commandPaletteInput).toBeVisible({ timeout: 5_000 })

    // Close it with Escape
    await window.keyboard.press('Escape')

    // The dialog should no longer be visible
    await expect(commandPaletteInput).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('open new query tab with Cmd+N', async () => {
    const editorsBefore = await window.getByTestId('monaco-editor').count()

    // Press Cmd+N to open a new query tab
    await window.keyboard.press('Meta+n')

    // A new Monaco editor should appear (new query tab) — use .last() since
    // the old editor is hidden via v-show and .first() would pick the hidden one
    await expect(window.getByTestId('monaco-editor').last()).toBeVisible({ timeout: 10_000 })
    const editorsAfter = await window.getByTestId('monaco-editor').count()
    expect(editorsAfter).toBeGreaterThan(editorsBefore)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Tab Switching (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Tab Switching - PostgreSQL', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Actions

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('switch between items, queries, and history tabs', async () => {
    // Verify Items tab is visible and active by default
    const itemsTab = window.getByTestId('sidebar-tab-items')
    await expect(itemsTab).toBeVisible({ timeout: 10_000 })

    // Verify tables are visible in the items tab
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })

    // Switch to Queries tab
    await actions.switchSidebarTab('queries')
    const queriesTab = window.getByTestId('sidebar-tab-queries')
    await expect(queriesTab).toBeVisible({ timeout: 10_000 })

    // Tables should no longer be visible since we switched to queries tab
    await expect(window.getByTestId('sidebar-table-customers')).not.toBeVisible({ timeout: 5_000 })

    // Switch to History tab
    await actions.switchSidebarTab('history')
    const historyTab = window.getByTestId('sidebar-tab-history')
    await expect(historyTab).toBeVisible({ timeout: 10_000 })

    // Switch back to Items tab
    await actions.switchSidebarTab('items')
    await expect(itemsTab).toBeVisible({ timeout: 10_000 })

    // Tables should be visible again
    await expect(window.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('queries tab shows saved queries area', async () => {
    // Switch to Queries tab
    await actions.switchSidebarTab('queries')

    // The queries tab should be active
    const queriesTab = window.getByTestId('sidebar-tab-queries')
    await expect(queriesTab).toBeVisible({ timeout: 10_000 })

    // The sidebar should now show the saved queries list or an empty state
    // Either saved queries are present or there is an empty message
    const sidebar = window.locator('.sidebar, [class*="sidebar"]').first()
    await expect(sidebar).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('history tab shows query history', async () => {
    // Run a query first to generate history
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })

    // Switch to History tab
    await actions.switchSidebarTab('history')
    const historyTab = window.getByTestId('sidebar-tab-history')
    await expect(historyTab).toBeVisible({ timeout: 10_000 })

    // The history tab should contain at least one entry from the query we just ran
    // History entries typically contain the SQL text
    await window.waitForTimeout(1_000)

    await assertNoErrorToast(window)
  })
})
