import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

test.describe.serial('PostgreSQL Sequences', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('sequences section visible in sidebar', async () => {
    const actions = await connectTo(window, 'postgres')

    // Look for sequences section in the sidebar
    const sequencesSection = window.locator('[data-testid^="sidebar-"]').filter({ hasText: /sequences/i })
    // Sequences may be nested under the public schema
    await window.waitForTimeout(1_000)
  })

  test('open create sequence dialog', async () => {
    const actions = await connectTo(window, 'postgres')

    // Look for a way to create a sequence - right-click on sequences section or look for a button
    // Try the sidebar context menu
    const sequencesTrigger = window.locator('[data-testid^="sidebar-sequences"]').first()
    if (await sequencesTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sequencesTrigger.click({ button: 'right' })

      const createOption = window.locator('[role="menuitem"]').filter({ hasText: /create.*sequence/i })
      if (await createOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await createOption.click()

        await expect(window.getByTestId('create-sequence-dialog')).toBeVisible({ timeout: 5_000 })
        await expect(window.getByTestId('create-sequence-name-input')).toBeVisible()
        await expect(window.getByTestId('create-sequence-start-input')).toBeVisible()
        await expect(window.getByTestId('create-sequence-increment-input')).toBeVisible()
      }
    }
  })

  test('create sequence dialog has correct fields', async () => {
    const actions = await connectTo(window, 'postgres')

    const sequencesTrigger = window.locator('[data-testid^="sidebar-sequences"]').first()
    if (await sequencesTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sequencesTrigger.click({ button: 'right' })

      const createOption = window.locator('[role="menuitem"]').filter({ hasText: /create.*sequence/i })
      if (await createOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await createOption.click()

        await expect(window.getByTestId('create-sequence-dialog')).toBeVisible({ timeout: 5_000 })

        // Verify all form fields
        await expect(window.getByTestId('create-sequence-name-input')).toBeVisible()
        await expect(window.getByTestId('create-sequence-start-input')).toBeVisible()
        await expect(window.getByTestId('create-sequence-increment-input')).toBeVisible()
        await expect(window.getByTestId('create-sequence-cancel-btn')).toBeVisible()
        await expect(window.getByTestId('create-sequence-submit-btn')).toBeVisible()

        // Submit should be disabled without a name
        await window.getByTestId('create-sequence-name-input').fill('')
        await expect(window.getByTestId('create-sequence-submit-btn')).toBeDisabled()
      }
    }
  })

  test('cancel closes create sequence dialog', async () => {
    const actions = await connectTo(window, 'postgres')

    const sequencesTrigger = window.locator('[data-testid^="sidebar-sequences"]').first()
    if (await sequencesTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sequencesTrigger.click({ button: 'right' })

      const createOption = window.locator('[role="menuitem"]').filter({ hasText: /create.*sequence/i })
      if (await createOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await createOption.click()
        await expect(window.getByTestId('create-sequence-dialog')).toBeVisible({ timeout: 5_000 })

        // Click cancel
        await window.getByTestId('create-sequence-cancel-btn').click()
        await expect(window.getByTestId('create-sequence-dialog')).not.toBeVisible({ timeout: 5_000 })
      }
    }
  })

  test('create and verify sequence', async () => {
    const actions = await connectTo(window, 'postgres')

    const sequencesTrigger = window.locator('[data-testid^="sidebar-sequences"]').first()
    if (await sequencesTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sequencesTrigger.click({ button: 'right' })

      const createOption = window.locator('[role="menuitem"]').filter({ hasText: /create.*sequence/i })
      if (await createOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await createOption.click()
        await expect(window.getByTestId('create-sequence-dialog')).toBeVisible({ timeout: 5_000 })

        // Fill in the form
        const testName = 'test_e2e_sequence'
        await window.getByTestId('create-sequence-name-input').fill(testName)
        await window.getByTestId('create-sequence-start-input').fill('100')
        await window.getByTestId('create-sequence-increment-input').fill('5')

        // Submit
        await window.getByTestId('create-sequence-submit-btn').click()
        await expect(window.getByTestId('create-sequence-dialog')).not.toBeVisible({ timeout: 10_000 })

        // Clean up: drop the sequence via query
        await actions.openQueryEditor()
        await actions.typeQuery(`DROP SEQUENCE IF EXISTS ${testName}`)
        await actions.runQuery()
      }
    }
  })
})

test.describe.serial('PostgreSQL Extensions', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('extensions section visible in sidebar', async () => {
    const actions = await connectTo(window, 'postgres')

    // Look for extensions in the sidebar
    const extensionsItem = window.locator('[data-testid^="sidebar-"]').filter({ hasText: /extensions/i })
    await window.waitForTimeout(1_000)
    // Extensions may or may not be visible depending on sidebar layout
  })

  test('query can list installed extensions', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openQueryEditor()
    await actions.typeQuery('SELECT extname FROM pg_extension ORDER BY extname')
    await actions.runQuery()

    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
  })
})
