import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const openUserManagement = async (page: Page): Promise<void> => {
  // Dismiss any open dialogs/overlays first
  const overlay = page.locator('[data-state="open"][aria-hidden="true"].fixed')
  if (await overlay.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }

  const trigger = page.locator('[data-testid="header-users-btn"]')
  const isDirectlyVisible = await trigger.isVisible().catch(() => false)
  if (!isDirectlyVisible) {
    const moreButton = page.locator('button:has(.tabler-icon-dots-vertical), button:has(svg.icon-tabler-dots-vertical)')
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

    const uniqueUser = `e2e_pg_user_${Date.now()}`
    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })

    // Use fill() — the Input component is a native <input> with v-model via useVModel
    await usernameInput.fill(uniqueUser)
    await window.waitForTimeout(100)

    const passwordInput = window.getByTestId('create-user-password')
    await passwordInput.fill('e2eTestPass123!')
    await window.waitForTimeout(100)

    // Debug: verify the form value was set by checking button is still enabled
    const submitBtn = window.getByTestId('create-user-submit')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })

    // Verify the input actually has the value
    const typedValue = await usernameInput.inputValue()
    if (typedValue !== uniqueUser) {
      // Fallback: use pressSequentially if fill() didn't work
      await usernameInput.click()
      await usernameInput.fill('')
      await usernameInput.pressSequentially(uniqueUser, { delay: 10 })
      await window.waitForTimeout(300)
    }

    await submitBtn.scrollIntoViewIfNeeded()
    await submitBtn.click()

    // Wait for the dialog to close as primary success indicator
    await expect(window.getByTestId('create-user-username')).not.toBeVisible({ timeout: 15_000 })

    // The @created event already triggers loadUsers()
    const usersTable = window.getByTestId('users-table')
    await expect(usersTable).toBeVisible({ timeout: 15_000 })
    await expect(usersTable.locator(`text=${uniqueUser}`)).toBeVisible({ timeout: 10_000 })

    // Delete the user
    const deleteBtn = window.getByTestId(`users-delete-${uniqueUser}`)
    await deleteBtn.click()

    // Confirm deletion
    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    // Wait for the confirm dialog to close
    await expect(confirmBtn).not.toBeVisible({ timeout: 15_000 })

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
    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })
    await usernameInput.click()
    await usernameInput.fill('')
    await usernameInput.pressSequentially(uniqueUser, { delay: 10 })

    const passwordInput = window.getByTestId('create-user-password')
    await passwordInput.click()
    await passwordInput.pressSequentially('e2eTestPass123!', { delay: 10 })
    await window.waitForTimeout(500)

    const submitBtn = window.getByTestId('create-user-submit')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    await expect(window.getByTestId('create-user-username')).not.toBeVisible({ timeout: 15_000 })

    await window.getByTestId('statusbar-users-refresh').click()
    await window.waitForTimeout(2000)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable.locator(`text=${uniqueUser}`)).toBeVisible({ timeout: 10_000 })

    const deleteBtn = window.getByTestId(`users-delete-${uniqueUser}`)
    await deleteBtn.click()

    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    await expect(confirmBtn).not.toBeVisible({ timeout: 15_000 })
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
    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })
    await usernameInput.click()
    await usernameInput.fill('')
    await usernameInput.pressSequentially(uniqueUser, { delay: 10 })

    const passwordInput = window.getByTestId('create-user-password')
    await passwordInput.click()
    await passwordInput.pressSequentially('e2eTestPass123!', { delay: 10 })
    await window.waitForTimeout(500)

    const submitBtn = window.getByTestId('create-user-submit')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    await expect(window.getByTestId('create-user-username')).not.toBeVisible({ timeout: 15_000 })

    await window.getByTestId('statusbar-users-refresh').click()
    await window.waitForTimeout(2000)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable.locator(`text=${uniqueUser}`)).toBeVisible({ timeout: 10_000 })

    const deleteBtn = window.getByTestId(`users-delete-${uniqueUser}`)
    await deleteBtn.click()

    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    await expect(confirmBtn).not.toBeVisible({ timeout: 15_000 })
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
    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })
    await usernameInput.click()
    await usernameInput.fill('')
    await usernameInput.pressSequentially(uniqueUser, { delay: 10 })

    const passwordInput = window.getByTestId('create-user-password')
    await passwordInput.click()
    await passwordInput.pressSequentially('e2eTestPass123!', { delay: 10 })
    await window.waitForTimeout(500)

    const submitBtn = window.getByTestId('create-user-submit')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    await expect(window.getByTestId('create-user-username')).not.toBeVisible({ timeout: 15_000 })

    await window.getByTestId('statusbar-users-refresh').click()
    await window.waitForTimeout(2000)

    await expect(usersTable.locator(`text=${uniqueUser}`)).toBeVisible({ timeout: 10_000 })

    const deleteBtn = window.getByTestId(`users-delete-${uniqueUser}`)
    await deleteBtn.click()

    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    await expect(confirmBtn).not.toBeVisible({ timeout: 15_000 })
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// SQL Server User Management
// ---------------------------------------------------------------------------
test.describe.serial('SQL Server User Management', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open user management view', async () => {
    await connectTo(window, 'sqlserver')

    await openUserManagement(window)
    await waitForUsersTable(window)
    await assertNoErrorToast(window)
  })

  test('create and delete user', async () => {
    await connectTo(window, 'sqlserver')

    await openUserManagement(window)
    await waitForUsersTable(window)

    const createBtn = window.getByTestId('statusbar-users-create')
    await createBtn.click()

    const uniqueUser = `e2e_ss_user_${Date.now()}`
    const usernameInput = window.getByTestId('create-user-username')
    await expect(usernameInput).toBeVisible({ timeout: 5_000 })
    await usernameInput.click()
    await usernameInput.fill('')
    await usernameInput.pressSequentially(uniqueUser, { delay: 10 })

    const passwordInput = window.getByTestId('create-user-password')
    await passwordInput.click()
    await passwordInput.pressSequentially('e2eTestPass123!', { delay: 10 })
    await window.waitForTimeout(500)

    const submitBtn = window.getByTestId('create-user-submit')
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
    await submitBtn.click()

    await expect(window.getByTestId('create-user-username')).not.toBeVisible({ timeout: 15_000 })

    await window.getByTestId('statusbar-users-refresh').click()
    await window.waitForTimeout(2000)

    const usersTable = window.getByTestId('users-table')
    await expect(usersTable.locator(`text=${uniqueUser}`)).toBeVisible({ timeout: 10_000 })

    const deleteBtn = window.getByTestId(`users-delete-${uniqueUser}`)
    await deleteBtn.click()

    const confirmBtn = window.getByTestId('confirm-dialog-confirm')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    await expect(confirmBtn).not.toBeVisible({ timeout: 15_000 })
    await assertNoErrorToast(window)
  })
})
