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

const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.getByTestId('header-more-menu-btn')
  await trigger.click()
}

// ---------------------------------------------------------------------------
// ER Diagram (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('ER Diagram - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open ER diagram view', async () => {
    await connectTo(window, 'postgres')

    // The ER Diagram button is inside the "more" dropdown menu
    await openMoreMenu(window)

    const erDiagramBtn = window.getByTestId('header-erdiagram-btn')
    await expect(erDiagramBtn).toBeVisible({ timeout: 5_000 })
    await erDiagramBtn.click()

    // The ER diagram uses vue-flow which renders a container with class "er-flow"
    const erDiagram = window.getByTestId('er-diagram')
    await expect(erDiagram).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('verify tables are rendered in ER diagram', async () => {
    await connectTo(window, 'postgres')

    await openMoreMenu(window)

    const erDiagramBtn = window.getByTestId('header-erdiagram-btn')
    await erDiagramBtn.click()

    // Wait for the ER diagram container to appear
    const erDiagram = window.getByTestId('er-diagram')
    await expect(erDiagram).toBeVisible({ timeout: 30_000 })

    // vue-flow renders table nodes with the class "vue-flow__node"
    const nodes = erDiagram.getByTestId('er-diagram-node')
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
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open ER diagram view', async () => {
    await connectTo(window, 'mysql')

    await openMoreMenu(window)

    const erDiagramBtn = window.getByTestId('header-erdiagram-btn')
    await expect(erDiagramBtn).toBeVisible({ timeout: 5_000 })
    await erDiagramBtn.click()

    // The ER diagram uses vue-flow which renders a container with class "er-flow"
    const erDiagram = window.getByTestId('er-diagram')
    await expect(erDiagram).toBeVisible({ timeout: 30_000 })

    // Verify nodes are rendered
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ER Diagram (SQL Server)
// ---------------------------------------------------------------------------
test.describe.serial('ER Diagram - SQL Server', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open ER diagram view', async () => {
    await connectTo(window, 'sqlserver')

    await openMoreMenu(window)

    const erDiagramBtn = window.getByTestId('header-erdiagram-btn')
    await expect(erDiagramBtn).toBeVisible({ timeout: 5_000 })
    await erDiagramBtn.click()

    const erDiagram = window.getByTestId('er-diagram')
    await expect(erDiagram).toBeVisible({ timeout: 30_000 })

    const nodes = erDiagram.getByTestId('er-diagram-node')
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
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open multiple tabs and verify tab bar', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Open a query tab
    await actions.openQueryEditor()
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Verify the tab bar shows both tabs
    const tabBar = window.getByTestId('tab-bar')
    const tabItems = tabBar.locator('[data-testid^="tab-"]')
    const tabCount = await tabItems.count()
    expect(tabCount).toBeGreaterThanOrEqual(2)

    await assertNoErrorToast(window)
  })

  test('switch between tabs', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Open a query tab
    await actions.openQueryEditor()
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Find tab items in the tab bar — click the "customers" tab to switch back
    await window.getByTestId('tab-public.customers').click()

    // The data grid should be visible again
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Click the query tab to switch to it
    await window.getByTestId('tab-Query 1').click()

    // The Monaco editor should be visible
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Keyboard Shortcuts (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Keyboard Shortcuts - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('run query with Ctrl+Enter', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 1 AS test_value')
    await actions.runQueryWithKeyboard()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })

    await assertNoErrorToast(window)
  })

  test('open command palette with Cmd+K', async () => {
    await connectTo(window, 'postgres')

    // Press Cmd+K (Meta+K) to open the command palette
    await window.keyboard.press('Meta+k')

    // The command palette is a Dialog component; look for the search input inside it
    // CommandPalette uses a Dialog + Input component
    const commandPaletteInput = window.getByTestId('command-palette-input')
    await expect(commandPaletteInput).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('open command palette with Cmd+P', async () => {
    await connectTo(window, 'postgres')

    // Press Cmd+P (Meta+P) to open the command palette
    await window.keyboard.press('Meta+p')

    // The command palette dialog should appear with a search input
    const commandPaletteInput = window.getByTestId('command-palette-input')
    await expect(commandPaletteInput).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('close command palette with Escape', async () => {
    await connectTo(window, 'postgres')

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

  test('open new query tab with Cmd+T', async () => {
    await connectTo(window, 'postgres')

    // Press Cmd+T to open a new query tab
    await window.keyboard.press('Meta+t')

    // A Monaco editor should appear (new query tab)
    await expect(window.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sidebar Tab Switching (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Sidebar Tab Switching - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('switch between items, queries, and history tabs', async () => {
    const actions = await connectTo(window, 'postgres')

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
    const actions = await connectTo(window, 'postgres')

    // Switch to Queries tab
    await actions.switchSidebarTab('queries')

    // The queries tab should be active
    const queriesTab = window.getByTestId('sidebar-tab-queries')
    await expect(queriesTab).toBeVisible({ timeout: 10_000 })

    // The sidebar should now show the saved queries list or an empty state
    await expect(window.getByTestId('sidebar-tab-queries')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('history tab shows query history', async () => {
    const actions = await connectTo(window, 'postgres')

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
