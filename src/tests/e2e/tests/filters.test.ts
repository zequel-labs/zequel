import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getCellText = async (page: Page, row: number, column: string): Promise<string> => {
  const cell = page.getByTestId(`grid-cell-${row}-${column}`)
  return (await cell.innerText()).trim()
}

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
// PostgreSQL Filters
// ---------------------------------------------------------------------------

test.describe('PostgreSQL Filters', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('filter by equality: country = "USA"', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await actions.addFilter('country', '=', 'USA')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)
    expect(rowCount).toBeLessThan(20)

    const values = await getAllColumnValues(window, 'country', rowCount)
    for (const val of values) {
      expect(val).toBe('USA')
    }
  })

  test('filter by comparison: price > 100', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('products')

    await actions.addFilter('price', '>', '100')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    const values = await getAllColumnValues(window, 'price', rowCount)
    for (const val of values) {
      expect(parseFloat(val)).toBeGreaterThan(100)
    }
  })

  test('filter IS NULL: phone IS NULL', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await actions.addFilter('phone', 'IS NULL')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    // May be 0 if all customers have phones, but the filter should execute without error
    expect(rowCount).toBeGreaterThanOrEqual(0)
    expect(rowCount).toBeLessThanOrEqual(20)
  })

  test('filter LIKE: name LIKE "%John%"', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('customers')

    await actions.addFilter('name', 'LIKE', '%John%')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThanOrEqual(0)

    if (rowCount > 0) {
      const values = await getAllColumnValues(window, 'name', rowCount)
      for (const val of values) {
        expect(val.toLowerCase()).toContain('john')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// MySQL Filters
// ---------------------------------------------------------------------------

test.describe('MySQL Filters', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('filter by equality: country = "USA"', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    await actions.addFilter('country', '=', 'USA')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)
    expect(rowCount).toBeLessThan(20)

    const values = await getAllColumnValues(window, 'country', rowCount)
    for (const val of values) {
      expect(val).toBe('USA')
    }
  })

  test('filter by Contains: name Contains "son"', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    await actions.addFilter('name', 'Contains', 'son')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThanOrEqual(0)

    if (rowCount > 0) {
      const values = await getAllColumnValues(window, 'name', rowCount)
      for (const val of values) {
        expect(val.toLowerCase()).toContain('son')
      }
    }
  })

  test('filter multiple: country = "Spain" AND city = "Madrid"', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('customers')

    await actions.addFilter('country', '=', 'Spain')
    await actions.addFilter('city', '=', 'Madrid')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)
    expect(rowCount).toBeLessThan(20)

    const countries = await getAllColumnValues(window, 'country', rowCount)
    const cities = await getAllColumnValues(window, 'city', rowCount)
    for (const val of countries) {
      expect(val).toBe('Spain')
    }
    for (const val of cities) {
      expect(val).toBe('Madrid')
    }
  })
})

// ---------------------------------------------------------------------------
// MariaDB Filters
// ---------------------------------------------------------------------------

test.describe('MariaDB Filters', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('filter by equality: country = "Japan"', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openTable('customers')

    await actions.addFilter('country', '=', 'Japan')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)
    expect(rowCount).toBeLessThan(20)

    const values = await getAllColumnValues(window, 'country', rowCount)
    for (const val of values) {
      expect(val).toBe('Japan')
    }
  })

  test('filter by comparison: price <= 50', async () => {
    const actions = await connectTo(window, 'mariadb')

    await actions.openTable('products')

    await actions.addFilter('price', '<=', '50')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    const values = await getAllColumnValues(window, 'price', rowCount)
    for (const val of values) {
      expect(parseFloat(val)).toBeLessThanOrEqual(50)
    }
  })
})

// ---------------------------------------------------------------------------
// SQLite Filters
// ---------------------------------------------------------------------------

test.describe('SQLite Filters', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('filter by equality: country = "USA"', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('customers')

    await actions.addFilter('country', '=', 'USA')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)
    expect(rowCount).toBeLessThan(20)

    const values = await getAllColumnValues(window, 'country', rowCount)
    for (const val of values) {
      expect(val).toBe('USA')
    }
  })

  test('filter LIKE pattern: name LIKE "A%"', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('customers')

    await actions.addFilter('name', 'LIKE', 'A%')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThanOrEqual(0)

    if (rowCount > 0) {
      const values = await getAllColumnValues(window, 'name', rowCount)
      for (const val of values) {
        expect(val.charAt(0).toUpperCase()).toBe('A')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// DuckDB Filters
// ---------------------------------------------------------------------------

test.describe('DuckDB Filters', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('filter by equality: is_active = "true"', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openTable('users')

    await actions.addFilter('is_active', '=', 'true')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)
    expect(rowCount).toBeLessThan(20)
  })

  test('filter by comparison: price > 50', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openTable('products')

    await actions.addFilter('price', '>', '50')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    const values = await getAllColumnValues(window, 'price', rowCount)
    for (const val of values) {
      expect(parseFloat(val)).toBeGreaterThan(50)
    }
  })
})

// ---------------------------------------------------------------------------
// ClickHouse Filters
// ---------------------------------------------------------------------------

test.describe('ClickHouse Filters', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('filter by equality: event_type = "purchase"', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openTable('events')

    // Get the unfiltered row count first (up to page size)
    const unfilteredRowCount = await actions.getRowCount()
    expect(unfilteredRowCount).toBeGreaterThan(0)

    await actions.addFilter('event_type', '=', 'purchase')
    await actions.applyFilters()

    const filteredRowCount = await actions.getRowCount()
    expect(filteredRowCount).toBeGreaterThan(0)
    expect(filteredRowCount).toBeLessThan(100)

    const values = await getAllColumnValues(window, 'event_type', filteredRowCount)
    for (const val of values) {
      expect(val).toBe('purchase')
    }
  })

  test('filter by equality: device = "mobile"', async () => {
    const actions = await connectTo(window, 'clickhouse')

    await actions.openTable('events')

    await actions.addFilter('device', '=', 'mobile')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)

    const values = await getAllColumnValues(window, 'device', rowCount)
    for (const val of values) {
      expect(val).toBe('mobile')
    }
  })
})

// ---------------------------------------------------------------------------
// MongoDB Filters
// ---------------------------------------------------------------------------

test.describe('MongoDB Filters', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('filter by equality: country = "USA"', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollection('customers')

    await actions.addFilter('country', '=', 'USA')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThan(0)
    expect(rowCount).toBeLessThan(20)

    const values = await getAllColumnValues(window, 'country', rowCount)
    for (const val of values) {
      expect(val).toBe('USA')
    }
  })

  test('filter by Contains: name Contains "Alice"', async () => {
    const actions = await connectTo(window, 'mongodb')

    await actions.openCollection('customers')

    await actions.addFilter('name', 'Contains', 'Alice')
    await actions.applyFilters()

    const rowCount = await actions.getRowCount()
    expect(rowCount).toBeGreaterThanOrEqual(0)

    if (rowCount > 0) {
      const values = await getAllColumnValues(window, 'name', rowCount)
      for (const val of values) {
        expect(val).toContain('Alice')
      }
    }
  })
})
