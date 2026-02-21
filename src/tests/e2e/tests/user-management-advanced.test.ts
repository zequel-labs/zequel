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

const openUserManagement = async (page: Page): Promise<void> => {
  // Dismiss any open dialogs/overlays first
  const overlay = page.locator('[data-state="open"][aria-hidden="true"]')
  if (await overlay.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }

  const trigger = page.getByTestId('header-users-btn')
  const isDirectlyVisible = await trigger.isVisible().catch(() => false)
  if (!isDirectlyVisible) {
    const moreButton = page.getByTestId('header-more-menu-btn')
    if (await moreButton.isVisible().catch(() => false)) {
      await moreButton.click()
      await page.waitForTimeout(500)
    }
  }
  const btn = page.getByTestId('header-users-btn')
  await btn.click({ timeout: 5_000 })
}

const waitForUsersTable = async (page: Page): Promise<void> => {
  const usersTable = page.getByTestId('users-table')
  await expect(usersTable).toBeVisible({ timeout: 15_000 })
  const rows = usersTable.locator('[data-testid^="users-row-"]')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// User Management View - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('User Management View - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open user management and verify tab appears as "Users"', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)

    // Verify the Users tab is present in the tab bar
    const usersTab = window.getByTestId('tab-Users')
    await expect(usersTab).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('users table is visible with at least one user', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable).toBeVisible()

    // Verify at least one user row exists
    const rows = usersTable.locator('[data-testid^="users-row-"]')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThanOrEqual(1)

    await assertNoErrorToast(window)
  })

  test('refresh button in status bar reloads the table', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)

    // Click refresh in the status bar
    const refreshBtn = window.getByTestId('statusbar-users-refresh')
    await expect(refreshBtn).toBeVisible({ timeout: 5_000 })
    await refreshBtn.click()

    // After refresh, the users table should still be visible with data
    await waitForUsersTable(window)

    await assertNoErrorToast(window)
  })

  test('create user button is visible in status bar', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const createBtn = window.getByTestId('statusbar-users-create')
    await expect(createBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// User Management View - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('User Management View - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open user management and verify users table visible', async () => {
    await connectTo(window, 'mysql')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable).toBeVisible()

    await assertNoErrorToast(window)
  })

  test('at least root user should be visible', async () => {
    await connectTo(window, 'mysql')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable).toContainText('root', { timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// User Management View - SQL Server
// ---------------------------------------------------------------------------
test.describe.serial('User Management View - SQL Server', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open user management and verify users table visible', async () => {
    await connectTo(window, 'sqlserver')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable).toBeVisible()

    // Verify at least one user row exists
    const rows = usersTable.locator('[data-testid^="users-row-"]')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThanOrEqual(1)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// User Management - Tab Deduplication
// ---------------------------------------------------------------------------
test.describe.serial('User Management - Tab Deduplication', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('PostgreSQL: opening user management twice creates only one tab', async () => {
    await connectTo(window, 'postgres')

    // Open user management the first time
    await openUserManagement(window)
    await waitForUsersTable(window)

    const tabBar = window.getByTestId('tab-bar')
    const tabCountBefore = await tabBar.locator('[data-testid^="tab-"]').count()

    // Verify the Users tab exists
    const usersTab = window.getByTestId('tab-Users')
    await expect(usersTab).toBeVisible({ timeout: 5_000 })

    // Close the more menu if it is open by pressing Escape
    await window.keyboard.press('Escape')
    await window.waitForTimeout(500)

    // Open user management the second time
    await openUserManagement(window)
    await window.waitForTimeout(1_000)

    const tabCountAfter = await tabBar.locator('[data-testid^="tab-"]').count()

    // Should not have created a duplicate tab
    expect(tabCountAfter).toBe(tabCountBefore)

    // Only one Users tab should exist
    const usersTabs = tabBar.locator('[data-testid="tab-Users"]')
    const count = await usersTabs.count()
    expect(count).toBe(1)

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// User Management - Safe Mode
// ---------------------------------------------------------------------------
test.describe.serial('User Management - Safe Mode', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('user management button is disabled when safe mode is on', async () => {
    const actions = await connectTo(window, 'postgres')

    // Enable safe mode BEFORE opening the more menu
    await actions.enableSafeMode()

    // Open more menu
    await openMoreMenu(window)

    // User management button should be visible but disabled
    const usersBtn = window.getByTestId('header-users-btn')
    await expect(usersBtn).toBeVisible({ timeout: 5_000 })
    await expect(usersBtn).toHaveAttribute('data-disabled', '')

    await assertNoErrorToast(window)
  })

  test('user management button is enabled when safe mode is off', async () => {
    const actions = await connectTo(window, 'postgres')

    // Ensure safe mode is off
    await actions.disableSafeMode()

    // Open more menu
    await openMoreMenu(window)

    // User management button should be visible and NOT disabled
    const usersBtn = window.getByTestId('header-users-btn')
    await expect(usersBtn).toBeVisible({ timeout: 5_000 })
    await expect(usersBtn).not.toHaveAttribute('data-disabled', '')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Create User Dialog - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Create User Dialog - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create dialog appears with username and password inputs', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)

    // Click the create user button in the status bar
    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    // Verify the dialog fields appear
    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })

    const passwordInput = window.getByTestId('create-user-password')
    await expect(passwordInput).toBeVisible({ timeout: 5_000 })

    const submitBtn = window.getByTestId('create-user-submit')
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('submit button is disabled when fields are empty', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })

    // Ensure fields are empty
    const usernameValue = await usernameInput.inputValue()
    const passwordInput = window.getByTestId('create-user-password')
    const passwordValue = await passwordInput.inputValue()

    expect(usernameValue).toBe('')
    expect(passwordValue).toBe('')

    // Submit button should be disabled when fields are empty
    const submitBtn = window.getByTestId('create-user-submit')
    await expect(submitBtn).toBeDisabled({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('submit button becomes enabled after filling username and password', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })

    // Submit should be disabled initially
    const submitBtn = window.getByTestId('create-user-submit')
    await expect(submitBtn).toBeDisabled({ timeout: 5_000 })

    // Fill in username and password
    await usernameInput.fill('test_dialog_user')
    await window.waitForTimeout(100)

    const passwordInput = window.getByTestId('create-user-password')
    await passwordInput.fill('testPassword123!')
    await window.waitForTimeout(100)

    // Submit should now be enabled
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('cancel/close dialog without creating a user', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)

    // Remember the current row count
    const usersTable = window.getByTestId('users-table')
    const rowsBefore = usersTable.locator('[data-testid^="users-row-"]')
    const rowCountBefore = await rowsBefore.count()

    // Open the create dialog
    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })

    // Fill in some data but do NOT submit
    await usernameInput.fill('should_not_be_created')
    await window.waitForTimeout(100)

    const passwordInput = window.getByTestId('create-user-password')
    await passwordInput.fill('testPassword123!')
    await window.waitForTimeout(100)

    // Close the dialog by pressing Escape
    await window.keyboard.press('Escape')

    // Dialog should be closed
    await expect(usernameInput).not.toBeVisible({ timeout: 5_000 })

    // User table should still have the same number of rows (no user was created)
    const rowsAfter = usersTable.locator('[data-testid^="users-row-"]')
    const rowCountAfter = await rowsAfter.count()
    expect(rowCountAfter).toBe(rowCountBefore)

    // The cancelled username should not appear in the table
    await expect(usersTable).not.toContainText('should_not_be_created')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Create User Dialog - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Create User Dialog - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create dialog appears with username and password inputs', async () => {
    await connectTo(window, 'mysql')

    await openUserManagement(window)
    await waitForUsersTable(window)

    // Click the create user button in the status bar
    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    // Verify the dialog fields appear
    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })

    const passwordInput = window.getByTestId('create-user-password')
    await expect(passwordInput).toBeVisible({ timeout: 5_000 })

    const submitBtn = window.getByTestId('create-user-submit')
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('dialog fields are empty by default', async () => {
    await connectTo(window, 'mysql')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })

    const usernameValue = await usernameInput.inputValue()
    expect(usernameValue).toBe('')

    const passwordInput = window.getByTestId('create-user-password')
    const passwordValue = await passwordInput.inputValue()
    expect(passwordValue).toBe('')

    await assertNoErrorToast(window)
  })
})
