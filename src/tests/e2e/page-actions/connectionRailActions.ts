import type { Page } from '@playwright/test'
import { ConnectionRailComponent } from '@e2e/page-components/ConnectionRail'

export const getConnectionRailItemCount = async (page: Page): Promise<number> => {
  const rail = new ConnectionRailComponent(page)
  return rail.root.locator('[data-testid^="connection-rail-item-"]').count()
}

export const clickConnectionRailItem = async (page: Page, index: number): Promise<void> => {
  const rail = new ConnectionRailComponent(page)
  await rail.item(index).click()
}

export const closeConnectionViaRail = async (page: Page, index: number): Promise<void> => {
  const rail = new ConnectionRailComponent(page)
  await rail.item(index).click({ button: 'right' })
  await rail.closeMenuItem.click()
}

export const closeOtherConnectionsViaRail = async (page: Page, index: number): Promise<void> => {
  const rail = new ConnectionRailComponent(page)
  await rail.item(index).click({ button: 'right' })
  await rail.closeOthersMenuItem.click()
}
