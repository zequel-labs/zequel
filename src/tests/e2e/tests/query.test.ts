import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const assertResultsHaveRows = async (page: Page): Promise<void> => {
  const results = page.getByTestId('query-results')
  await expect(results).toBeVisible({ timeout: 30_000 })
  // Verify the results container has at least one row
  const rows = results.locator('tr')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// PostgreSQL Query
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('run SELECT query', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM customers LIMIT 5')
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('run query with keyboard shortcut', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT COUNT(*) FROM products')
    await actions.runQueryWithKeyboard()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('format query', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()
    await actions.typeQuery("select   *  from  customers  where  country='USA'")
    await actions.formatQuery()

    await assertNoErrorToast(window)
    await expect(window.locator('.monaco-editor')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// MySQL Query
// ---------------------------------------------------------------------------
test.describe('MySQL Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('run SELECT query', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()
    await actions.typeQuery("SELECT * FROM orders WHERE status = 'completed' LIMIT 10")
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('run query with keyboard shortcut', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT COUNT(*) FROM products')
    await actions.runQueryWithKeyboard()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('format query', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()
    await actions.typeQuery("select   *  from  customers  where  country='USA'")
    await actions.formatQuery()

    await assertNoErrorToast(window)
    await expect(window.locator('.monaco-editor')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// MariaDB Query
// ---------------------------------------------------------------------------
test.describe('MariaDB Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('run SELECT query', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT name, price FROM products ORDER BY price DESC LIMIT 5')
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('run aggregate query', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT country, COUNT(*) as cnt FROM customers GROUP BY country')
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('format query', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openQueryEditor()
    await actions.typeQuery("select   *  from  products  where  price>50")
    await actions.formatQuery()

    await assertNoErrorToast(window)
    await expect(window.locator('.monaco-editor')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// SQLite Query
// ---------------------------------------------------------------------------
test.describe('SQLite Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('run SELECT query', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM products WHERE price < 50')
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('run JOIN query', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'SELECT o.id, c.name FROM orders o JOIN customers c ON o.customer_id = c.id LIMIT 5'
    )
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('format query', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()
    await actions.typeQuery("select   *  from  products  where  price<50")
    await actions.formatQuery()

    await assertNoErrorToast(window)
    await expect(window.locator('.monaco-editor')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// DuckDB Query
// ---------------------------------------------------------------------------
test.describe('DuckDB Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('run SELECT query', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM products WHERE price < 50')
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('run JOIN query', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'SELECT o.id, u.username FROM orders o JOIN users u ON o.user_id = u.id LIMIT 5'
    )
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('format query', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openQueryEditor()
    await actions.typeQuery("select   *  from  products  where  price<50")
    await actions.formatQuery()

    await assertNoErrorToast(window)
    await expect(window.locator('.monaco-editor')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Query
// ---------------------------------------------------------------------------
test.describe('ClickHouse Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('run aggregate query', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'SELECT event_type, count() as cnt FROM events GROUP BY event_type ORDER BY cnt DESC'
    )
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('run DISTINCT query', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT DISTINCT country FROM events LIMIT 10')
    await actions.runQuery()

    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('format query', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openQueryEditor()
    await actions.typeQuery("select   *  from  events  where  event_type='purchase'")
    await actions.formatQuery()

    await assertNoErrorToast(window)
    await expect(window.locator('.monaco-editor')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// MongoDB Query
// ---------------------------------------------------------------------------
test.describe('MongoDB Query', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open and close query editor', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openQueryEditor()

    // Verify the Monaco editor appeared
    await expect(window.locator('.monaco-editor')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('run find query', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openQueryEditor()
    await actions.typeQuery('db.customers.find({}).limit(5)')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })
    await assertNoErrorToast(window)
  })
})
