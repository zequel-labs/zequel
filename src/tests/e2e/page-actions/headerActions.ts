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

export const isSafeModeEnabled = async (page: Page): Promise<boolean> => {
  const btn = page.getByTestId('header-safemode-btn')
  const lockedIcon = btn.locator('.tabler-icon-lock-square-rounded-filled')
  return lockedIcon.isVisible()
}

export const enableSafeMode = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-safemode-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  const alreadyEnabled = await isSafeModeEnabled(page)
  if (!alreadyEnabled) {
    await btn.click()
    // Wait for the locked icon to appear
    await expect(btn.locator('.tabler-icon-lock-square-rounded-filled')).toBeVisible({ timeout: 3_000 })
  }
}

export const disableSafeMode = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-safemode-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  const isEnabled = await isSafeModeEnabled(page)
  if (isEnabled) {
    await btn.click()
    // Wait for the unlocked icon to appear
    await expect(btn.locator('.tabler-icon-lock-square-rounded')).toBeVisible({ timeout: 3_000 })
  }
}

export const toggleSafeMode = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-safemode-btn')
  await btn.click()
}
