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
// PostgreSQL Index Operations
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Index Operations', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop index', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP INDEX IF EXISTS idx_e2e_test')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create index
    await actions.typeQuery('CREATE INDEX idx_e2e_test ON customers(name)')
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop index
    await actions.typeQuery('DROP INDEX idx_e2e_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('create and drop unique index', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP INDEX IF EXISTS idx_e2e_unique')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create unique index
    await actions.typeQuery('CREATE UNIQUE INDEX idx_e2e_unique ON customers(email)')
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop unique index
    await actions.typeQuery('DROP INDEX idx_e2e_unique')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Index Operations
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Index Operations', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop index', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP INDEX idx_e2e_test ON customers')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create index
    await actions.typeQuery('CREATE INDEX idx_e2e_test ON customers(name)')
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop index
    await actions.typeQuery('DROP INDEX idx_e2e_test ON customers')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('create and drop unique index', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP INDEX idx_e2e_unique ON customers')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create unique index
    await actions.typeQuery('CREATE UNIQUE INDEX idx_e2e_unique ON customers(email)')
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop unique index
    await actions.typeQuery('DROP INDEX idx_e2e_unique ON customers')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL Foreign Key Operations
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Foreign Key Operations', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create table with foreign key and drop it', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP TABLE IF EXISTS e2e_fk_test')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create table with FK referencing customers(id)
    await actions.typeQuery(
      'CREATE TABLE e2e_fk_test (id SERIAL PRIMARY KEY, customer_id INT REFERENCES customers(id))'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop the table (cascades the FK constraint)
    await actions.typeQuery('DROP TABLE e2e_fk_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Foreign Key Operations
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Foreign Key Operations', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create table with foreign key and drop it', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP TABLE IF EXISTS e2e_fk_test')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create table with FK referencing customers(id)
    await actions.typeQuery(
      'CREATE TABLE e2e_fk_test (id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT, FOREIGN KEY (customer_id) REFERENCES customers(id))'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop the table
    await actions.typeQuery('DROP TABLE e2e_fk_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// PostgreSQL Trigger Operations
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Trigger Operations', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create trigger function, trigger, and drop both', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP TRIGGER IF EXISTS e2e_test_trigger ON customers')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    await actions.typeQuery('DROP FUNCTION IF EXISTS e2e_trigger_fn()')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create trigger function
    await actions.typeQuery(
      'CREATE OR REPLACE FUNCTION e2e_trigger_fn() RETURNS TRIGGER AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Create trigger
    await actions.typeQuery(
      'CREATE TRIGGER e2e_test_trigger BEFORE INSERT ON customers FOR EACH ROW EXECUTE FUNCTION e2e_trigger_fn()'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop trigger
    await actions.typeQuery('DROP TRIGGER e2e_test_trigger ON customers')
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop function
    await actions.typeQuery('DROP FUNCTION e2e_trigger_fn()')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Trigger Operations
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Trigger Operations', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop trigger', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP TRIGGER IF EXISTS e2e_test_trigger')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create trigger
    await actions.typeQuery(
      'CREATE TRIGGER e2e_test_trigger BEFORE INSERT ON customers FOR EACH ROW SET @e2e = 1'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop trigger
    await actions.typeQuery('DROP TRIGGER e2e_test_trigger')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite Index Operations
// ---------------------------------------------------------------------------
test.describe.serial('SQLite Index Operations', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop index', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP INDEX IF EXISTS idx_e2e_test')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create index
    await actions.typeQuery('CREATE INDEX idx_e2e_test ON customers(name)')
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop index
    await actions.typeQuery('DROP INDEX idx_e2e_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })

  test('create and drop unique index', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP INDEX IF EXISTS idx_e2e_unique')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create unique index
    await actions.typeQuery('CREATE UNIQUE INDEX idx_e2e_unique ON customers(email)')
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop unique index
    await actions.typeQuery('DROP INDEX idx_e2e_unique')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQLite Trigger Operations
// ---------------------------------------------------------------------------
test.describe.serial('SQLite Trigger Operations', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create and drop trigger', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openQueryEditor()

    // Cleanup from prior failed runs
    await actions.typeQuery('DROP TRIGGER IF EXISTS e2e_test_trigger')
    await actions.runQuery()
    await window.waitForTimeout(1000)

    // Create trigger
    await actions.typeQuery(
      'CREATE TRIGGER e2e_test_trigger BEFORE INSERT ON customers BEGIN SELECT 1; END'
    )
    await actions.runQuery()
    await assertNoErrorToast(window)
    await window.waitForTimeout(1000)

    // Drop trigger
    await actions.typeQuery('DROP TRIGGER e2e_test_trigger')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})
