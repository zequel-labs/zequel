import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// Use :visible filter to avoid strict mode violations when multiple tabs have grids
const visibleGrid = (page: Page) => page.locator('[data-testid="data-grid-table"]:visible').first()

export const openCollection = async (page: Page, collectionName: string): Promise<void> => {
  const item = page.getByTestId(`sidebar-collection-${collectionName}`)
  await item.click()
  // Wait for the data grid to load
  await expect(visibleGrid(page)).toBeVisible({ timeout: 30_000 })
}

export const openTable = async (page: Page, tableName: string): Promise<void> => {
  const item = page.getByTestId(`sidebar-table-${tableName}`)
  await item.click()
  await expect(visibleGrid(page)).toBeVisible({ timeout: 30_000 })
}

export const editCell = async (
  page: Page,
  rowIndex: number,
  columnId: string,
  newValue: string
): Promise<void> => {
  const cellTestId = `grid-cell-${rowIndex}-${columnId}`
  const cell = page.getByTestId(cellTestId)

  // For virtualized grids, the target row may not be rendered yet.
  // Scroll the grid container to the bottom to force rendering.
  const scrollContainer = page.getByTestId('data-grid-scroll-container')
  const isVisible = await cell.isVisible().catch(() => false)
  if (!isVisible) {
    // Scroll to bottom to render the new row
    await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight)
    await page.waitForTimeout(500)
  }

  await expect(cell).toBeVisible({ timeout: 10_000 })
  await cell.dblclick()

  const input = page.getByTestId('grid-cell-edit-input')
  await expect(input).toBeVisible({ timeout: 5_000 })
  await input.fill(newValue)
  await input.press('Enter')
  await page.waitForTimeout(200)
}

export const deleteRow = async (
  page: Page,
  rowIndex: number,
  columnId: string
): Promise<void> => {
  const cellTestId = `grid-cell-${rowIndex}-${columnId}`
  const cell = page.getByTestId(cellTestId)

  // For virtualized grids, the target row may not be rendered yet.
  const scrollContainer = page.getByTestId('data-grid-scroll-container')
  const isVisible = await cell.isVisible().catch(() => false)
  if (!isVisible) {
    await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight)
    await page.waitForTimeout(500)
  }

  await expect(cell).toBeVisible({ timeout: 10_000 })
  await cell.click({ button: 'right' })

  const deleteOption = page.getByTestId('grid-ctx-delete')
  await expect(deleteOption).toBeVisible({ timeout: 5_000 })
  await deleteOption.click()
  await page.waitForTimeout(200)
}

export const editDateCell = async (
  page: Page,
  rowIndex: number,
  columnId: string
): Promise<void> => {
  const cellTestId = `grid-cell-${rowIndex}-${columnId}`
  const cell = page.getByTestId(cellTestId)

  // For virtualized grids, the target row may not be rendered yet.
  const scrollContainer = page.getByTestId('data-grid-scroll-container')
  const isVisible = await cell.isVisible().catch(() => false)
  if (!isVisible) {
    await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight)
    await page.waitForTimeout(500)
  }

  await expect(cell).toBeVisible({ timeout: 10_000 })
  await cell.dblclick()

  // Wait for the date picker popover to appear
  const editor = page.getByTestId('date-cell-editor')
  await expect(editor).toBeVisible({ timeout: 5_000 })

  // Click "Now" to set the current date/time
  const nowBtn = page.getByTestId('date-editor-now')
  await nowBtn.click()
  await page.waitForTimeout(200)

  // Click "Apply" to confirm
  const applyBtn = page.getByTestId('date-editor-apply')
  await applyBtn.click()
  await page.waitForTimeout(200)
}

export const applyChanges = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('apply-data-changes-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  await btn.click()
  // After apply, the button should disappear (changes saved)
  await expect(btn).not.toBeVisible({ timeout: 30_000 })
}
