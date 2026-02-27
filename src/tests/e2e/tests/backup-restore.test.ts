import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let app: ElectronApplication
let window: Page

const E2E_BACKUP_DIR = join(tmpdir(), 'zequel-e2e-backup')

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.getByTestId('header-more-menu-btn')
  await trigger.click()
}

// ---------------------------------------------------------------------------
// Backup Wizard — SQLite
// ---------------------------------------------------------------------------
test.describe('SQLite Backup Wizard', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open backup tab from header menu', async () => {
    await connectTo(window, 'sqlite')

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
    await connectTo(window, 'sqlite')

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
    await connectTo(window, 'sqlite')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Type a search query
    const searchInput = window.getByTestId('entity-search')
    await searchInput.fill('customers')

    // Should filter the list
    await window.waitForTimeout(500)
    const entityList = window.getByTestId('entity-list')
    const entityItems = entityList.locator('[data-testid^="entity-item-"]')
    const count = await entityItems.count()
    // Should show at least 1 result (customers table)
    expect(count).toBeGreaterThanOrEqual(1)

    // Clear search
    await searchInput.fill('')
    await window.waitForTimeout(500)

    await assertNoErrorToast(window)
  })

  test('navigate to step 2 (configure)', async () => {
    await connectTo(window, 'sqlite')

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
  })

  test('back button navigates to previous step', async () => {
    await connectTo(window, 'sqlite')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Go to step 2
    await window.getByTestId('next-btn').click()
    await expect(window.getByTestId('binary-path-input')).toBeVisible({ timeout: 10_000 })

    // Go back to step 1
    await window.getByTestId('back-btn').click()
    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('step 2 next button disabled without output path and binary', async () => {
    await connectTo(window, 'sqlite')

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
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('load entities with schema groups', async () => {
    await connectTo(window, 'postgres')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    // Wait for entities to load
    const entityList = window.getByTestId('entity-list')
    await expect(entityList).toBeVisible({ timeout: 15_000 })

    // PostgreSQL should show schema-grouped view with "public" schema
    await expect(window.getByTestId('entity-schema-public')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('step 2 shows PostgreSQL-specific options', async () => {
    await connectTo(window, 'postgres')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Go to step 2
    await window.getByTestId('next-btn').click()

    // Should show PostgreSQL options like "no-owner", "verbose", etc.
    await expect(window.getByTestId('backup-option-no-owner')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('backup-option-verbose')).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Backup Wizard — MySQL
// ---------------------------------------------------------------------------
test.describe('MySQL Backup Wizard', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('step 2 shows MySQL-specific options', async () => {
    await connectTo(window, 'mysql')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    await expect(window.getByTestId('entity-list')).toBeVisible({ timeout: 15_000 })

    // Go to step 2
    await window.getByTestId('next-btn').click()

    // Should show MySQL options
    await expect(window.getByTestId('backup-option-single-transaction')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('backup-option-triggers')).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Backup Wizard — SQL Server
// ---------------------------------------------------------------------------
test.describe('SQL Server Backup Wizard', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('load entities with schema groups', async () => {
    await connectTo(window, 'sqlserver')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    // Wait for entities to load
    const entityList = window.getByTestId('entity-list')
    await expect(entityList).toBeVisible({ timeout: 15_000 })

    // SQL Server should show schema-grouped view with "dbo" schema
    await expect(window.getByTestId('entity-schema-dbo')).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Restore Wizard — SQLite
// ---------------------------------------------------------------------------
test.describe('SQLite Restore Wizard', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open restore tab from header menu', async () => {
    await connectTo(window, 'sqlite')

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
    await connectTo(window, 'sqlite')

    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    await expect(window.getByTestId('input-path-input')).toBeVisible({ timeout: 10_000 })

    // Next button should be disabled
    const nextBtn = window.getByTestId('next-btn')
    await expect(nextBtn).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('custom args input is available', async () => {
    await connectTo(window, 'sqlite')

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
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('shows PostgreSQL restore options', async () => {
    await connectTo(window, 'postgres')

    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    await expect(window.getByTestId('input-path-input')).toBeVisible({ timeout: 10_000 })

    // PostgreSQL restore options should be visible
    await expect(window.getByTestId('restore-option-single-transaction')).toBeVisible({ timeout: 10_000 })
    await expect(window.getByTestId('restore-option-verbose')).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Restore Wizard — MongoDB
// ---------------------------------------------------------------------------
test.describe('MongoDB Restore Wizard', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('shows directory checkbox for MongoDB', async () => {
    await connectTo(window, 'mongodb')

    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    await expect(window.getByTestId('input-path-input')).toBeVisible({ timeout: 10_000 })

    // MongoDB should show directory checkbox
    const directoryCheckbox = window.getByTestId('is-directory-checkbox')
    await expect(directoryCheckbox).toBeVisible()
    await expect(window.getByTestId('is-directory-checkbox')).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Tab Deduplication
// ---------------------------------------------------------------------------
test.describe('Backup/Restore Tab Deduplication', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('opening backup twice reuses the same tab', async () => {
    await connectTo(window, 'sqlite')

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
    await connectTo(window, 'sqlite')

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

// ---------------------------------------------------------------------------
// Helpers — Backup/Restore Execution
// ---------------------------------------------------------------------------

/**
 * Navigate the backup wizard through all 3 steps and execute a backup.
 * Returns the output file path used.
 */
const executeBackupWizard = async (
  page: Page,
  outputPath: string,
  options?: { deselectAll?: boolean; selectEntity?: string }
): Promise<void> => {
  // Step 1 — Entities
  const entityList = page.getByTestId('entity-list')
  await expect(entityList).toBeVisible({ timeout: 15_000 })

  if (options?.deselectAll) {
    await page.getByTestId('deselect-all-btn').click()
    await expect(page.getByTestId('entity-count')).toContainText('0 of')
  }

  if (options?.selectEntity) {
    const entityItem = page.getByTestId(`entity-item-${options.selectEntity}`)
    await entityItem.click()
  }

  // Go to Step 2 — Configure
  const nextBtn = page.getByTestId('next-btn')
  await expect(nextBtn).toBeEnabled()
  await nextBtn.click()

  // Wait for auto-detect to populate binary path
  const binaryInput = page.getByTestId('binary-path-input')
  await expect(binaryInput).toBeVisible({ timeout: 10_000 })
  await expect(binaryInput).not.toHaveValue('', { timeout: 15_000 })

  // Fill output path
  const outputInput = page.getByTestId('output-path-input')
  await outputInput.fill(outputPath)

  // Go to Step 3 — Execute
  const nextBtn2 = page.getByTestId('next-btn')
  await expect(nextBtn2).toBeEnabled()
  await nextBtn2.click()

  // Verify command preview has content
  const commandPreview = page.getByTestId('command-preview')
  await expect(commandPreview).toBeVisible({ timeout: 10_000 })
  await expect(commandPreview).not.toHaveText('')

  // Execute
  const executeBtn = page.getByTestId('execute-btn')
  await expect(executeBtn).toBeEnabled({ timeout: 5_000 })
  await executeBtn.click()

  // Wait for success
  const statusBanner = page.getByTestId('status-banner')
  await expect(statusBanner).toContainText('completed successfully', { timeout: 60_000 })
}

/**
 * Navigate the restore wizard through all 2 steps and execute a restore.
 * When `expectSuccess` is false, only asserts the status banner appears
 * (the restore process ran to completion) without checking the text.
 * Restoring to a populated DB may legitimately fail with constraint errors.
 */
const executeRestoreWizard = async (
  page: Page,
  inputPath: string,
  options?: { expectSuccess?: boolean }
): Promise<void> => {
  const expectSuccess = options?.expectSuccess ?? true

  // Step 1 — Configure Restore
  const inputPathInput = page.getByTestId('input-path-input')
  await expect(inputPathInput).toBeVisible({ timeout: 10_000 })

  // Fill input path
  await inputPathInput.fill(inputPath)

  // Wait for auto-detect to populate binary path
  const binaryInput = page.getByTestId('binary-path-input')
  await expect(binaryInput).not.toHaveValue('', { timeout: 15_000 })

  // Go to Step 2 — Review & Execute
  const nextBtn = page.getByTestId('next-btn')
  await expect(nextBtn).toBeEnabled()
  await nextBtn.click()

  // Verify command preview has content
  const commandPreview = page.getByTestId('command-preview')
  await expect(commandPreview).toBeVisible({ timeout: 10_000 })
  await expect(commandPreview).not.toHaveText('')

  // Execute
  const executeBtn = page.getByTestId('execute-btn')
  await expect(executeBtn).toBeEnabled({ timeout: 5_000 })
  await executeBtn.click()

  // Wait for the restore process to finish (status banner appears)
  const statusBanner = page.getByTestId('status-banner')
  await expect(statusBanner).toBeVisible({ timeout: 60_000 })

  if (expectSuccess) {
    await expect(statusBanner).toContainText('completed successfully', { timeout: 5_000 })
  }
}

// ---------------------------------------------------------------------------
// Backup Execution — SQLite
// ---------------------------------------------------------------------------
test.describe('SQLite Backup Execution', () => {
  test.beforeAll(() => {
    if (!existsSync(E2E_BACKUP_DIR)) {
      mkdirSync(E2E_BACKUP_DIR, { recursive: true })
    }
  })

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('execute full database backup', async () => {
    await connectTo(window, 'sqlite')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    const outputPath = join(E2E_BACKUP_DIR, 'sqlite-full-backup.sql')
    await executeBackupWizard(window, outputPath)

    await assertNoErrorToast(window)

    // Verify the backup file was created
    expect(existsSync(outputPath)).toBe(true)
  })

  test('execute single-table backup', async () => {
    await connectTo(window, 'sqlite')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    const outputPath = join(E2E_BACKUP_DIR, 'sqlite-customers-backup.sql')
    await executeBackupWizard(window, outputPath, {
      deselectAll: true,
      selectEntity: 'customers',
    })

    await assertNoErrorToast(window)

    expect(existsSync(outputPath)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Restore Execution — SQLite
// ---------------------------------------------------------------------------
test.describe('SQLite Restore Execution', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('execute restore from backup file', async () => {
    const backupPath = join(E2E_BACKUP_DIR, 'sqlite-full-backup.sql')

    // Skip if backup file doesn't exist (backup test must run first)
    test.skip(!existsSync(backupPath), 'SQLite backup file not found — run backup tests first')

    await connectTo(window, 'sqlite')

    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    // Restoring to the same populated DB causes expected UNIQUE constraint errors.
    // We only assert the process runs to completion (status banner appears).
    await executeRestoreWizard(window, backupPath, { expectSuccess: false })

    // Verify the output log shows the restore was attempted
    const outputLog = window.getByTestId('output-log')
    await expect(outputLog).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Backup Execution — PostgreSQL
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Backup Execution', () => {
  test.beforeAll(() => {
    if (!existsSync(E2E_BACKUP_DIR)) {
      mkdirSync(E2E_BACKUP_DIR, { recursive: true })
    }
  })

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('execute full database backup', async () => {
    await connectTo(window, 'postgres')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    const outputPath = join(E2E_BACKUP_DIR, 'postgres-full-backup.sql')
    await executeBackupWizard(window, outputPath)

    await assertNoErrorToast(window)

    expect(existsSync(outputPath)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Restore Execution — PostgreSQL
// ---------------------------------------------------------------------------
test.describe('PostgreSQL Restore Execution', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('execute restore from backup file', async () => {
    const backupPath = join(E2E_BACKUP_DIR, 'postgres-full-backup.sql')

    test.skip(!existsSync(backupPath), 'PostgreSQL backup file not found — run backup tests first')

    await connectTo(window, 'postgres')

    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    // Restoring to the same populated DB may cause "already exists" errors.
    await executeRestoreWizard(window, backupPath, { expectSuccess: false })

    const outputLog = window.getByTestId('output-log')
    await expect(outputLog).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Backup Execution — MySQL
// ---------------------------------------------------------------------------
test.describe('MySQL Backup Execution', () => {
  test.beforeAll(() => {
    if (!existsSync(E2E_BACKUP_DIR)) {
      mkdirSync(E2E_BACKUP_DIR, { recursive: true })
    }
  })

  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('execute full database backup', async () => {
    await connectTo(window, 'mysql')

    await openMoreMenu(window)
    await window.getByTestId('header-export-btn').click()

    const outputPath = join(E2E_BACKUP_DIR, 'mysql-full-backup.sql')
    await executeBackupWizard(window, outputPath)

    await assertNoErrorToast(window)

    expect(existsSync(outputPath)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Restore Execution — MySQL
// ---------------------------------------------------------------------------
test.describe('MySQL Restore Execution', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('execute restore from backup file', async () => {
    const backupPath = join(E2E_BACKUP_DIR, 'mysql-full-backup.sql')

    test.skip(!existsSync(backupPath), 'MySQL backup file not found — run backup tests first')

    await connectTo(window, 'mysql')

    await openMoreMenu(window)
    await window.getByTestId('header-import-btn').click()

    // Restoring to the same populated DB may cause "already exists" errors.
    await executeRestoreWizard(window, backupPath, { expectSuccess: false })

    const outputLog = window.getByTestId('output-log')
    await expect(outputLog).toBeVisible()

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Cleanup — Remove temp backup directory
// ---------------------------------------------------------------------------
test.describe('Backup/Restore Execution Cleanup', () => {
  test('clean up temp backup directory', () => {
    if (existsSync(E2E_BACKUP_DIR)) {
      rmSync(E2E_BACKUP_DIR, { recursive: true, force: true })
    }
    expect(existsSync(E2E_BACKUP_DIR)).toBe(false)
  })
})
