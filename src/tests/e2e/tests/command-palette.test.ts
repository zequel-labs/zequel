import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const openCommandPalette = async (page: Page, shortcut: 'Meta+k' | 'Meta+p' = 'Meta+k'): Promise<void> => {
  await page.keyboard.press(shortcut)
  await expect(page.getByTestId('command-palette-input')).toBeVisible({ timeout: 5_000 })
}

const closeCommandPalette = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('command-palette-input')).not.toBeVisible({ timeout: 5_000 })
}

const searchInCommandPalette = async (page: Page, query: string): Promise<void> => {
  const input = page.getByTestId('command-palette-input')
  await input.fill(query)
  // Wait for results to update
  await page.waitForTimeout(500)
}

// ---------------------------------------------------------------------------
// Command Palette - Open/Close (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Command Palette - Open/Close (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('open with Cmd+K and verify input visible', async () => {
    await connectTo(window, 'postgres')

    await window.keyboard.press('Meta+k')

    const commandPalette = window.getByTestId('command-palette')
    await expect(commandPalette).toBeVisible({ timeout: 5_000 })

    const input = window.getByTestId('command-palette-input')
    await expect(input).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('open with Cmd+P and verify input visible', async () => {
    await connectTo(window, 'postgres')

    await window.keyboard.press('Meta+p')

    const commandPalette = window.getByTestId('command-palette')
    await expect(commandPalette).toBeVisible({ timeout: 5_000 })

    const input = window.getByTestId('command-palette-input')
    await expect(input).toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('close with Escape', async () => {
    await connectTo(window, 'postgres')

    await openCommandPalette(window)

    await window.keyboard.press('Escape')

    const input = window.getByTestId('command-palette-input')
    await expect(input).not.toBeVisible({ timeout: 5_000 })

    await assertNoErrorToast(window)
  })

  test('open, type search, close, reopen - search should be cleared', async () => {
    await connectTo(window, 'postgres')

    // Open and type a search query
    await openCommandPalette(window)
    const input = window.getByTestId('command-palette-input')
    await input.fill('customers')
    await expect(input).toHaveValue('customers')

    // Close the palette
    await closeCommandPalette(window)

    // Reopen the palette
    await openCommandPalette(window)

    // The search input should be cleared
    const reopenedInput = window.getByTestId('command-palette-input')
    await expect(reopenedInput).toHaveValue('')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Command Palette - Search Tables (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Command Palette - Search Tables (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('type "customers" and verify results show customers table', async () => {
    await connectTo(window, 'postgres')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'customers')

    // Verify at least one result appears
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).toBeVisible({ timeout: 10_000 })

    // The first result should contain "customers"
    await expect(firstResult).toContainText('customers')

    await assertNoErrorToast(window)
  })

  test('type "prod" and verify results include products', async () => {
    await connectTo(window, 'postgres')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'prod')

    // Verify at least one result appears
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).toBeVisible({ timeout: 10_000 })

    // At least one result should contain "products"
    const resultsContainer = window.getByTestId('command-palette')
    await expect(resultsContainer).toContainText('products')

    await assertNoErrorToast(window)
  })

  test('type "nonexistent_xyz" and verify "No results found" appears', async () => {
    await connectTo(window, 'postgres')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'nonexistent_xyz')

    // Verify no results are shown
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).not.toBeVisible({ timeout: 5_000 })

    // Verify "No results found" message appears
    const palette = window.getByTestId('command-palette')
    await expect(palette).toContainText('No results found')

    await assertNoErrorToast(window)
  })

  test('use arrow keys to navigate results', async () => {
    await connectTo(window, 'postgres')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'customers')

    // Wait for first result to be visible
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).toBeVisible({ timeout: 10_000 })

    // The first result should have the selected/active styling (bg-accent)
    await expect(firstResult).toHaveClass(/bg-accent/)

    // Press ArrowDown to move to the second result (if available)
    const input = window.getByTestId('command-palette-input')
    await input.press('ArrowDown')
    await window.waitForTimeout(200)

    // Check if a second result exists
    const secondResult = window.getByTestId('command-palette-result-1')
    const secondExists = await secondResult.isVisible().catch(() => false)

    if (secondExists) {
      // The second result should now have the selected styling
      await expect(secondResult).toHaveClass(/bg-accent/)
      // The first result should no longer have the selected styling
      await expect(firstResult).not.toHaveClass(/bg-accent/)

      // Press ArrowUp to go back to the first result
      await input.press('ArrowUp')
      await window.waitForTimeout(200)

      await expect(firstResult).toHaveClass(/bg-accent/)
    }

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Command Palette - Navigate to Table (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Command Palette - Navigate to Table (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('type "customers", press Enter to select, verify data grid opens', async () => {
    await connectTo(window, 'postgres')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'customers')

    // Wait for results to load
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).toBeVisible({ timeout: 10_000 })
    await expect(firstResult).toContainText('customers')

    // Press Enter to select the first result
    const input = window.getByTestId('command-palette-input')
    await input.press('Enter')

    // The command palette should close
    await expect(window.getByTestId('command-palette-input')).not.toBeVisible({ timeout: 5_000 })

    // A tab for customers should open with the data grid visible
    const dataGrid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(dataGrid).toBeVisible({ timeout: 30_000 })

    // Verify the tab title includes "customers" (PostgreSQL uses schema prefix: public.customers)
    const tabBar = window.getByTestId('tab-bar')
    await expect(tabBar).toContainText('customers')

    await assertNoErrorToast(window)
  })

  test('type "products", click on result, verify products table opens', async () => {
    await connectTo(window, 'postgres')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'products')

    // Wait for results to load
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).toBeVisible({ timeout: 10_000 })
    await expect(firstResult).toContainText('products')

    // Click the result instead of pressing Enter
    await firstResult.click()

    // The command palette should close
    await expect(window.getByTestId('command-palette-input')).not.toBeVisible({ timeout: 5_000 })

    // A tab for products should open with the data grid visible
    const dataGrid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(dataGrid).toBeVisible({ timeout: 30_000 })

    // Verify the tab title includes "products"
    const tabBar = window.getByTestId('tab-bar')
    await expect(tabBar).toContainText('products')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Command Palette - Search Tables (MySQL)
