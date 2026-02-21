import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'

let app: ElectronApplication
let window: Page

test.describe.serial('Connection Form Validation', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('connect button disabled when fields are empty', async () => {
    const connectBtn = window.getByTestId('connection-connect-btn')
    await expect(connectBtn).toBeVisible({ timeout: 10_000 })
    await expect(connectBtn).toBeDisabled()
  })

  test('PostgreSQL: host, port, and database fields required', async () => {
    const typeBtn = window.getByTestId('database-type-trigger')
    await typeBtn.click()
    await window.getByTestId('database-type-option-postgresql').click()

    await expect(window.getByTestId('connection-host')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('connection-port')).toBeVisible()
    await expect(window.getByTestId('connection-database')).toBeVisible()
    await expect(window.getByTestId('connection-username')).toBeVisible()
    await expect(window.getByTestId('connection-password')).toBeVisible()
  })

  test('MySQL: host, port, and database fields required', async () => {
    const typeBtn = window.getByTestId('database-type-trigger')
    await typeBtn.click()
    await window.getByTestId('database-type-option-mysql').click()

    await expect(window.getByTestId('connection-host')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('connection-port')).toBeVisible()
    await expect(window.getByTestId('connection-database')).toBeVisible()
  })

  test('SQLite: filepath field required', async () => {
    const typeBtn = window.getByTestId('database-type-trigger')
    await typeBtn.click()
    await window.getByTestId('database-type-option-sqlite').click()

    await expect(window.getByTestId('connection-filepath')).toBeVisible({ timeout: 5_000 })
    // Host/port should not be visible for SQLite
    await expect(window.getByTestId('connection-host')).not.toBeVisible()
  })

  test('DuckDB: filepath field required', async () => {
    const typeBtn = window.getByTestId('database-type-trigger')
    await typeBtn.click()
    await window.getByTestId('database-type-option-duckdb').click()

    await expect(window.getByTestId('connection-filepath')).toBeVisible({ timeout: 5_000 })
    await expect(window.getByTestId('connection-host')).not.toBeVisible()
  })

  test('MongoDB: URI field visible', async () => {
    const typeBtn = window.getByTestId('database-type-trigger')
    await typeBtn.click()
    await window.getByTestId('database-type-option-mongodb').click()

    await expect(window.getByTestId('connection-uri')).toBeVisible({ timeout: 5_000 })
  })

  test('SSL toggle shows SSL options', async () => {
    const typeBtn = window.getByTestId('database-type-trigger')
    await typeBtn.click()
    await window.getByTestId('database-type-option-postgresql').click()

    const sslSwitch = window.getByTestId('connection-ssl-switch')
    await expect(sslSwitch).toBeVisible({ timeout: 5_000 })
    await sslSwitch.click()
    await window.waitForTimeout(500)
  })

  test('SQL Server: trust certificate checkbox visible', async () => {
    const typeBtn = window.getByTestId('database-type-trigger')
    await typeBtn.click()
    await window.getByTestId('database-type-option-sqlserver').click()

    await expect(window.getByTestId('connection-trust-cert')).toBeVisible({ timeout: 5_000 })
  })

  test('test connection with bad credentials shows error', async () => {
    const typeBtn = window.getByTestId('database-type-trigger')
    await typeBtn.click()
    await window.getByTestId('database-type-option-postgresql').click()

    await window.getByTestId('connection-host').fill('localhost')
    await window.getByTestId('connection-port').fill('5432')
    await window.getByTestId('connection-username').fill('invalid_user')
    await window.getByTestId('connection-password').fill('invalid_password')
    await window.getByTestId('connection-database').fill('nonexistent_db')

    const testBtn = window.getByTestId('connection-test-btn')
    await expect(testBtn).toBeEnabled()
    await testBtn.click()

    await expect(window.getByTestId('connection-test-error')).toBeVisible({ timeout: 15_000 })
  })

  test('connect button becomes enabled when required fields filled', async () => {
    const typeBtn = window.getByTestId('database-type-trigger')
    await typeBtn.click()
    await window.getByTestId('database-type-option-postgresql').click()

    await window.getByTestId('connection-host').fill('localhost')
    await window.getByTestId('connection-port').fill('5432')
    await window.getByTestId('connection-database').fill('testdb')

    const connectBtn = window.getByTestId('connection-connect-btn')
    await expect(connectBtn).toBeEnabled()
  })
})
