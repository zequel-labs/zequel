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
// PostgreSQL View Management
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL View Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop view via query', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE VIEW e2e_test_view AS SELECT id, name, country FROM customers WHERE country = \'USA\''
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('SELECT * FROM e2e_test_view')
    await actions.runQuery()
    await assertResultsHaveRows(window)
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP VIEW e2e_test_view')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename view via query', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE VIEW e2e_view_rename AS SELECT id, name FROM customers')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER VIEW e2e_view_rename RENAME TO e2e_view_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP VIEW e2e_view_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL View Management
// ---------------------------------------------------------------------------
test.describe.serial('MySQL View Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop view via query', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE VIEW e2e_test_view AS SELECT name, price FROM products WHERE price > 100'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP VIEW e2e_test_view')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename view via query', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE VIEW e2e_view_rename AS SELECT name, price FROM products')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('RENAME TABLE e2e_view_rename TO e2e_view_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP VIEW e2e_view_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MariaDB View Management
// ---------------------------------------------------------------------------
test.describe.serial('MariaDB View Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop view via query', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE VIEW e2e_test_view AS SELECT name, price FROM products WHERE price > 100'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP VIEW e2e_test_view')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename view via query', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE VIEW e2e_view_rename AS SELECT name, price FROM products')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('RENAME TABLE e2e_view_rename TO e2e_view_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP VIEW e2e_view_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite View Management
// ---------------------------------------------------------------------------
test.describe.serial('SQLite View Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop view via query', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE VIEW e2e_test_view AS SELECT * FROM orders WHERE status = \'completed\''
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP VIEW e2e_test_view')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ClickHouse View Management
// ---------------------------------------------------------------------------
test.describe.serial('ClickHouse View Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop view via query', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE VIEW e2e_test_view AS SELECT event_type, count() as cnt FROM events GROUP BY event_type'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP VIEW e2e_test_view')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename view via query', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openQueryEditor()

    await actions.typeQuery(
      'CREATE VIEW e2e_view_rename AS SELECT event_type FROM events'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('RENAME TABLE e2e_view_rename TO e2e_view_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP VIEW e2e_view_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})
