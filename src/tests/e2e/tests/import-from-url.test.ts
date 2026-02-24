import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

// ---------------------------------------------------------------------------
// Import from URL – Dialog Basics
// ---------------------------------------------------------------------------
test.describe.serial('Import from URL - Dialog', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Import from URL button is visible on home view', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('clicking Import from URL opens the dialog', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const dialog = window.getByTestId('import-url-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    const urlInput = window.getByTestId('import-url-input')
    await expect(urlInput).toBeVisible()

    const importSubmit = window.getByTestId('import-url-import-btn')
    await expect(importSubmit).toBeVisible()
    await expect(importSubmit).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('cancel button closes the dialog', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const dialog = window.getByTestId('import-url-dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    const cancelBtn = window.getByTestId('import-url-cancel-btn')
    await cancelBtn.click()

    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('invalid URL shows error message', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const urlInput = window.getByTestId('import-url-input')
    await expect(urlInput).toBeVisible({ timeout: 5_000 })
    await urlInput.fill('not-a-valid-url')

    const error = window.getByTestId('import-url-error')
    await expect(error).toBeVisible({ timeout: 5_000 })

    const importSubmit = window.getByTestId('import-url-import-btn')
    await expect(importSubmit).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('unsupported scheme shows error', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const urlInput = window.getByTestId('import-url-input')
    await urlInput.fill('ftp://localhost/file')

    const error = window.getByTestId('import-url-error')
    await expect(error).toBeVisible({ timeout: 5_000 })
    await expect(error).toContainText('Unsupported scheme')

    await assertNoErrorToast(window)
  })

  test('valid URL enables Import button', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const urlInput = window.getByTestId('import-url-input')
    await urlInput.fill('postgresql://user:pass@host:5432/db')

    const importSubmit = window.getByTestId('import-url-import-btn')
    await expect(importSubmit).toBeEnabled({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Import from URL – Form Population
// ---------------------------------------------------------------------------
test.describe.serial('Import from URL - Form Population', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('importing PostgreSQL URL populates the connection form', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const urlInput = window.getByTestId('import-url-input')
    await urlInput.fill('postgresql://admin:secret@db.example.com:5432/myapp')

    const importSubmit = window.getByTestId('import-url-import-btn')
    await expect(importSubmit).toBeEnabled({ timeout: 5_000 })
    await importSubmit.click()

    // Dialog should close
    await expect(window.getByTestId('import-url-dialog')).not.toBeVisible({ timeout: 5_000 })

    // Connection form should now be populated
    await expect(window.getByTestId('connection-host')).toHaveValue('db.example.com', { timeout: 5_000 })
    await expect(window.getByTestId('connection-port')).toHaveValue('5432')
    await expect(window.getByTestId('connection-database')).toHaveValue('myapp')
    await expect(window.getByTestId('connection-username')).toHaveValue('admin')

    await assertNoErrorToast(window)
  })

  test('importing postgres:// alias populates form as PostgreSQL', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const urlInput = window.getByTestId('import-url-input')
    await urlInput.fill('postgres://user:pass@myhost:5432/mydb')

    const importSubmit = window.getByTestId('import-url-import-btn')
    await expect(importSubmit).toBeEnabled({ timeout: 5_000 })
    await importSubmit.click()

    await expect(window.getByTestId('import-url-dialog')).not.toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('connection-host')).toHaveValue('myhost', { timeout: 5_000 })
    await expect(window.getByTestId('connection-database')).toHaveValue('mydb')

    await assertNoErrorToast(window)
  })

  test('importing PostgreSQL URL with SSL populates form with SSL enabled', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const urlInput = window.getByTestId('import-url-input')
    await urlInput.fill('postgresql://admin:secret@db.example.com:5432/myapp?sslmode=require')

    const importSubmit = window.getByTestId('import-url-import-btn')
    await expect(importSubmit).toBeEnabled({ timeout: 5_000 })
    await importSubmit.click()

    await expect(window.getByTestId('import-url-dialog')).not.toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('connection-host')).toHaveValue('db.example.com', { timeout: 5_000 })

    // SSL switch should be enabled (checked state)
    const sslSwitch = window.getByTestId('connection-ssl-switch')
    await expect(sslSwitch).toBeVisible({ timeout: 5_000 })
    await expect(sslSwitch).toHaveAttribute('data-state', 'checked')

    await assertNoErrorToast(window)
  })

  test('importing MySQL URL populates the connection form', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const urlInput = window.getByTestId('import-url-input')
    await urlInput.fill('mysql://root:password@127.0.0.1:3306/production')

    const importSubmit = window.getByTestId('import-url-import-btn')
    await expect(importSubmit).toBeEnabled({ timeout: 5_000 })
    await importSubmit.click()

    await expect(window.getByTestId('import-url-dialog')).not.toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('connection-host')).toHaveValue('127.0.0.1', { timeout: 5_000 })
    await expect(window.getByTestId('connection-port')).toHaveValue('3306')
    await expect(window.getByTestId('connection-database')).toHaveValue('production')
    await expect(window.getByTestId('connection-username')).toHaveValue('root')

    await assertNoErrorToast(window)
  })

  test('importing rediss:// URL populates form with Redis type and SSL enabled', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const urlInput = window.getByTestId('import-url-input')
    await urlInput.fill('rediss://:mypassword@cache.example.com:6380/0')

    const importSubmit = window.getByTestId('import-url-import-btn')
    await expect(importSubmit).toBeEnabled({ timeout: 5_000 })
    await importSubmit.click()

    await expect(window.getByTestId('import-url-dialog')).not.toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('connection-host')).toHaveValue('cache.example.com', { timeout: 5_000 })
    await expect(window.getByTestId('connection-port')).toHaveValue('6380')

    // SSL switch should be enabled
    const sslSwitch = window.getByTestId('connection-ssl-switch')
    await expect(sslSwitch).toBeVisible({ timeout: 5_000 })
    await expect(sslSwitch).toHaveAttribute('data-state', 'checked')

    await assertNoErrorToast(window)
  })

  test('importing SQL Server URL with encrypt populates form with SSL enabled', async () => {
    const importBtn = window.getByTestId('import-from-url-btn')
    await expect(importBtn).toBeVisible({ timeout: 10_000 })
    await importBtn.click()

    const urlInput = window.getByTestId('import-url-input')
    await urlInput.fill('mssql://sa:pass@db-host:1433/mydb?encrypt=true&trustServerCertificate=true')

    const importSubmit = window.getByTestId('import-url-import-btn')
    await expect(importSubmit).toBeEnabled({ timeout: 5_000 })
    await importSubmit.click()

    await expect(window.getByTestId('import-url-dialog')).not.toBeVisible({ timeout: 5_000 })

    await expect(window.getByTestId('connection-host')).toHaveValue('db-host', { timeout: 5_000 })
    await expect(window.getByTestId('connection-port')).toHaveValue('1433')
    await expect(window.getByTestId('connection-database')).toHaveValue('mydb')

    // SSL switch should be enabled
    const sslSwitch = window.getByTestId('connection-ssl-switch')
    await expect(sslSwitch).toBeVisible({ timeout: 5_000 })
    await expect(sslSwitch).toHaveAttribute('data-state', 'checked')

    // Trust server certificate should be checked
    const trustCert = window.getByTestId('connection-trust-cert')
    await expect(trustCert).toBeChecked()

    await assertNoErrorToast(window)
  })
})
