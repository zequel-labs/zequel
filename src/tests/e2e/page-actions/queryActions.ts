import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Ctrl on Linux/Windows, Meta (Cmd) on macOS */
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

export const openQueryEditor = async (page: Page): Promise<void> => {
  // Dismiss any open dropdown/dialog/overlay left from a prior test
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const btn = page.getByTestId('header-query-btn')
  await btn.click()
  // Wait for Monaco editor to be ready
  await expect(page.getByTestId('monaco-editor')).toBeVisible({ timeout: 10_000 })
}

export const typeQuery = async (page: Page, sql: string): Promise<void> => {
  // Click on the Monaco editor to focus it
  const editor = page.getByTestId('monaco-editor').locator('.view-lines')
  await editor.click()
  // Select all and replace
  await page.keyboard.press(`${MOD}+a`)
  await page.keyboard.type(sql, { delay: 10 })
}

export const runQuery = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('query-run-btn')
  await btn.click()
  // Wait for results to appear
  await expect(page.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
}

export const runQueryWithKeyboard = async (page: Page): Promise<void> => {
  // Dismiss any autocomplete popup that might intercept the shortcut
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.keyboard.press(`${MOD}+Enter`)
  await expect(page.getByTestId('query-results')).toBeVisible({ timeout: 30_000 })
}

export const formatQuery = async (page: Page): Promise<void> => {
  const btn = page.getByTestId('query-format-btn')
  await btn.click()
}

