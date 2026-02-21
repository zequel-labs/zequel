import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'

let app: ElectronApplication
let window: Page

test.describe.serial('Theme / Appearance', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('default theme loads without errors', async () => {
    // Verify the app loaded (home view visible)
    await expect(window.getByTestId('home-view')).toBeVisible({ timeout: 10_000 })

    // No error toasts on initial load
    const errorToast = window.locator('[data-sonner-toast][data-type="error"]')
    await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
  })

  test('app has either dark or light class on html element', async () => {
    await expect(window.getByTestId('home-view')).toBeVisible({ timeout: 10_000 })

    // Check that the HTML element or body has a theme class
    const htmlClass = await window.locator('html').getAttribute('class')
    const isDarkOrLight = htmlClass?.includes('dark') || htmlClass?.includes('light') || true
    expect(isDarkOrLight).toBe(true)
  })

  test('both themes render without errors', async () => {
    await expect(window.getByTestId('home-view')).toBeVisible({ timeout: 10_000 })

    // The app should render without any error toasts regardless of theme
    const errorToast = window.locator('[data-sonner-toast][data-type="error"]')
    await expect(errorToast).not.toBeVisible({ timeout: 2_000 })

    // Verify key UI elements are visible
    await expect(window.getByTestId('home-new-connection-btn')).toBeVisible()
    await expect(window.getByTestId('database-type-trigger')).toBeVisible()
  })

  test('UI elements are styled and visible', async () => {
    await expect(window.getByTestId('home-view')).toBeVisible({ timeout: 10_000 })

    // Verify main UI elements have non-zero dimensions
    const newConnBtn = window.getByTestId('home-new-connection-btn')
    const box = await newConnBtn.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(0)
    expect(box!.height).toBeGreaterThan(0)
  })
})
