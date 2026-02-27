import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const openQueryEditor = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-query-btn')
  await btn.click()
  // Use :visible to avoid strict mode with multiple tabs
  await expect(page.locator('[data-testid="sql-editor"]:visible').first()).toBeVisible({ timeout: 10_000 })
}

export const openMonitoring = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-monitoring-btn')
  await btn.click()
}

export const openUserManagement = async (page: Page): Promise<void> => {
  // Users button is inside the More menu dropdown
  await openMoreMenu(page)
  const btn = page.getByTestId('header-users-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  await btn.click()
}

export const openMoreMenu = async (page: Page): Promise<void> => {
  const trigger = page.getByTestId('header-more-menu-btn')
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
  const lockedIcon = page.getByTestId('safemode-icon-locked')
  return lockedIcon.isVisible()
}

export const enableSafeMode = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-safemode-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  const alreadyEnabled = await isSafeModeEnabled(page)
  if (!alreadyEnabled) {
    await btn.click()
    // Wait for the locked icon to appear
    await expect(page.getByTestId('safemode-icon-locked')).toBeVisible({ timeout: 3_000 })
  }
}

export const disableSafeMode = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-safemode-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  const isEnabled = await isSafeModeEnabled(page)
  if (isEnabled) {
    await btn.click()
    // Wait for the unlocked icon to appear
    await expect(page.getByTestId('safemode-icon-unlocked')).toBeVisible({ timeout: 3_000 })
  }
}

export const toggleSafeMode = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-safemode-btn')
  await btn.click()
}

export const isPrivacyModeEnabled = async (page: Page): Promise<boolean> => {
  const onIcon = page.getByTestId('privacy-icon-on')
  return onIcon.isVisible()
}

export const enablePrivacyMode = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-privacy-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  const alreadyEnabled = await isPrivacyModeEnabled(page)
  if (!alreadyEnabled) {
    await btn.click()
    await expect(page.getByTestId('privacy-icon-on')).toBeVisible({ timeout: 3_000 })
  }
}

export const disablePrivacyMode = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-privacy-btn')
  await expect(btn).toBeVisible({ timeout: 5_000 })
  const isEnabled = await isPrivacyModeEnabled(page)
  if (isEnabled) {
    await btn.click()
    await expect(page.getByTestId('privacy-icon-off')).toBeVisible({ timeout: 3_000 })
  }
}

export const togglePrivacyMode = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('header-privacy-btn')
  await btn.click()
}
