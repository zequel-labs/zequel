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
  const rows = results.locator('tr')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// PostgreSQL Seed Data
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Seed Data', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query seed views', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM customer_order_summary LIMIT 5')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed functions', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT get_customer_total_spent(1) AS total, format_price(99.99) AS formatted')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed materialized views', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM mv_monthly_sales LIMIT 5')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed sequences', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery("SELECT nextval('invoice_number_seq') AS val")
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed extensions', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery("SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'uuid-ossp', 'hstore')")
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed users and roles', async () => {
    const actions = await connectTo(window, 'postgres')
    await actions.openQueryEditor()

    await actions.typeQuery("SELECT rolname FROM pg_roles WHERE rolname IN ('analyst', 'developer', 'intern', 'readonly_role', 'readwrite_role')")
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Seed Data
// ---------------------------------------------------------------------------
test.describe('MySQL Seed Data', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query seed views', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM customer_order_summary LIMIT 5')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed functions', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT get_customer_total_spent(1) AS total, format_price(99.99) AS formatted')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed events', async () => {
    const actions = await connectTo(window, 'mysql')
    await actions.openQueryEditor()

    await actions.typeQuery("SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = 'zequel'")
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MariaDB Seed Data
// ---------------------------------------------------------------------------
test.describe('MariaDB Seed Data', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query seed views', async () => {
    const actions = await connectTo(window, 'mariadb')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM customer_order_summary LIMIT 5')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed functions', async () => {
    const actions = await connectTo(window, 'mariadb')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT get_customer_total_spent(1) AS total, format_price(99.99) AS formatted')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed events', async () => {
    const actions = await connectTo(window, 'mariadb')
    await actions.openQueryEditor()

    await actions.typeQuery("SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = 'zequel'")
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite Seed Data
// ---------------------------------------------------------------------------
test.describe('SQLite Seed Data', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query seed views', async () => {
    const actions = await connectTo(window, 'sqlite')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM customer_order_summary LIMIT 5')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query seed triggers', async () => {
    const actions = await connectTo(window, 'sqlite')
    await actions.openQueryEditor()

    await actions.typeQuery("SELECT name, type FROM sqlite_master WHERE type = 'trigger'")
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Seed Data
// ---------------------------------------------------------------------------
test.describe('ClickHouse Seed Data', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query seed views', async () => {
    const actions = await connectTo(window, 'clickhouse')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM events_by_country LIMIT 5')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query daily_events view', async () => {
    const actions = await connectTo(window, 'clickhouse')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM daily_events LIMIT 5')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })

  test('query user_journey view', async () => {
    const actions = await connectTo(window, 'clickhouse')
    await actions.openQueryEditor()

    await actions.typeQuery('SELECT * FROM user_journey LIMIT 5')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MongoDB Seed Data
// ---------------------------------------------------------------------------
test.describe('MongoDB Seed Data', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('query seed view via find', async () => {
    const actions = await connectTo(window, 'mongodb')
    await actions.openQueryEditor()

    await actions.typeQuery('db.customer_order_summary.find().limit(5)')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })
    await assertNoErrorToast(window)
  })

  test('query product_catalog view', async () => {
    const actions = await connectTo(window, 'mongodb')
    await actions.openQueryEditor()

    await actions.typeQuery('db.product_catalog.find().limit(5)')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })
    await assertNoErrorToast(window)
  })

  test('query recent_orders view', async () => {
    const actions = await connectTo(window, 'mongodb')
    await actions.openQueryEditor()

    await actions.typeQuery('db.recent_orders.find().limit(5)')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })
    await assertNoErrorToast(window)
  })
})
