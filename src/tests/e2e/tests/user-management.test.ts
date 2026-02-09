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

const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.locator('[data-testid="header-users-btn"]')
  const isVisible = await trigger.isVisible().catch(() => false)
  if (!isVisible) {
    const moreButton = page.locator('button:has(.tabler-icon-dots-vertical), button:has(svg.icon-tabler-dots-vertical)')
    if (await moreButton.isVisible().catch(() => false)) {
      await moreButton.click()
      await page.waitForTimeout(300)
    }
  }
}

const openUserManagement = async (page: Page): Promise<void> => {
  await openMoreMenu(page)
  const btn = page.getByTestId('header-users-btn')
  await btn.click({ timeout: 5_000 })
}

const waitForUsersTable = async (page: Page): Promise<void> => {
  const usersTable = page.getByTestId('users-table')
  await expect(usersTable).toBeVisible({ timeout: 15_000 })
  const rows = usersTable.locator('tbody tr')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// PostgreSQL User Management
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL User Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open user management view', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)
    await assertNoErrorToast(window)
  })

  test('create and delete user', async () => {
    await connectTo(window, 'postgres')

    await openUserManagement(window)
    await waitForUsersTable(window)

    // Click create user button in status bar
    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    // Fill in user details
    const uniqueUser = `e2e_pg_user_${Date.now()}`
    await window.getByTestId('create-user-username').fill(uniqueUser)
    await window.getByTestId('create-user-password').fill('e2eTestPass123!')

    // Submit
    await window.getByTestId('create-user-submit').click()

    // Wait for success toast
    const successToast = window.locator('.sonner-toast[data-type="success"]')
    await expect(successToast).toBeVisible({ timeout: 10_000 })

    // Refresh users list
    await window.getByTestId('statusbar-users-refresh').click()
    await window.waitForTimeout(2000)

    // Verify the user appears in the table
    const usersTable = window.getByTestId('users-table')
    await expect(usersTable.locator(`text=${uniqueUser}`)).toBeVisible({ timeout: 10_000 })

    // Delete the user
    const deleteBtn = window.getByTestId(`users-delete-${uniqueUser}`)
    await deleteBtn.click()

    // Confirm deletion
    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    // Wait for success toast
    await expect(window.locator('.sonner-toast[data-type="success"]')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL User Management
// ---------------------------------------------------------------------------
test.describe.serial('MySQL User Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open user management view', async () => {
    await connectTo(window, 'mysql')

    await openUserManagement(window)
    await waitForUsersTable(window)
    await assertNoErrorToast(window)
  })

  test('create and delete user', async () => {
    await connectTo(window, 'mysql')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    const uniqueUser = `e2e_my_user_${Date.now()}`
    await window.getByTestId('create-user-username').fill(uniqueUser)
    await window.getByTestId('create-user-password').fill('e2eTestPass123!')

    await window.getByTestId('create-user-submit').click()

    const successToast = window.locator('.sonner-toast[data-type="success"]')
    await expect(successToast).toBeVisible({ timeout: 10_000 })

    await window.getByTestId('statusbar-users-refresh').click()
    await window.waitForTimeout(2000)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable.locator(`text=${uniqueUser}`)).toBeVisible({ timeout: 10_000 })

    const deleteBtn = window.getByTestId(`users-delete-${uniqueUser}`)
    await deleteBtn.click()

    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    await expect(window.locator('.sonner-toast[data-type="success"]')).toBeVisible({ timeout: 10_000 })
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MariaDB User Management
// ---------------------------------------------------------------------------
test.describe.serial('MariaDB User Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open user management view', async () => {
    await connectTo(window, 'mariadb')

    await openUserManagement(window)
    await waitForUsersTable(window)
    await assertNoErrorToast(window)
  })

  test('create and delete user', async () => {
    await connectTo(window, 'mariadb')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    const uniqueUser = `e2e_ma_user_${Date.now()}`
    await window.getByTestId('create-user-username').fill(uniqueUser)
    await window.getByTestId('create-user-password').fill('e2eTestPass123!')

    await window.getByTestId('create-user-submit').click()

    const successToast = window.locator('.sonner-toast[data-type="success"]')
    await expect(successToast).toBeVisible({ timeout: 10_000 })

    await window.getByTestId('statusbar-users-refresh').click()
    await window.waitForTimeout(2000)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable.locator(`text=${uniqueUser}`)).toBeVisible({ timeout: 10_000 })

    const deleteBtn = window.getByTestId(`users-delete-${uniqueUser}`)
    await deleteBtn.click()

    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    await expect(window.locator('.sonner-toast[data-type="success"]')).toBeVisible({ timeout: 10_000 })
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// ClickHouse User Management
// ---------------------------------------------------------------------------
test.describe.serial('ClickHouse User Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open user management view', async () => {
    await connectTo(window, 'clickhouse')

    await openUserManagement(window)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
  })

  test('create and delete user', async () => {
    await connectTo(window, 'clickhouse')

    await openUserManagement(window)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable).toBeVisible({ timeout: 15_000 })

    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    const uniqueUser = `e2e_ch_user_${Date.now()}`
    await window.getByTestId('create-user-username').fill(uniqueUser)
    await window.getByTestId('create-user-password').fill('e2eTestPass123!')

    await window.getByTestId('create-user-submit').click()

    const successToast = window.locator('.sonner-toast[data-type="success"]')
    await expect(successToast).toBeVisible({ timeout: 10_000 })

    await window.getByTestId('statusbar-users-refresh').click()
    await window.waitForTimeout(2000)

    await expect(usersTable.locator(`text=${uniqueUser}`)).toBeVisible({ timeout: 10_000 })

    const deleteBtn = window.getByTestId(`users-delete-${uniqueUser}`)
    await deleteBtn.click()

    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    await expect(window.locator('.sonner-toast[data-type="success"]')).toBeVisible({ timeout: 10_000 })
    await assertNoErrorToast(window)
  })
})
