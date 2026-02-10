import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const switchToDataTab = async (page: Page): Promise<void> => {
  const tab = page.getByTestId('statusbar-data-tab')
  await tab.click()
}

export const switchToStructureTab = async (page: Page): Promise<void> => {
  const tab = page.getByTestId('statusbar-structure-tab')
  await tab.click()
}

export const addRow = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('statusbar-add-row-btn')
  await btn.click()
  // Wait for grid to add the new row
  await page.waitForTimeout(500)
}

export const goToNextPage = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('statusbar-next-page-btn')
  await btn.click()
  // Wait for grid to refresh
  await page.waitForTimeout(1000)
}

export const goToPreviousPage = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('statusbar-prev-page-btn')
  await btn.click()
  await page.waitForTimeout(1000)
}

export const discardChanges = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('discard-data-changes-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  await btn.click()
}

export const getRecordRange = async (page: Page): Promise<string> => {
  const el = page.getByTestId('statusbar-record-range')
  return el.innerText()
}

export const clickExport = async (page: Page): Promise<void> => {
  // Dismiss any open export dialog/overlay left from a prior test
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const btn = page.getByTestId('statusbar-export-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  await btn.click()
}
