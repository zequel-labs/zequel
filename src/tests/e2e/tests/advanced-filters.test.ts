import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getAllColumnValues = async (page: Page, column: string, rowCount: number): Promise<string[]> => {
  const values: string[] = []
  for (let i = 0; i < rowCount; i++) {
    const cell = page.getByTestId(`grid-cell-${i}-${column}`)
    const visible = await cell.isVisible()
    if (!visible) break
    values.push((await cell.innerText()).trim())
  }
  return values
}

// ---------------------------------------------------------------------------
// Multiple Filters - PostgreSQL
// ---------------------------------------------------------------------------

test.describe.serial('Multiple Filters - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('add two filters and apply together', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    // Get unfiltered row count
    const unfilteredCount = await actions.getRowCount()
    expect(unfilteredCount).toBeGreaterThan(0)

    // Add two filters: country = 'USA' AND email LIKE '%@example.com'
    await actions.addFilter('country', '=', 'USA')
    await actions.addFilter('email', 'LIKE', '%@example.com')
    await actions.applyFilters()

    const filteredCount = await actions.getRowCount()
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThanOrEqual(unfilteredCount)

    // Verify all visible rows match both filters
    const countries = await getAllColumnValues(window, 'country', filteredCount)
    const emails = await getAllColumnValues(window, 'email', filteredCount)
    for (const val of countries) {
      expect(val).toBe('USA')
    }
    for (const val of emails) {
      expect(val).toContain('@example.com')
    }
  })

  test('add filter, apply, then add second filter and apply again', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    // First filter: country = 'USA'
    await actions.addFilter('country', '=', 'USA')
    await actions.applyFilters()

    const countAfterFirst = await actions.getRowCount()
    expect(countAfterFirst).toBeGreaterThan(0)

    // Second filter: city = 'New York'
    await actions.addFilter('city', '=', 'New York')
    await actions.applyFilters()

    const countAfterSecond = await actions.getRowCount()
    expect(countAfterSecond).toBeGreaterThan(0)
    expect(countAfterSecond).toBeLessThanOrEqual(countAfterFirst)

    const cities = await getAllColumnValues(window, 'city', countAfterSecond)
    for (const val of cities) {
      expect(val).toBe('New York')
    }
  })

  test('remove one filter and verify more results return', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    // Add two filters: country = 'USA' AND city = 'New York'
    await actions.addFilter('country', '=', 'USA')
    await actions.addFilter('city', '=', 'New York')
    await actions.applyFilters()

    const countWithBoth = await actions.getRowCount()
    expect(countWithBoth).toBeGreaterThan(0)

    // Remove the city filter (index 1)
    await actions.removeFilter(1)
    await actions.applyFilters()

    const countWithOne = await actions.getRowCount()
    expect(countWithOne).toBeGreaterThanOrEqual(countWithBoth)

    // All remaining rows should still have country = 'USA'
    const countries = await getAllColumnValues(window, 'country', countWithOne)
    for (const val of countries) {
      expect(val).toBe('USA')
    }
  })
})

// ---------------------------------------------------------------------------
// IS NOT NULL Filter - PostgreSQL
// ---------------------------------------------------------------------------

test.describe.serial('IS NOT NULL Filter - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('IS NOT NULL on email column returns only rows with email', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await actions.addFilter('email', 'IS NOT NULL')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    // All visible rows should have a non-empty email
    const emails = await getAllColumnValues(window, 'email', rowCount)
    for (const val of emails) {
      expect(val).not.toBe('')
      expect(val.toLowerCase()).not.toBe('null')
    }
  })

  test('IS NOT NULL on phone column filters out null phones', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    // Get unfiltered count
    const unfilteredCount = await actions.getRowCount()
    expect(unfilteredCount).toBeGreaterThan(0)

    await actions.addFilter('phone', 'IS NOT NULL')
    await actions.applyFilters()

    const filteredCount = await actions.getRowCount()
    // Should execute without error; count depends on seed data
    expect(filteredCount).toBeGreaterThanOrEqual(0)
    expect(filteredCount).toBeLessThanOrEqual(unfilteredCount)
  })
})

// ---------------------------------------------------------------------------
// Comparison Operators - PostgreSQL
// ---------------------------------------------------------------------------

