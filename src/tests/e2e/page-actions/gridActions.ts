import type { Page, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Close any existing table/collection/key tabs so only one grid exists in the DOM.
 * The app uses v-show for tab panels, keeping hidden grids alive in the DOM.
 * Multiple data-grid-table elements cause strict-mode and waitForSelector failures.
 */
const closeExistingGridTabs = async (page: Page): Promise<void> => {
  let gridCount = await page.locator('[data-testid="data-grid-table"]').count()
  let attempts = 0
  while (gridCount > 0 && attempts < 5) {
    await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+w`)
    await page.waitForTimeout(500)
    gridCount = await page.locator('[data-testid="data-grid-table"]').count()
    attempts++
  }
}

/**
 * Returns a locator for the visible data-grid-table.
 * Use this when you know exactly one grid is visible but there may be hidden ones.
 */
const getVisibleGrid = async (page: Page): Promise<Locator> => {
  const grids = page.locator('[data-testid="data-grid-table"]')
  const count = await grids.count()
  if (count <= 1) return grids.first()
  for (let i = 0; i < count; i++) {
    if (await grids.nth(i).isVisible()) return grids.nth(i)
  }
  return grids.first()
}

export const openCollection = async (page: Page, collectionName: string): Promise<void> => {
  await closeExistingGridTabs(page)
  const item = page.getByTestId(`sidebar-collection-${collectionName}`)
  await item.click()
  await expect(page.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
}

export const openTable = async (page: Page, tableName: string): Promise<void> => {
  await closeExistingGridTabs(page)
  const item = page.getByTestId(`sidebar-table-${tableName}`)
  await item.click()
  await expect(page.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
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
  // Scroll the visible grid container to the bottom to force rendering.
  const isVisible = await cell.isVisible().catch(() => false)
  if (!isVisible) {
    const grid = await getVisibleGrid(page)
    const scrollContainer = grid.locator('..')
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
  const isVisible = await cell.isVisible().catch(() => false)
  if (!isVisible) {
    const grid = await getVisibleGrid(page)
    const scrollContainer = grid.locator('..')
    await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight)
    await page.waitForTimeout(500)
  }

  await expect(cell).toBeVisible({ timeout: 10_000 })
  await cell.click({ button: 'right' })

  // The context menu item is "Delete" (not "Delete Row")
  const deleteOption = page.getByRole('menuitem', { name: /^Delete/ })
  await expect(deleteOption).toBeVisible({ timeout: 5_000 })
  await deleteOption.click()
  await page.waitForTimeout(200)
}

export const applyChanges = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('apply-data-changes-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  await btn.click()
  // After apply, the button should disappear (changes saved)
  await expect(btn).not.toBeVisible({ timeout: 30_000 })
}
