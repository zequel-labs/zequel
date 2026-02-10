import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Close any existing table/collection/key tabs so only one grid exists in the DOM.
 * The app uses v-show for tab panels, keeping hidden grids alive in the DOM.
 * Multiple data-grid-table elements cause strict-mode and waitForSelector failures.
 *
 * Uses the tab close button instead of keyboard shortcuts, because the app's
 * keyboard handler maps 'meta' to event.metaKey which doesn't fire on Linux.
 */
const closeExistingGridTabs = async (page: Page): Promise<void> => {
  let gridCount = await page.locator('[data-testid="data-grid-table"]').count()
  let attempts = 0
  while (gridCount > 0 && attempts < 10) {
    const closeBtn = page.locator('[data-testid^="tab-close-"]').first()
    const exists = await closeBtn.count()
    if (exists === 0) break
    await closeBtn.click({ force: true })
    await page.waitForTimeout(300)
    gridCount = await page.locator('[data-testid="data-grid-table"]').count()
    attempts++
  }
}

export const switchSidebarTab = async (page: Page, tab: 'items' | 'queries' | 'history'): Promise<void> => {
  const tabBtn = page.getByTestId(`sidebar-tab-${tab}`)
  await tabBtn.click()
}

export const waitForSidebar = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })
}

export const openTableByTestId = async (page: Page, tableName: string): Promise<void> => {
  await closeExistingGridTabs(page)
  const item = page.getByTestId(`sidebar-table-${tableName}`)
  // Click the text label inside the item — the @click handler is on the inner <span>
  await item.getByText(tableName, { exact: true }).click()
  await expect(page.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
}

export const openCollectionByTestId = async (page: Page, collectionName: string): Promise<void> => {
  await closeExistingGridTabs(page)
  const item = page.getByTestId(`sidebar-collection-${collectionName}`)
  await item.click()
  await expect(page.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
}

export const openRedisKey = async (page: Page, keyName: string): Promise<void> => {
  await closeExistingGridTabs(page)
  const item = page.getByTestId(`sidebar-redis-key-${keyName}`)
  await item.click()
  await expect(page.getByTestId('data-grid-table')).toBeVisible({ timeout: 30_000 })
}