// ---------------------------------------------------------------------------
test.describe.serial('Command Palette - Search Tables (MySQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('type "customers" and verify results appear', async () => {
    await connectTo(window, 'mysql')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'customers')

    // Verify at least one result appears
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).toBeVisible({ timeout: 10_000 })
    await expect(firstResult).toContainText('customers')

    await assertNoErrorToast(window)
  })

  test('select a result and verify table opens', async () => {
    await connectTo(window, 'mysql')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'customers')

    // Wait for results
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).toBeVisible({ timeout: 10_000 })

    // Press Enter to select
    const input = window.getByTestId('command-palette-input')
    await input.press('Enter')

    // The command palette should close
    await expect(window.getByTestId('command-palette-input')).not.toBeVisible({ timeout: 5_000 })

    // Data grid should appear
    const dataGrid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(dataGrid).toBeVisible({ timeout: 30_000 })

    // Verify the tab bar shows customers
    const tabBar = window.getByTestId('tab-bar')
    await expect(tabBar).toContainText('customers')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Command Palette - Search Tables (SQLite)
// ---------------------------------------------------------------------------
test.describe.serial('Command Palette - Search Tables (SQLite)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('type "orders" and verify results appear', async () => {
    await connectTo(window, 'sqlite')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'orders')

    // Verify at least one result appears
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).toBeVisible({ timeout: 10_000 })
    await expect(firstResult).toContainText('orders')

    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Command Palette - Column Search (PostgreSQL)
// ---------------------------------------------------------------------------
test.describe.serial('Command Palette - Column Search (PostgreSQL)', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('type "email" and verify column results appear', async () => {
    await connectTo(window, 'postgres')

    await openCommandPalette(window)
    await searchInCommandPalette(window, 'email')

    // Verify at least one result appears
    const firstResult = window.getByTestId('command-palette-result-0')
    await expect(firstResult).toBeVisible({ timeout: 10_000 })

    // The result should contain "email" (column name)
    await expect(firstResult).toContainText('email')

    // The result detail should reference the parent table (e.g., "customers.email")
    const palette = window.getByTestId('command-palette')
    await expect(palette).toContainText('customers')

    await assertNoErrorToast(window)
  })
})
