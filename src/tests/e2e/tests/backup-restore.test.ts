import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const openMoreMenu = async (page: Page): Promise<void> => {
  // Dismiss any open dropdown/dialog/overlay left from a prior test
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const trigger = page.getByTestId('header-more-btn')
  await trigger.click()
}

// ---------------------------------------------------------------------------
// Backup Wizard — SQLite
// ---------------------------------------------------------------------------
test.describe('SQLite Backup Wizard', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'sqlite')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open backup tab from header menu', async () => {
    await openMoreMenu(window)

    const exportBtn = window.getByTestId('header-export-btn')
    await expect(exportBtn).toBeVisible({ timeout: 5_000 })
    await exportBtn.click()

    // Verify step 1 header is visible
    const step1Btn = window.getByTestId('step-1-btn')
    await expect(step1Btn).toBeVisible({ timeout: 10_000 })

    // Verify entity list loads
    const entityList = window.getByTestId('entity-list')
    await expect(entityList).toBeVisible({ timeout: 15_000 })

    // Verify entity count shows
    const entityCount = window.getByTestId('entity-count')
    await expect(entityCount).toBeVisible()
    await expect(entityCount).toContainText('of')

    await assertNoErrorToast(window)
  })

  test('entity selection and deselection', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    // Wait for entities to load
    const entityList = window.getByTestId('entity-list')
    await expect(entityList).toBeVisible({ timeout: 15_000 })

    // By default all entities should be selected
    const entityCount = window.getByTestId('entity-count')
    const countText = await entityCount.textContent()
    const match = countText?.match(/(\d+) of (\d+)/)
    if (match) {
      expect(match[1]).toBe(match[2]) // all selected
    }

    // Deselect all
    await window.getByTestId('deselect-all-btn').click()
    await expect(entityCount).toContainText('0 of')

    // Next button should be disabled when nothing selected
    const nextBtn = window.getByTestId('next-btn')
    await expect(nextBtn).toBeDisabled()

    // Select all
    await window.getByTestId('select-all-btn').click()
    await expect(nextBtn).toBeEnabled()

    await assertNoErrorToast(window)
  })

  test('entity search filter', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Type a search query
    const searchInput = window.getByTestId('entity-search')
    await searchInput.fill('customers')

    // Should filter the list
    await window.waitForTimeout(500)
    const entityList = window.getByTestId('entity-list')
    const labels = entityList.locator('label')
    const count = await labels.count()
    // Should show at least 1 result (customers table)
    expect(count).toBeGreaterThanOrEqual(1)

    // Clear search
    await searchInput.fill('')
    await window.waitForTimeout(500)

    await assertNoErrorToast(window)
  })

  test('navigate to step 2 (configure)', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Click Next
    const nextBtn = window.getByTestId('next-btn')
    await expect(nextBtn).toBeEnabled()
    await nextBtn.click()

    // Step 2 should be visible — check for binary path input
    const binaryInput = window.getByTestId('binary-path-input')
    await expect(binaryInput).toBeVisible({ timeout: 10_000 })

    // Output path should be visible
    const outputInput = window.getByTestId('output-path-input')
    await expect(outputInput).toBeVisible()

    // Compress checkbox should exist
    const compressCheckbox = window.getByTestId('compress-checkbox')
    await expect(compressCheckbox).toBeVisible()

    // Custom args input should exist
    const customArgsInput = window.getByTestId('custom-args-input')
    await expect(customArgsInput).toBeVisible()

    await assertNoErrorToast(window)

    // Close the backup tab so the next test gets a fresh wizard starting at step 1
    await window.keyboard.press('Meta+w')
    await window.waitForTimeout(1_000)
  })

  test('back button navigates to previous step', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    // Wait for step 1 entity list (fresh wizard after tab was closed)
    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 20_000 })

    // Go to step 2
    await window.getByTestId('next-btn').click()
    await expect(window.getByTestId('binary-path-input')).toBeVisible({ timeout: 10_000 })

    // Go back to step 1
    await window.getByTestId('back-btn').click()
    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('step 2 next button disabled without output path and binary', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Go to step 2
    await window.getByTestId('next-btn').click()
    await expect(window.getByTestId('binary-path-input')).toBeVisible({ timeout: 10_000 })

    // Next button should be disabled (no output path)
    const nextBtn = window.getByTestId('next-btn')
    await expect(nextBtn).toBeDisabled()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Backup Wizard — PostgreSQL
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Backup Wizard', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('load entities with schema groups', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    // Wait for entities to load
    const entityList = window.getByTestId('entity-list')
    await expect(entityList).toBeVisible({ timeout: 15_000 })

    // PostgreSQL should show schema-grouped view with "public" schema
    await expect(entityList.getByText('public')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('step 2 shows PostgreSQL-specific options', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Go to step 2
    await window.getByTestId('next-btn').click()

    // Should show PostgreSQL options like "no-owner", "verbose", etc.
    await expect(window.getByText('Do not output ownership commands')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Verbose mode')).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Backup Wizard — MySQL
// ---------------------------------------------------------------------------
test.describe('MySQL Backup Wizard', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'mysql')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('step 2 shows MySQL-specific options', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Go to step 2
    await window.getByTestId('next-btn').click()

    // Should show MySQL options
    await expect(window.getByText('Use single transaction')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('Include triggers')).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Restore Wizard — SQLite
// ---------------------------------------------------------------------------
test.describe('SQLite Restore Wizard', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'sqlite')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('open restore tab from header menu', async () => {
    await openMoreMenu(window)

    const importBtn = window.getByTestId('header-import-btn')
    await expect(importBtn).toBeVisible({ timeout: 5_000 })
    await importBtn.click()

    // Step 1 should show input path and binary path
    const step1Btn = window.getByTestId('step-1-btn')
    await expect(step1Btn).toBeVisible({ timeout: 10_000 })

    const inputPath = window.getByTestId('input-path-input')
    await expect(inputPath).toBeVisible({ timeout: 5_000 })

    const binaryPath = window.getByTestId('binary-path-input')
    await expect(binaryPath).toBeVisible()

    // Auto-detect button should be present
    const autoDetectBtn = window.getByTestId('auto-detect-btn')
    await expect(autoDetectBtn).toBeVisible()

    await assertNoErrorToast(window)
  })

  test('next button disabled without input path and binary', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    await expect(window.getByTestId('input-path-input')).toBeVisible({ timeout: 10_000 })

    // Next button should be disabled
    const nextBtn = window.getByTestId('next-btn')
    await expect(nextBtn).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('custom args input is available', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    await expect(window.getByTestId('input-path-input')).toBeVisible({ timeout: 10_000 })

    const customArgs = window.getByTestId('custom-args-input')
    await expect(customArgs).toBeVisible()

    // Type something
    await customArgs.fill('--bail')
    await expect(customArgs).toHaveValue('--bail')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Restore Wizard — PostgreSQL
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Restore Wizard', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'postgres')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('shows PostgreSQL restore options', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    await expect(window.getByTestId('input-path-input')).toBeVisible({ timeout: 10_000 })

    // PostgreSQL restore options should be visible
    await expect(window.getByText('Do not restore ownership')).toBeVisible()
    await expect(window.getByText('Verbose mode')).toBeVisible()
    await expect(window.getByText('Restore as a single transaction')).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Restore Wizard — MongoDB
// ---------------------------------------------------------------------------
test.describe('MongoDB Restore Wizard', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'mongodb')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('shows directory checkbox for MongoDB', async () => {
    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    await expect(window.getByTestId('input-path-input')).toBeVisible({ timeout: 10_000 })

    // MongoDB should show directory checkbox
    const directoryCheckbox = window.getByTestId('is-directory-checkbox')
    await expect(directoryCheckbox).toBeVisible()
    await expect(window.getByText('Input is a directory (mongodump output)')).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Deduplication
// ---------------------------------------------------------------------------
test.describe('Backup/Restore Tab Deduplication', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    await connectTo(window, 'sqlite')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('opening backup twice reuses the same tab', async () => {
    // Open backup tab
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()
    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Count tabs
    const tabsBefore = await window.locator('[data-testid^="tab-"]').count()

    // Open backup again — should reuse existing tab
    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()
    await window.waitForTimeout(500)

    const tabsAfter = await window.locator('[data-testid^="tab-"]').count()
    expect(tabsAfter).toBe(tabsBefore)

    await assertNoErrorToast(window)
  })

  test('opening restore twice reuses the same tab', async () => {
    // Open restore tab
    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()
    await expect(window.getByTestId('input-path-input')).toBeVisible({ timeout: 10_000 })

    // Count tabs
    const tabsBefore = await window.locator('[data-testid^="tab-"]').count()

    // Open restore again — should reuse existing tab
    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()
    await window.waitForTimeout(500)

    const tabsAfter = await window.locator('[data-testid^="tab-"]').count()
    expect(tabsAfter).toBe(tabsBefore)

    await assertNoErrorToast(window)
  })
})
