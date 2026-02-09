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

// ---------------------------------------------------------------------------
// PostgreSQL Table Management
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Table Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop table via query', async () => {
    const actions = await connectTo(window, 'postgres')

    // Create table
    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE TABLE e2e_test_table (id SERIAL PRIMARY KEY, name TEXT, value NUMERIC)'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Drop table
    await actions.typeQuery('DROP TABLE e2e_test_table')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename table via query', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()

    // Create table
    await actions.typeQuery('CREATE TABLE e2e_rename_test (id SERIAL PRIMARY KEY)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Rename table
    await actions.typeQuery('ALTER TABLE e2e_rename_test RENAME TO e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Drop renamed table
    await actions.typeQuery('DROP TABLE e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('add and drop column via query', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()

    // Create table
    await actions.typeQuery('CREATE TABLE e2e_col_test (id SERIAL PRIMARY KEY)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Add column
    await actions.typeQuery('ALTER TABLE e2e_col_test ADD COLUMN description TEXT')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Drop column
    await actions.typeQuery('ALTER TABLE e2e_col_test DROP COLUMN description')
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Cleanup
    await actions.typeQuery('DROP TABLE e2e_col_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename column via query', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE TABLE e2e_colrename (id SERIAL PRIMARY KEY, old_name TEXT)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER TABLE e2e_colrename RENAME COLUMN old_name TO new_name')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_colrename')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Table Management
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Table Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop table via query', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE TABLE e2e_test_table (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255))'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_test_table')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename table via query', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE TABLE e2e_rename_test (id INT AUTO_INCREMENT PRIMARY KEY)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('RENAME TABLE e2e_rename_test TO e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('add and drop column via query', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE TABLE e2e_col_test (id INT AUTO_INCREMENT PRIMARY KEY)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER TABLE e2e_col_test ADD COLUMN description VARCHAR(255)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER TABLE e2e_col_test DROP COLUMN description')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_col_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MariaDB Table Management
// ---------------------------------------------------------------------------
test.describe.serial('MariaDB Table Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop table via query', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE TABLE e2e_test_table (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255))'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_test_table')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename table via query', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE TABLE e2e_rename_test (id INT AUTO_INCREMENT PRIMARY KEY)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('RENAME TABLE e2e_rename_test TO e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('add and drop column via query', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE TABLE e2e_col_test (id INT AUTO_INCREMENT PRIMARY KEY)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER TABLE e2e_col_test ADD COLUMN description VARCHAR(255)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER TABLE e2e_col_test DROP COLUMN description')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_col_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite Table Management
// ---------------------------------------------------------------------------
test.describe.serial('SQLite Table Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop table via query', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE TABLE e2e_test_table (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_test_table')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename table via query', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE TABLE e2e_rename_test (id INTEGER PRIMARY KEY AUTOINCREMENT)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER TABLE e2e_rename_test RENAME TO e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('add column via query', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()

    await actions.typeQuery('CREATE TABLE e2e_col_test (id INTEGER PRIMARY KEY AUTOINCREMENT)')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER TABLE e2e_col_test ADD COLUMN description TEXT')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_col_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Table Management
// ---------------------------------------------------------------------------
test.describe.serial('ClickHouse Table Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop table via query', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE TABLE e2e_test_table (id UInt64, name String) ENGINE = MergeTree() ORDER BY id'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_test_table')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('rename table via query', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openQueryEditor()

    await actions.typeQuery(
      'CREATE TABLE e2e_rename_test (id UInt64) ENGINE = MergeTree() ORDER BY id'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('RENAME TABLE e2e_rename_test TO e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_renamed')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('add and drop column via query', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openQueryEditor()

    await actions.typeQuery(
      'CREATE TABLE e2e_col_test (id UInt64) ENGINE = MergeTree() ORDER BY id'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER TABLE e2e_col_test ADD COLUMN description String')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('ALTER TABLE e2e_col_test DROP COLUMN description')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('DROP TABLE e2e_col_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MongoDB Collection Management
// ---------------------------------------------------------------------------
test.describe.serial('MongoDB Collection Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop collection via query', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openQueryEditor()
    await actions.typeQuery('db.createCollection("e2e_test_collection")')
    await actions.runQuery()
    await assertNoErrorToast(window)

    await actions.typeQuery('db.e2e_test_collection.drop()')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})
