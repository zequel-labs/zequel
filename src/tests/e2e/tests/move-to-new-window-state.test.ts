import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo, connectSecondDb } from '@e2e/helpers/connect'
import { userActions } from '@e2e/page-actions'
import { ConnectionRailComponent } from '@e2e/page-components/ConnectionRail'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

/**
 * Helper: switch to PG connection and expand the public schema.
 * After connecting a second DB, the PG sidebar shows schemas collapsed.
 */
const switchToPgAndExpandSchema = async (page: Page, actions: ReturnType<typeof userActions>): Promise<void> => {
  await actions.clickConnectionRailItem(0)
  const publicSchema = page.getByTestId('sidebar-schema-public')
  await expect(publicSchema).toBeVisible({ timeout: 10_000 })
  await publicSchema.click()
  await expect(page.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })
}

/**
 * Helper: move the first connection in the rail to a new window.
 * Returns the new window Page.
 */
const moveFirstConnectionToNewWindow = async (
  parentApp: ElectronApplication,
  parentWindow: Page
): Promise<Page> => {
  const rail = new ConnectionRailComponent(parentWindow)
  const newWindowPromise = parentApp.waitForEvent('window')
  await rail.item(0).click({ button: 'right' })
  await rail.moveToWindowMenuItem.click()
  const newWindow = await newWindowPromise
  await expect(newWindow.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })
  return newWindow
}

