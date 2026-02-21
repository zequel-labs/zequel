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
// MySQL Functions
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Functions', () => {
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

    await connectTo(window, 'mysql')

    // Wait for the sidebar to fully load including routines
    await window.waitForTimeout(2000)

    // Verify Functions folder is visible with a count
    const functionsFolder = window.getByText('Functions').first()
    await expect(functionsFolder).toBeVisible({ timeout: 15_000 })

    // Verify count is shown (at least 2 functions from seed data)
    const functionsCount = window.getByText('(2)').first()
    await expect(functionsCount).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('should open a function and show definition', async () => {
    test.setTimeout(120_000)

    await connectTo(window, 'mysql')

    // Wait for sidebar to load routines
    await window.waitForTimeout(2000)

    // Expand Functions folder
    await window.getByText('Functions').first().click()
    await window.waitForTimeout(1000)

    // Click on the function
    await window.getByText('get_customer_total_spent').click()
    await window.waitForTimeout(1000)

    // Verify the routine view loads with function details
    // RoutineView shows Information section with Name, Type, Returns, Language
    const nameCell = window.getByText('get_customer_total_spent').first()
    await expect(nameCell).toBeVisible({ timeout: 15_000 })

    // Verify it shows as a Function type
    await expect(window.getByText('Function')).toBeVisible({ timeout: 10_000 })

    // Verify Definition section is present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should show function return type', async () => {
    test.setTimeout(120_000)

    await connectTo(window, 'mysql')

    // Wait for sidebar to load routines
    await window.waitForTimeout(2000)

    // Expand Functions folder
    await window.getByText('Functions').first().click()
    await window.waitForTimeout(1000)

    // Click on format_price function
    await window.getByText('format_price').click()
    await window.waitForTimeout(1000)

    // Verify the routine view loads
    const nameCell = window.getByText('format_price').first()
    await expect(nameCell).toBeVisible({ timeout: 15_000 })

    // RoutineView shows Returns row for functions
    await expect(window.getByText('Returns')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Procedures
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Procedures', () => {
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

    await connectTo(window, 'mysql')

    // Wait for the sidebar to fully load including routines
    await window.waitForTimeout(2000)

    // Verify Procedures folder is visible
    const proceduresFolder = window.getByText('Procedures').first()
    await expect(proceduresFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open a procedure and show definition', async () => {
    test.setTimeout(120_000)

    await connectTo(window, 'mysql')

    // Wait for sidebar to load routines
    await window.waitForTimeout(2000)

    // Expand Procedures folder
    await window.getByText('Procedures').first().click()
    await window.waitForTimeout(1000)

    // Click on the procedure
    await window.getByText('update_order_status').click()
    await window.waitForTimeout(1000)

    // Verify the routine view loads with procedure details
    const nameCell = window.getByText('update_order_status').first()
    await expect(nameCell).toBeVisible({ timeout: 15_000 })

    // Verify it shows as a Stored Procedure type
    await expect(window.getByText('Stored Procedure')).toBeVisible({ timeout: 10_000 })

    // Verify Definition section is present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Triggers
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Triggers', () => {
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

    await connectTo(window, 'mysql')

    // Wait for the sidebar to fully load including triggers
    await window.waitForTimeout(2000)

    // Verify Triggers folder is visible
    const triggersFolder = window.getByText('Triggers').first()
    await expect(triggersFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open a trigger and show details', async () => {
    test.setTimeout(120_000)

    await connectTo(window, 'mysql')

    // Wait for sidebar to load triggers
    await window.waitForTimeout(2000)

    // Expand Triggers folder
    await window.getByText('Triggers').first().click()
    await window.waitForTimeout(1000)

    // Click on the trigger
    await window.getByText('trg_update_stock').click()
    await window.waitForTimeout(1000)

    // Verify the trigger view loads with trigger details
    // TriggerView shows Name, Table, Timing, Event, Status
    const nameCell = window.getByText('trg_update_stock').first()
    await expect(nameCell).toBeVisible({ timeout: 15_000 })

    // Verify Table info is shown (trigger is on order_items)
    await expect(window.getByText('order_items')).toBeVisible({ timeout: 10_000 })

    // Verify Timing is shown (AFTER)
    await expect(window.getByText('AFTER')).toBeVisible({ timeout: 10_000 })

    // Verify Event is shown (INSERT)
    await expect(window.getByText('INSERT')).toBeVisible({ timeout: 10_000 })

    // Verify Definition section is present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL Events
// ---------------------------------------------------------------------------
test.describe.serial('MySQL Events', () => {
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

  test('should display Events folder in sidebar', async () => {
    test.setTimeout(120_000)

    await connectTo(window, 'mysql')

    // Wait for the sidebar to fully load including events
    await window.waitForTimeout(2000)

    // Verify Events folder is visible
    const eventsFolder = window.getByText('Events').first()
    await expect(eventsFolder).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('should open an event and show details', async () => {
    test.setTimeout(120_000)

    await connectTo(window, 'mysql')

    // Wait for sidebar to load events
    await window.waitForTimeout(2000)

    // Expand Events folder
    await window.getByText('Events').first().click()
    await window.waitForTimeout(1000)

    // Click on the event
    await window.getByText('evt_cleanup_cancelled_orders').click()
    await window.waitForTimeout(1000)

    // Verify the event view loads with event details
    // EventView shows Name, Database, Status, Event Type, Definer, On Completion, Created
    const nameCell = window.getByText('evt_cleanup_cancelled_orders').first()
    await expect(nameCell).toBeVisible({ timeout: 15_000 })

    // Verify Status is shown
    await expect(window.getByText('Status').first()).toBeVisible({ timeout: 10_000 })

    // Verify Event Type is shown
    await expect(window.getByText('Event Type')).toBeVisible({ timeout: 10_000 })

    // Verify Definition section is present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('should show recurring event schedule', async () => {
    test.setTimeout(120_000)

    await connectTo(window, 'mysql')

    // Wait for sidebar to load events
    await window.waitForTimeout(2000)

    // Expand Events folder
    await window.getByText('Events').first().click()
    await window.waitForTimeout(1000)

    // Click on the recurring event
    await window.getByText('evt_daily_stats_log').click()
    await window.waitForTimeout(1000)

    // Verify the event view loads
    const nameCell = window.getByText('evt_daily_stats_log').first()
    await expect(nameCell).toBeVisible({ timeout: 15_000 })

    // Verify Schedule section is present (recurring events show Interval, Starts, etc.)
    await expect(window.getByText('Schedule')).toBeVisible({ timeout: 10_000 })

    // Verify Interval row is visible for recurring events
    await expect(window.getByText('Interval')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MariaDB Functions
// ---------------------------------------------------------------------------
test.describe.serial('MariaDB Functions', () => {
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

  test('should open function view on MariaDB', async () => {
    test.setTimeout(120_000)

    await connectTo(window, 'mariadb')

    // Wait for sidebar to load routines
    await window.waitForTimeout(2000)

    // Expand Functions folder
    await window.getByText('Functions').first().click()
    await window.waitForTimeout(1000)

    // Click on a function (MariaDB has the same seed data as MySQL)
    await window.getByText('get_customer_total_spent').click()
    await window.waitForTimeout(1000)

    // Verify the routine view loads with function details
    const nameCell = window.getByText('get_customer_total_spent').first()
    await expect(nameCell).toBeVisible({ timeout: 15_000 })

    // Verify it shows as a Function type
    await expect(window.getByText('Function')).toBeVisible({ timeout: 10_000 })

    // Verify Definition section is present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MariaDB Events
// ---------------------------------------------------------------------------
test.describe.serial('MariaDB Events', () => {
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

  test('should open event view on MariaDB', async () => {
    test.setTimeout(120_000)

    await connectTo(window, 'mariadb')

    // Wait for sidebar to load events
    await window.waitForTimeout(2000)

    // Expand Events folder
    await window.getByText('Events').first().click()
    await window.waitForTimeout(1000)

    // Click on an event (MariaDB has the same seed data as MySQL)
    await window.getByText('evt_cleanup_cancelled_orders').click()
    await window.waitForTimeout(1000)

    // Verify the event view loads with event details
    const nameCell = window.getByText('evt_cleanup_cancelled_orders').first()
    await expect(nameCell).toBeVisible({ timeout: 15_000 })

    // Verify Event Type is shown
    await expect(window.getByText('Event Type')).toBeVisible({ timeout: 10_000 })

    // Verify Definition section is present
    await expect(window.getByText('Definition')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})
