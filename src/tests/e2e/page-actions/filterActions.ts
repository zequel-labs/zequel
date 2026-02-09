import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const addFilter = async (
  page: Page,
  column: string,
  operator: string,
  value?: string
): Promise<void> => {
  const addBtn = page.getByTestId('filter-add-btn')
  await addBtn.click()

  // Find the last filter row index
  const filterRows = page.locator('[data-testid^="filter-column-"]')
  const count = await filterRows.count()
  const index = count - 1

  // Select column
  const columnSelect = page.getByTestId(`filter-column-${index}`)
  await columnSelect.click()
  await page.getByRole('option', { name: column, exact: true }).click()

  // Select operator
  const operatorSelect = page.getByTestId(`filter-operator-${index}`)
  await operatorSelect.click()
  await page.getByRole('option', { name: operator, exact: true }).click()

  // Fill value if provided (not needed for IS NULL / IS NOT NULL)
  if (value !== undefined) {
    const valueInput = page.getByTestId(`filter-value-${index}`)
    await valueInput.fill(value)
  }
}

export const applyFilters = async (page: Page): Promise<void> => {
  const applyBtn = page.getByTestId('filter-apply-btn')
  await applyBtn.click()
  // Wait for grid to reload
  await page.waitForTimeout(1000)
}

export const removeFilter = async (page: Page, index: number): Promise<void> => {
  const removeBtn = page.getByTestId(`filter-remove-${index}`)
  await removeBtn.click()
}

export const getRowCount = async (page: Page): Promise<number> => {
  // Exclude virtualizer spacer rows (they have aria-hidden="true")
  const rows = page.locator('[data-testid="data-grid-table"] tbody tr:not([aria-hidden="true"])')
  return rows.count()
}

export const getRecordRange = async (page: Page): Promise<string> => {
  const range = page.getByTestId('statusbar-record-range')
  return range.innerText()
}
