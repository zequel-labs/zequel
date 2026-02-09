import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const openQueryEditor = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-query-btn')
  await btn.click()
  await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10_000 })
}

export const openMonitoring = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-monitoring-btn')
  await btn.click()
}

export const openUserManagement = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-users-btn')
  await btn.click()
}

const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.locator('button:has(.tabler-icon-dots-vertical)')
  await trigger.click()
}

export const openBackup = async (page: Page): Promise<void> => {
  await openMoreMenu(page)
  const btn = page.getByTestId('header-export-btn')
  await btn.click()
}

export const openRestore = async (page: Page): Promise<void> => {
  await openMoreMenu(page)
  const btn = page.getByTestId('header-import-btn')
  await btn.click()
}