// ---------------------------------------------------------------------------
// Move to New Window — Full State Transfer
// ---------------------------------------------------------------------------
test.describe.serial('Move to New Window — Full State Transfer', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  // -----------------------------------------------------------------------
  // 1. Table data rows are transferred (no empty grid)
  // -----------------------------------------------------------------------
  test('table data rows are visible in new window without re-fetching', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    // Switch back to PG and open customers table
    await switchToPgAndExpandSchema(window, actions)
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Capture a cell value from row 0 to verify data transferred
    const cellBefore = window.getByTestId('grid-cell-0-name')
    await expect(cellBefore).toBeVisible({ timeout: 5_000 })
    const cellText = await cellBefore.innerText()
    expect(cellText.length).toBeGreaterThan(0)

    // Move PG to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    // The table tab should be there with data already loaded
    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })
    await expect(newWindow.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Verify the same cell data is present in the new window
    const cellAfter = newWindow.getByTestId('grid-cell-0-name')
    await expect(cellAfter).toBeVisible({ timeout: 10_000 })
    await expect(cellAfter).toHaveText(cellText, { timeout: 10_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 2. Filters are preserved
  // -----------------------------------------------------------------------
  test('table filters are preserved in new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Add a filter: name = 'Alice Johnson'
    await actions.addFilter('name', '=', 'Alice Johnson')
    await actions.applyFilters()

    // Wait for filter to take effect — row count should decrease from unfiltered
    await expect(window.getByTestId('filter-panel')).toBeVisible({ timeout: 5_000 })
    await expect(window.locator('[data-testid^="grid-row-"]').first()).toBeVisible({ timeout: 5_000 })
    const filteredRowCount = await window.locator('[data-testid^="grid-row-"]').count()

    // Move to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    // Verify filter panel is visible in new window
    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })
    await expect(newWindow.getByTestId('filter-panel')).toBeVisible({ timeout: 10_000 })

    // Verify the data grid is visible with data
    await expect(newWindow.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Verify the filter value is preserved
    const filterValue = newWindow.getByTestId('filter-value-0')
    await expect(filterValue).toBeVisible({ timeout: 5_000 })
    await expect(filterValue).toHaveValue('Alice Johnson', { timeout: 5_000 })

    // Verify similar row count (same filter applied)
    const newRowCount = await newWindow.locator('[data-testid^="grid-row-"]').count()
    expect(newRowCount).toBe(filteredRowCount)

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 4. Pending cell edits are preserved
  // -----------------------------------------------------------------------
  test('pending cell edits are preserved in new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Edit a cell (don't apply)
    await actions.editCell(0, 'name', 'EDITED_NAME')

    // Verify the apply button is visible (means there are pending changes)
    await expect(window.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 5_000 })

    // Move to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })
    await expect(newWindow.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Verify the edited cell shows the modified value in the new window
    const editedCell = newWindow.getByTestId('grid-cell-0-name')
    await expect(editedCell).toBeVisible({ timeout: 10_000 })
    await expect(editedCell).toContainText('EDITED_NAME', { timeout: 10_000 })

    // Verify the apply button is visible in new window (pending changes preserved)
    await expect(newWindow.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 5. Query results are preserved
  // -----------------------------------------------------------------------
  test('query result is preserved in new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)

    // Open query tab, type and execute SQL
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT 42 AS answer, \'hello\' AS greeting')
    await actions.runQuery()

    // Verify the result grid is visible with the data
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 15_000 })
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Capture a result cell value
    const resultCell = window.getByTestId('grid-cell-0-answer')
    await expect(resultCell).toBeVisible({ timeout: 5_000 })
    const resultText = await resultCell.innerText()
    expect(resultText).toContain('42')

    // Move to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    // Verify the SQL editor has the query
    await expect(newWindow.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 15_000 })
    const editorContent = newWindow.locator('[data-testid="sql-editor"]:visible').first().locator('.view-lines')
    await expect(editorContent).toContainText('SELECT 42 AS answer', { timeout: 10_000 })

    // Verify the query result is present in the new window
    await expect(newWindow.getByTestId('query-results')).toBeVisible({ timeout: 10_000 })
    await expect(newWindow.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    const newResultCell = newWindow.getByTestId('grid-cell-0-answer')
    await expect(newResultCell).toBeVisible({ timeout: 10_000 })
    await expect(newResultCell).toContainText('42', { timeout: 5_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 6. Column sorting is preserved
  // -----------------------------------------------------------------------
  test('column sorting is preserved in new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Click a column header to sort (click the name header)
    const header = window.locator('th').filter({ hasText: 'name' })
    await header.click()

    // Wait for sort indicator to appear (confirms sorting took effect)
    const sortIndicator = window.getByTestId('grid-sort-indicator-name')
    await expect(sortIndicator).toBeVisible({ timeout: 5_000 })

    // Capture first cell value after sorting
    const firstCellBefore = window.getByTestId('grid-cell-0-name')
    const sortedFirstValue = await firstCellBefore.innerText()

    // Move to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })
    await expect(newWindow.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Verify sort indicator is present in new window
    const newSortIndicator = newWindow.getByTestId('grid-sort-indicator-name')
    await expect(newSortIndicator).toBeVisible({ timeout: 10_000 })

    // Verify the first cell value is the same (sorting preserved)
    const firstCellAfter = newWindow.getByTestId('grid-cell-0-name')
    await expect(firstCellAfter).toBeVisible({ timeout: 10_000 })
    await expect(firstCellAfter).toHaveText(sortedFirstValue, { timeout: 5_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 7. Multiple tab types are all preserved
  // -----------------------------------------------------------------------
  test('mixed tab types (table + query with result) are all preserved', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)

    // Open a table tab
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Open a query tab and execute
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT COUNT(*) AS cnt FROM customers')
    await actions.runQuery()
    await expect(window.getByTestId('query-results')).toBeVisible({ timeout: 15_000 })

    // Move PG to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    // Verify table tab
    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })

    // Click the table tab and verify data is there
    await newWindow.getByTestId('tab-public.customers').click()
    await expect(newWindow.getByTestId('table-view').getByTestId('data-grid-table')).toBeVisible({ timeout: 15_000 })
    await expect(newWindow.getByTestId('grid-cell-0-name')).toBeVisible({ timeout: 10_000 })

    // Find and click the query tab, verify result is there
    const queryTab = newWindow.locator('[data-testid^="tab-Query"]').first()
    await expect(queryTab).toBeVisible({ timeout: 10_000 })
    await queryTab.click()
    await expect(newWindow.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })
    await expect(newWindow.getByTestId('query-results').getByTestId('data-grid-table')).toBeVisible({ timeout: 10_000 })

    // Verify SQL is preserved
    const editorContent = newWindow.locator('[data-testid="sql-editor"]:visible').first().locator('.view-lines')
    await expect(editorContent).toContainText('SELECT COUNT', { timeout: 10_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 8. Active tab index is preserved
  // -----------------------------------------------------------------------
  test('active tab is preserved in new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)

    // Open two tables
    await actions.openTableByTestId('customers')
    await expect(window.getByTestId('grid-cell-0-name')).toBeVisible({ timeout: 15_000 })

    // Open second table directly (avoid shared helper's unscoped data-grid-table check)
    await window.getByTestId('sidebar-table-orders').getByTestId('sidebar-table-name').click()
    await expect(window.getByTestId('grid-cell-0-customer_id')).toBeVisible({ timeout: 15_000 })

    // Switch back to the customers tab (make it active)
    await window.getByTestId('tab-public.customers').click()
    await expect(window.getByTestId('grid-cell-0-name')).toBeVisible({ timeout: 10_000 })

    // Move to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    // Verify both tabs exist
    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })
    await expect(newWindow.getByTestId('tab-public.orders')).toBeVisible({ timeout: 10_000 })

    // Verify the active tab is customers (name cell visible means customers data is showing)
    const firstCell = newWindow.getByTestId('grid-cell-0-name')
    await expect(firstCell).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 9. Pending new rows are preserved
  // -----------------------------------------------------------------------
  test('pending new rows are preserved in new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Add a new row (don't apply)
    await actions.addRow()

    // Verify apply button is visible (pending changes)
    await expect(window.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 5_000 })

    // Move to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })
    await expect(newWindow.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Verify apply button is visible (pending new row preserved)
    await expect(newWindow.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 10. Pending delete rows are preserved
  // -----------------------------------------------------------------------
  test('pending delete rows are preserved in new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Mark a row for deletion (don't apply)
    await actions.deleteRow(0, 'name')

    // Verify apply button is visible (pending delete)
    await expect(window.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 5_000 })

    // Move to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })
    await expect(newWindow.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Verify apply button is visible (pending delete preserved)
    await expect(newWindow.getByTestId('apply-data-changes-btn')).toBeVisible({ timeout: 10_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 11. Query SQL text preserved (no result — editor only)
  // -----------------------------------------------------------------------
  test('query SQL text is preserved even without executing', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)

    // Open query tab and type SQL but DON'T run it
    await actions.openQueryEditor()
    await actions.typeQuery('SELECT * FROM orders WHERE id > 100')

    // Move to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    // Verify the SQL editor has the query
    await expect(newWindow.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 15_000 })
    const editorContent = newWindow.locator('[data-testid="sql-editor"]:visible').first().locator('.view-lines')
    await expect(editorContent).toContainText('SELECT * FROM orders WHERE id > 100', { timeout: 10_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 12. Original window remains functional after move
  // -----------------------------------------------------------------------
  test('original window remains functional with other connection after move', async () => {
    await connectTo(window, 'postgres')
    const mysqlActions = await connectSecondDb(window, 'mysql')

    // Open a table in MySQL
    await mysqlActions.openTableByTestId('customers')
    await expect(window.getByTestId('tab-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Move PG to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    // Verify original window still works — MySQL tab should still show data
    await expect(window.getByTestId('tab-customers')).toBeVisible({ timeout: 10_000 })
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 10_000 })

    // Connection rail should disappear (only 1 connection left)
    await expect(window.getByTestId('connection-rail')).not.toBeVisible({ timeout: 15_000 })

    // Verify MySQL data is still interactive — can navigate
    const firstCell = window.getByTestId('grid-cell-0-name')
    await expect(firstCell).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })

  // -----------------------------------------------------------------------
  // 13. Table view activeView (data vs structure) is preserved
  // -----------------------------------------------------------------------
  test('table structure view is preserved in new window', async () => {
    const actions = await connectTo(window, 'postgres')
    await connectSecondDb(window, 'mysql')

    await switchToPgAndExpandSchema(window, actions)
    await actions.openTableByTestId('customers')
    await expect(window.locator('[data-testid="data-grid-table"]:visible').first()).toBeVisible({ timeout: 15_000 })

    // Switch to structure view
    await actions.switchToStructureTab()
    await expect(window.getByTestId('structure-columns-tab')).toBeVisible({ timeout: 10_000 })

    // Move to new window
    const newWindow = await moveFirstConnectionToNewWindow(app, window)

    await expect(newWindow.getByTestId('tab-public.customers')).toBeVisible({ timeout: 15_000 })

    // The activeView is stored in Pinia (TabData), so structure should be the active view
    // Structure columns tab should be visible (it loads from TabData.activeView = 'structure')
    await expect(newWindow.getByTestId('structure-columns-tab')).toBeVisible({ timeout: 15_000 })

    await assertNoErrorToast(window)
    await assertNoErrorToast(newWindow)
  })
})
