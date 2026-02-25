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

/**
 * Opens the View Editor dialog by right-clicking an existing view in the
 * sidebar and selecting "Edit View" from the context menu.
 *
 * For PostgreSQL the view lives under public > Views.  After `connectTo`
 * the "public" schema is already expanded.
 */
const openViewEditorViaSidebar = async (page: Page, viewName: string): Promise<void> => {
  const viewItem = page.getByTestId(`sidebar-table-${viewName}`)
  await expect(viewItem).toBeVisible({ timeout: 15_000 })
  await viewItem.click({ button: 'right' })

  // Wait for the context menu and click "Edit View"
  const editViewItem = page.locator('[role="menuitem"]', { hasText: 'Edit View' })
  await expect(editViewItem).toBeVisible({ timeout: 5_000 })
  await editViewItem.click()

  // Wait for the dialog to appear
  await expect(page.getByTestId('view-editor-dialog')).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// PostgreSQL View Editor (~8 tests)
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL View Editor', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open edit view dialog from context menu', async () => {
    await connectTo(window, 'postgres')

    await openViewEditorViaSidebar(window, 'customer_order_summary')

    // Verify the dialog is visible
    await expect(window.getByTestId('view-editor-dialog')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })

  test('name input is pre-filled and disabled in edit mode', async () => {
    await connectTo(window, 'postgres')

    await openViewEditorViaSidebar(window, 'customer_order_summary')

    const nameInput = window.getByTestId('view-editor-name-input')
    await expect(nameInput).toBeVisible({ timeout: 10_000 })

    // In edit mode the name input should contain the existing view name
    await expect(nameInput).toHaveValue('customer_order_summary')

    // In edit mode the name input should be disabled
    await expect(nameInput).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('SELECT statement textarea is pre-filled in edit mode', async () => {
    await connectTo(window, 'postgres')

    await openViewEditorViaSidebar(window, 'customer_order_summary')

    const selectInput = window.getByTestId('view-editor-select-input')
    await expect(selectInput).toBeVisible({ timeout: 10_000 })

    // The textarea should contain the SELECT statement from the existing view DDL
    const value = await selectInput.inputValue()
    expect(value.length).toBeGreaterThan(0)

    await assertNoErrorToast(window)
  })

  test('submit button is enabled when name and SELECT are populated', async () => {
    await connectTo(window, 'postgres')

    await openViewEditorViaSidebar(window, 'customer_order_summary')

    const submitBtn = window.getByTestId('view-editor-submit-btn')
    await expect(submitBtn).toBeVisible({ timeout: 10_000 })

    // In edit mode both fields are pre-filled, so submit should be enabled
    await expect(submitBtn).toBeEnabled()

    await assertNoErrorToast(window)
  })

  test('submit button is disabled when SELECT statement is cleared', async () => {
    await connectTo(window, 'postgres')

    await openViewEditorViaSidebar(window, 'customer_order_summary')

    const selectInput = window.getByTestId('view-editor-select-input')
    await expect(selectInput).toBeVisible({ timeout: 10_000 })

    // Clear the SELECT statement
    await selectInput.fill('')

    const submitBtn = window.getByTestId('view-editor-submit-btn')
    await expect(submitBtn).toBeDisabled()

    await assertNoErrorToast(window)
  })

  test('SQL Preview toggle shows CREATE OR REPLACE VIEW SQL', async () => {
    await connectTo(window, 'postgres')

    await openViewEditorViaSidebar(window, 'customer_order_summary')

    // In edit mode, replaceIfExists defaults to true
    const previewToggle = window.getByTestId('view-editor-preview-toggle')
    await expect(previewToggle).toBeVisible({ timeout: 10_000 })
    await previewToggle.click()

    // SQL preview should now be visible
    const preview = window.getByTestId('view-editor-preview')
    await expect(preview).toBeVisible({ timeout: 10_000 })

    // In edit mode replaceIfExists is true by default, so preview should contain CREATE OR REPLACE VIEW
    const previewText = await preview.textContent()
    expect(previewText).toContain('CREATE OR REPLACE VIEW')
    expect(previewText).toContain('customer_order_summary')

    await assertNoErrorToast(window)
  })

  test('unchecking Replace If Exists changes SQL to CREATE VIEW in preview', async () => {
    await connectTo(window, 'postgres')

    await openViewEditorViaSidebar(window, 'customer_order_summary')

    // Open the SQL preview first
    const previewToggle = window.getByTestId('view-editor-preview-toggle')
    await previewToggle.click()

    const preview = window.getByTestId('view-editor-preview')
    await expect(preview).toBeVisible({ timeout: 10_000 })

    // In edit mode, replaceIfExists is true by default — uncheck it.
    const replaceCheckbox = window.getByTestId('view-editor-replace-checkbox')
    await expect(replaceCheckbox).toBeVisible({ timeout: 5_000 })
    await replaceCheckbox.click()
    await window.waitForTimeout(300)

    // Now the preview should show CREATE VIEW (not CREATE OR REPLACE VIEW)
    // Use auto-retrying assertions so Vue reactivity has time to propagate
    await expect(preview).not.toContainText('CREATE OR REPLACE VIEW', { timeout: 5_000 })
    await expect(preview).toContainText('CREATE VIEW')

    await assertNoErrorToast(window)
  })

  test('cancel closes dialog without saving', async () => {
    await connectTo(window, 'postgres')

    await openViewEditorViaSidebar(window, 'customer_order_summary')

    const dialog = window.getByTestId('view-editor-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Click the Cancel button
    const cancelBtn = window.getByTestId('view-editor-cancel-btn')
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 })
    await cancelBtn.click()

    // Dialog should be closed
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// MySQL View Editor (~1 test)
// ---------------------------------------------------------------------------
test.describe.serial('MySQL View Editor', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('edit view dialog works on MySQL', async () => {
    await connectTo(window, 'mysql')

    // MySQL views are under a "Views" folder that is collapsed by default — expand it
    const viewsFolderLabel = window.locator('span.font-medium', { hasText: 'Views' }).first()
    if (await viewsFolderLabel.isVisible().catch(() => false)) {
      await viewsFolderLabel.click()
      await window.waitForTimeout(500)
    }

    // MySQL seed data has customer_order_summary view
    const viewItem = window.getByTestId('sidebar-table-customer_order_summary')
    await expect(viewItem).toBeVisible({ timeout: 15_000 })
    await viewItem.click({ button: 'right' })

    const editViewItem = window.locator('[role="menuitem"]', { hasText: 'Edit View' })
    await expect(editViewItem).toBeVisible({ timeout: 5_000 })
    await editViewItem.click()

    // Verify the dialog opens with expected fields
    const dialog = window.getByTestId('view-editor-dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    const nameInput = window.getByTestId('view-editor-name-input')
    await expect(nameInput).toBeVisible({ timeout: 10_000 })
    await expect(nameInput).toHaveValue('customer_order_summary')

    const selectInput = window.getByTestId('view-editor-select-input')
    await expect(selectInput).toBeVisible({ timeout: 10_000 })
    const selectValue = await selectInput.inputValue()
    expect(selectValue.length).toBeGreaterThan(0)

    // Cancel to close without changes
    const cancelBtn = window.getByTestId('view-editor-cancel-btn')
    await cancelBtn.click()
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Create View and Cleanup (~1 test)
// ---------------------------------------------------------------------------
test.describe.serial('PostgreSQL Create and Drop View via Editor', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('create a test view via query, verify in sidebar, then drop it', async () => {
    const actions = await connectTo(window, 'postgres')

    // Create a view via the query editor
    await actions.openQueryEditor()
    await actions.typeQuery(
      'CREATE VIEW e2e_view_editor_test AS SELECT id, name FROM customers WHERE country = \'USA\''
    )
    await actions.runQuery()
    await assertNoErrorToast(window)

    // Refresh the schema by dispatching the custom event that the sidebar listens on
    await window.evaluate(() => window.dispatchEvent(new Event('zequel:refresh-schema')))

    // Wait for the view to appear in the sidebar under the Views folder
    const viewItem = window.getByTestId('sidebar-table-e2e_view_editor_test')
    await expect(viewItem).toBeVisible({ timeout: 15_000 })

    // Clean up: drop the view via the existing query editor (avoid opening a
    // second tab which would create duplicate sql-editor testids)
    await actions.typeQuery('DROP VIEW e2e_view_editor_test')
    await actions.runQuery()
    await assertNoErrorToast(window)
  })
})
