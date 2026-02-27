import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'
import { userActions, type UserActions } from '@e2e/page-actions'

const assertNoErrorToast = async (page: Page): Promise<void> => {
  await page.waitForTimeout(500)
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible()
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Functions', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    ;({ app, window } = await launchApp())
    actions = userActions(window)
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Functions folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // The Functions folder should be visible with a count
    const functionsFolder = window.getByText('Functions').first()
    await expect(functionsFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open a function and show definition', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // Expand the Functions folder
    await window.getByText('Functions').first().click()
    await window.waitForTimeout(1000)

    // Click on the specific function
    await window.getByText('get_customer_total_spent').click()
    await window.waitForTimeout(2000)

    // Verify the routine view loaded with function details
    // The RoutineView shows Name, Type, Language in the info table
    await expect(window.getByText('get_customer_total_spent').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Function')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('plpgsql')).toBeVisible({ timeout: 10_000 })

    // Verify the Definition section is present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should show function parameters', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // Expand the Functions folder
    await window.getByText('Functions').first().click()
    await window.waitForTimeout(1000)

    // Click on the specific function
    await window.getByText('get_customer_total_spent').click()
    await window.waitForTimeout(2000)

    // Verify the Parameters section is visible
    await expect(window.getByText('Parameters')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Procedures', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    ;({ app, window } = await launchApp())
    actions = userActions(window)
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Procedures folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // The Procedures folder should be visible
    const proceduresFolder = window.getByText('Procedures').first()
    await expect(proceduresFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open a procedure and show definition', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // Expand the Procedures folder
    await window.getByText('Procedures').first().click()
    await window.waitForTimeout(1000)

    // Click on the specific procedure
    await window.getByText('update_order_status').click()
    await window.waitForTimeout(2000)

    // Verify the routine view loaded with procedure details
    await expect(window.getByText('update_order_status').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Stored Procedure')).toBeVisible({ timeout: 10_000 })

    // Verify the Definition section is present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Triggers', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    ;({ app, window } = await launchApp())
    actions = userActions(window)
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Triggers folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // The Triggers folder should be visible
    const triggersFolder = window.getByText('Triggers').first()
    await expect(triggersFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open a trigger and show details', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // Expand the Triggers folder
    await window.getByText('Triggers').first().click()
    await window.waitForTimeout(1000)

    // Click on the specific trigger
    await window.getByText('trg_update_stock').click()
    await window.waitForTimeout(2000)

    // Verify the trigger view loaded with trigger details
    // The TriggerView shows Name, Table, Timing, Event in the info table
    await expect(window.getByText('trg_update_stock').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Information')).toBeVisible({ timeout: 10_000 })

    // Verify the Definition section is present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Sequences', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    ;({ app, window } = await launchApp())
    actions = userActions(window)
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Sequences folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // The Sequences folder should be visible
    const sequencesFolder = window.getByText('Sequences').first()
    await expect(sequencesFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open a sequence and show properties', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // Expand the Sequences folder
    await window.getByText('Sequences').first().click()
    await window.waitForTimeout(1000)

    // Click on the specific sequence
    await window.getByText('invoice_number_seq').click()
    await window.waitForTimeout(2000)

    // Verify the sequence view loaded with sequence details
    // The SequenceView shows Properties section with Name, Schema, Data Type, Owner
    // and Values section with Start Value, etc.
    await expect(window.getByText('invoice_number_seq').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Properties')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Start Value')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('1000')).toBeVisible({ timeout: 10_000 })

    // Verify the DDL section is present
    await expect(window.getByText('DDL')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Materialized Views
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Materialized Views', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    ;({ app, window } = await launchApp())
    actions = userActions(window)
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Materialized Views folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // The Materialized Views folder should be visible
    const mvFolder = window.getByText('Materialized Views').first()
    await expect(mvFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open a materialized view and show definition', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // Expand the Materialized Views folder
    await window.getByText('Materialized Views').first().click()
    await window.waitForTimeout(1000)

    // Click on the specific materialized view
    await window.getByText('mv_monthly_sales').click()
    await window.waitForTimeout(2000)

    // Verify the materialized view loaded with details
    // The MaterializedViewView shows Information section with Name, Schema, Owner, Populated, Has Indexes
    await expect(window.getByText('mv_monthly_sales').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Information')).toBeVisible({ timeout: 10_000 })

    // Verify the Definition and DDL sections are present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('DDL')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Extensions', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    ;({ app, window } = await launchApp())
    actions = userActions(window)
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Extensions folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // The Extensions folder should be visible
    const extensionsFolder = window.getByText('Extensions').first()
    await expect(extensionsFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open extensions view and show installed extensions', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // Expand the Extensions folder
    await window.getByText('Extensions').first().click()
    await window.waitForTimeout(1000)

    // Click on any extension to open the extensions view
    await window.getByText('pg_trgm').first().click()
    await window.waitForTimeout(2000)

    // Verify the extensions view shows installed extensions
    // The ExtensionsView shows a table with Name, Version, Schema columns
    await expect(window.getByText('pg_trgm').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('uuid-ossp')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('hstore')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Enums', () => {
  let app: ElectronApplication
  let window: Page
  let actions: UserActions

  test.beforeEach(async () => {
    ;({ app, window } = await launchApp())
    actions = userActions(window)
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('should display Enums folder in sidebar', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // The Enums folder should be visible
    const enumsFolder = window.getByText('Enums').first()
    await expect(enumsFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open enums view and show enum types', async () => {
    test.setTimeout(120_000)
    await connectTo(window, 'postgres')

    // Expand the Enums folder
    await window.getByText('Enums').first().click()
    await window.waitForTimeout(1000)

    // Click on the specific enum to open the enums view
    await window.getByText('order_status').first().click()
    await window.waitForTimeout(2000)

    // Verify the enums view shows enum types with their values as badges
    // The EnumsView shows enum name, schema, and values
    await expect(window.getByText('order_status').first()).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('pending')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('shipped')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('completed')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('cancelled')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})
