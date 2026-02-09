import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const switchSidebarTab = async (page: Page, tab: 'items' | 'queries' | 'history'): Promise<void> => {
  const tabBtn = page.getByTestId(`sidebar-tab-${tab}`)
  await tabBtn.click()
}

export const waitForSidebar = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })
}

export const openTableByTestId = async (page: Page, tableName: string): Promise<void> => {
  const item = page.getByTestId(`sidebar-table-${tableName}`)
  // Click the text label inside the item — the @click handler is on the inner <span>
  await item.getByText(tableName, { exact: true }).click()
  await expect(page.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
}

export const openCollectionByTestId = async (page: Page, collectionName: string): Promise<void> => {
  const item = page.getByTestId(`sidebar-collection-${collectionName}`)
  await item.click()
  await expect(page.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
}

export const openRedisKey = async (page: Page, keyName: string): Promise<void> => {
  const item = page.getByTestId(`sidebar-redis-key-${keyName}`)
  await item.click()
  await expect(page.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
}