test.describe.serial('Comparison Operators - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('greater than filter on price: price > 50', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    await actions.addFilter('price', '>', '50')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    const prices = await getAllColumnValues(window, 'price', rowCount)
    for (const val of prices) {
      expect(parseFloat(val)).toBeGreaterThan(50)
    }
  })

  test('less than filter on price: price < 30', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    await actions.addFilter('price', '<', '30')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    const prices = await getAllColumnValues(window, 'price', rowCount)
    for (const val of prices) {
      expect(parseFloat(val)).toBeLessThan(30)
    }
  })

  test('greater than or equal filter: price >= 100', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    await actions.addFilter('price', '>=', '100')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    const prices = await getAllColumnValues(window, 'price', rowCount)
    for (const val of prices) {
      expect(parseFloat(val)).toBeGreaterThanOrEqual(100)
    }
  })

  test('less than or equal filter: price <= 20', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    await actions.addFilter('price', '<=', '20')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    const prices = await getAllColumnValues(window, 'price', rowCount)
    for (const val of prices) {
      expect(parseFloat(val)).toBeLessThanOrEqual(20)
    }
  })
})

// ---------------------------------------------------------------------------
// Multiple Filters - MySQL
// ---------------------------------------------------------------------------

test.describe.serial('Multiple Filters - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('add two filters on customers and verify results', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    const unfilteredCount = await actions.getRowCount()
    expect(unfilteredCount).toBeGreaterThan(0)

    // Filter: country = 'Spain' AND city = 'Madrid'
    await actions.addFilter('country', '=', 'Spain')
    await actions.addFilter('city', '=', 'Madrid')
    await actions.applyFilters()

    const filteredCount = await actions.getRowCount()
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThanOrEqual(unfilteredCount)

    const countries = await getAllColumnValues(window, 'country', filteredCount)
    const cities = await getAllColumnValues(window, 'city', filteredCount)
    for (const val of countries) {
      expect(val).toBe('Spain')
    }
    for (const val of cities) {
      expect(val).toBe('Madrid')
    }
  })

  test('add two filters on products and verify results', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('products')

    // Filter: category = 'Electronics' AND price > 40
    await actions.addFilter('category', '=', 'Electronics')
    await actions.addFilter('price', '>', '40')
    await actions.applyFilters()

    const filteredCount = await actions.getRowCount()
    expect(filteredCount).toBeGreaterThan(0)

    const categories = await getAllColumnValues(window, 'category', filteredCount)
    const prices = await getAllColumnValues(window, 'price', filteredCount)
    for (const val of categories) {
      expect(val).toBe('Electronics')
    }
    for (const val of prices) {
      expect(parseFloat(val)).toBeGreaterThan(40)
    }
  })
})

// ---------------------------------------------------------------------------
// Multiple Filters - SQLite
// ---------------------------------------------------------------------------

test.describe.serial('Multiple Filters - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('add two filters on customers and verify results', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('customers')

    const unfilteredCount = await actions.getRowCount()
    expect(unfilteredCount).toBeGreaterThan(0)

    // Filter: country = 'USA' AND name LIKE '%Johnson%'
    await actions.addFilter('country', '=', 'USA')
    await actions.addFilter('name', 'LIKE', '%Johnson%')
    await actions.applyFilters()

    const filteredCount = await actions.getRowCount()
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThanOrEqual(unfilteredCount)

    const countries = await getAllColumnValues(window, 'country', filteredCount)
    const names = await getAllColumnValues(window, 'name', filteredCount)
    for (const val of countries) {
      expect(val).toBe('USA')
    }
    for (const val of names) {
      expect(val.toLowerCase()).toContain('johnson')
    }
  })

  test('add two filters on products and verify results', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('products')

    // Filter: price >= 50 AND stock > 0
    await actions.addFilter('price', '>=', '50')
    await actions.addFilter('stock', '>', '0')
    await actions.applyFilters()

    const filteredCount = await actions.getRowCount()
    expect(filteredCount).toBeGreaterThan(0)

    const prices = await getAllColumnValues(window, 'price', filteredCount)
    const stocks = await getAllColumnValues(window, 'stock', filteredCount)
    for (const val of prices) {
      expect(parseFloat(val)).toBeGreaterThanOrEqual(50)
    }
    for (const val of stocks) {
      expect(parseInt(val, 10)).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Filter Remove and Reapply - PostgreSQL
// ---------------------------------------------------------------------------

test.describe.serial('Filter Remove and Reapply - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('add filter, apply, remove filter, apply again - all data returns', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    const unfilteredCount = await actions.getRowCount()
    expect(unfilteredCount).toBeGreaterThan(0)

    // Add and apply a filter
    await actions.addFilter('country', '=', 'USA')
    await actions.applyFilters()

    const filteredCount = await actions.getRowCount()
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThanOrEqual(unfilteredCount)

    // Remove the filter and apply again
    await actions.removeFilter(0)
    await actions.applyFilters()

    const restoredCount = await actions.getRowCount()
    expect(restoredCount).toBe(unfilteredCount)
  })

  test('add 3 filters, remove middle one (index 1), apply', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    // Add three filters
    await actions.addFilter('country', '=', 'USA')
    await actions.addFilter('city', '=', 'New York')
    await actions.addFilter('email', 'LIKE', '%@example.com')
    await actions.applyFilters()

    const countWithThree = await actions.getRowCount()
    expect(countWithThree).toBeGreaterThan(0)

    // Remove the middle filter (city = 'New York' at index 1)
    await actions.removeFilter(1)
    await actions.applyFilters()

    const countWithTwo = await actions.getRowCount()
    // With one fewer restriction, we should get at least as many rows
    expect(countWithTwo).toBeGreaterThanOrEqual(countWithThree)

    // All remaining rows should still match country = 'USA' and email LIKE '%@example.com'
    const countries = await getAllColumnValues(window, 'country', countWithTwo)
    const emails = await getAllColumnValues(window, 'email', countWithTwo)
    for (const val of countries) {
      expect(val).toBe('USA')
    }
    for (const val of emails) {
      expect(val).toContain('@example.com')
    }
  })
})

