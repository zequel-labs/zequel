import type { Page, Locator } from '@playwright/test'

/**
 * Centralized selectors for elements that cannot use data-testid
 * (e.g., third-party library elements with their own attributes).
 */

/** Sonner toast library uses data-type attribute for error toasts */
export const errorToast = (page: Page): Locator =>
  page.locator('.sonner-toast[data-type="error"]')
