import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const openCollection = async (page: Page, collectionName: string): Promise<void> => {
  const item = page.getByTestId(`sidebar-collection-${collectionName}`)
  await item.click()
  // Wait for the data grid to load
  await expect(page.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
}

export const openTable = async (page: Page, tableName: string): Promise<void> => {
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
  const cell = page.getByTestId(`grid-cell-${rowIndex}-${columnId}`)
  await cell.dblclick()

  const input = page.getByTestId('grid-cell-edit-input')
  await expect(input).toBeVisible({ timeout: 5_000 })
  await input.fill(newValue)
  await input.press('Enter')
}

export const applyChanges = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('apply-data-changes-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  await btn.click()
  // After apply, the button should disappear (changes saved)
  await expect(btn).not.toBeVisible({ timeout: 30_000 })
}