// ---------------------------------------------------------------------------
// Contains / Starts with - MySQL
// ---------------------------------------------------------------------------

test.describe.serial('Contains / Starts with - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('Contains filter on name column', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    await actions.addFilter('name', 'Contains', 'son')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThanOrEqual(0)

    if (rowCount > 0) {
      const names = await getAllColumnValues(window, 'name', rowCount)
      for (const val of names) {
        expect(val.toLowerCase()).toContain('son')
      }
    }
  })

  test('Starts with filter on name column', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    await actions.addFilter('name', 'Starts with', 'A')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThanOrEqual(0)

    if (rowCount > 0) {
      const names = await getAllColumnValues(window, 'name', rowCount)
      for (const val of names) {
        expect(val.charAt(0).toUpperCase()).toBe('A')
      }
    }
  })

  test('Ends with filter on email column', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    await actions.addFilter('email', 'Ends with', '@example.com')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    const emails = await getAllColumnValues(window, 'email', rowCount)
    for (const val of emails) {
      expect(val).toMatch(/@example\.com$/)
    }
  })
})

// ---------------------------------------------------------------------------
// Filter Persistence Across Tab Switches - PostgreSQL
// ---------------------------------------------------------------------------

test.describe.serial('Filter Persistence Across Tab Switches - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('filters persist after switching to another table and back', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open customers table and apply a filter
    await actions.openTable('customers')

    await actions.addFilter('country', '=', 'USA')
    await actions.applyFilters()

    const filteredCount = await actions.getRowCount()
    expect(filteredCount).toBeGreaterThan(0)

    // Verify all rows match the filter
    const countriesBefore = await getAllColumnValues(window, 'country', filteredCount)
    for (const val of countriesBefore) {
      expect(val).toBe('USA')
    }

    // Open another table (products)
    await actions.openTable('products')
    const grid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Switch back to the customers tab (PostgreSQL uses schema prefix in tab title)
    const customersTab = window.getByTestId('tab-public.customers')
    await customersTab.click()
    await window.waitForTimeout(1000)

    // The filter panel should still be visible with the filter applied
    const filterPanel = window.getByTestId('filter-panel')
    await expect(filterPanel).toBeVisible({ timeout: 5_000 })

    // Verify the filtered data is still showing
    const countAfterSwitch = await actions.getRowCount()
    expect(countAfterSwitch).toBe(filteredCount)

    const countriesAfter = await getAllColumnValues(window, 'country', countAfterSwitch)
    for (const val of countriesAfter) {
      expect(val).toBe('USA')
    }
  })

  test('filters on different tables are independent', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open customers and apply a filter
    await actions.openTable('customers')

    await actions.addFilter('country', '=', 'Japan')
    await actions.applyFilters()

    const customersFiltered = await actions.getRowCount()
    expect(customersFiltered).toBeGreaterThan(0)

    const countries = await getAllColumnValues(window, 'country', customersFiltered)
    for (const val of countries) {
      expect(val).toBe('Japan')
    }

    // Open products table - should not have the customers filter
    await actions.openTable('products')
    const productsGrid = window.locator('[data-testid="data-grid-table"]:visible').first()
    await expect(productsGrid).toBeVisible({ timeout: 10_000 })

    const productsCount = await actions.getRowCount()
    // Products should show all rows (no filter from customers carried over)
    expect(productsCount).toBeGreaterThan(0)

    // Switch back to customers tab and verify filter is still active (PostgreSQL uses schema prefix)
    const customersTab = window.getByTestId('tab-public.customers')
    await customersTab.click()
    await window.waitForTimeout(1000)

    const countAfterSwitch = await actions.getRowCount()
    expect(countAfterSwitch).toBe(customersFiltered)
  })
})
