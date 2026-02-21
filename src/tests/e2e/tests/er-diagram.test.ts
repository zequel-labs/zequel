import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.getByTestId('header-more-menu-btn')
  await trigger.click()
}

const openERDiagram = async (page: Page): Promise<void> => {
  await openMoreMenu(page)
  const btn = page.getByTestId('header-erdiagram-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  await btn.click()
  await expect(page.getByTestId('er-diagram')).toBeVisible({ timeout: 30_000 })
}

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

// ---------------------------------------------------------------------------
// ER Diagram - PostgreSQL
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

  test('open ER diagram and verify nodes are rendered', async () => {
    await connectTo(window, 'postgres')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })

  test('verify multiple table nodes are visible', async () => {
    await connectTo(window, 'postgres')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(1)

    await assertNoErrorToast(window)
  })

  test('verify ER diagram tab appears in tab bar', async () => {
    await connectTo(window, 'postgres')
    await openERDiagram(window)

    const erTab = window.getByTestId('tab-ER Diagram')
    await expect(erTab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('open ER diagram then open a table - both tabs exist', async () => {
    const actions = await connectTo(window, 'postgres')
    await openERDiagram(window)

    // Verify ER diagram tab is present
    const erTab = window.getByTestId('tab-ER Diagram')
    await expect(erTab).toBeVisible({ timeout: 5_000 })

    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Both tabs should exist in the tab bar
    await expect(erTab).toBeVisible()
    const customersTab = window.getByTestId('tab-customers')
    await expect(customersTab).toBeVisible()

    await assertNoErrorToast(window)
  })

  test('close ER diagram tab - verify it is gone', async () => {
    await connectTo(window, 'postgres')
    await openERDiagram(window)

    const erTab = window.getByTestId('tab-ER Diagram')
    await expect(erTab).toBeVisible({ timeout: 5_000 })

    // Close the ER diagram tab by clicking the X button inside it
    const closeBtn = erTab.locator('button')
    await closeBtn.click()

    // The tab should no longer be visible
    await expect(erTab).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ER Diagram - MySQL
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

  test('open ER diagram and verify nodes', async () => {
    await connectTo(window, 'mysql')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })

  test('verify multiple nodes exist', async () => {
    await connectTo(window, 'mysql')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(1)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ER Diagram - MariaDB
// ---------------------------------------------------------------------------
test.describe.serial('ER Diagram - MariaDB', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open ER diagram and verify nodes', async () => {
    await connectTo(window, 'mariadb')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ER Diagram - SQLite
// ---------------------------------------------------------------------------
test.describe.serial('ER Diagram - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open ER diagram and verify nodes', async () => {
    await connectTo(window, 'sqlite')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ER Diagram - DuckDB
// ---------------------------------------------------------------------------
test.describe.serial('ER Diagram - DuckDB', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open ER diagram and verify nodes', async () => {
    await connectTo(window, 'duckdb')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ER Diagram - ClickHouse
// ---------------------------------------------------------------------------
test.describe.serial('ER Diagram - ClickHouse', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open ER diagram and verify nodes', async () => {
    await connectTo(window, 'clickhouse')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ER Diagram - SQL Server
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

  test('open ER diagram and verify nodes', async () => {
    await connectTo(window, 'sqlserver')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })

  test('verify multiple nodes exist', async () => {
    await connectTo(window, 'sqlserver')
    await openERDiagram(window)

    const erDiagram = window.getByTestId('er-diagram')
    const nodes = erDiagram.getByTestId('er-diagram-node')
    await expect(nodes.first()).toBeVisible({ timeout: 15_000 })

    const nodeCount = await nodes.count()
    expect(nodeCount).toBeGreaterThan(1)

    await assertNoErrorToast(window)
  })
})
