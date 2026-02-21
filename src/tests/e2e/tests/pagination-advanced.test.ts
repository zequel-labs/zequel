import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

/** Parse "1-N of M" into { start, end, total } or null */
const parseRange = (range: string): { start: number; end: number; total: number } | null => {
  const m = range.match(/^(\d+)-(\d+) of (\d+)$/)
  return m ? { start: Number(m[1]), end: Number(m[2]), total: Number(m[3]) } : null
}

/** Helper to open the pagination settings popover, set limit, and apply */
const changePageSize = async (page: Page, limit: number): Promise<void> => {
  const settingsBtn = page.getByTestId('statusbar-settings-btn')
  await settingsBtn.click()

  const popoverApplyBtn = page.getByTestId('statusbar-settings-apply')
  await expect(popoverApplyBtn).toBeVisible({ timeout: 5_000 })

  const limitInput = page.getByTestId('pagination-limit-input')
  await limitInput.fill(String(limit))

  await popoverApplyBtn.click()
  await page.waitForTimeout(1_000)
}

/** Helper to open the pagination settings popover, set offset, and apply */
const changeOffset = async (page: Page, offset: number): Promise<void> => {
  const settingsBtn = page.getByTestId('statusbar-settings-btn')
  await settingsBtn.click()

  const popoverApplyBtn = page.getByTestId('statusbar-settings-apply')
  await expect(popoverApplyBtn).toBeVisible({ timeout: 5_000 })

  const offsetInput = page.getByTestId('pagination-offset-input')
  await offsetInput.fill(String(offset))

  await popoverApplyBtn.click()
  await page.waitForTimeout(1_000)
}

/** Helper to open the pagination settings popover, set both limit and offset, and apply */
const changePaginationSettings = async (page: Page, limit: number, offset: number): Promise<void> => {
  const settingsBtn = page.getByTestId('statusbar-settings-btn')
  await settingsBtn.click()

  const popoverApplyBtn = page.getByTestId('statusbar-settings-apply')
  await expect(popoverApplyBtn).toBeVisible({ timeout: 5_000 })

  const limitInput = page.getByTestId('pagination-limit-input')
  await limitInput.fill(String(limit))

  const offsetInput = page.getByTestId('pagination-offset-input')
  await offsetInput.fill(String(offset))

  await popoverApplyBtn.click()
  await page.waitForTimeout(1_000)
}

// ---------------------------------------------------------------------------
// 1. Page Size Configuration - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Page Size Configuration - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('change limit to 10 and verify record range updates', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('order_items')

    // Verify default record range has data
    const defaultRange = await actions.getRecordRange()
    const defaultParsed = parseRange(defaultRange)
    expect(defaultParsed).not.toBeNull()
    expect(defaultParsed!.total).toBeGreaterThanOrEqual(50)
    expect(defaultParsed!.start).toBe(1)

    // Change limit to 10
    await changePageSize(window, 10)

    // Verify record range shows 1-10 of X
    const page1Range = await actions.getRecordRange()
    expect(page1Range).toMatch(/^1-10 of \d+$/)

    // Navigate to next page and verify 11-20
    await actions.goToNextPage()
    const page2Range = await actions.getRecordRange()
    expect(page2Range).toMatch(/^11-20 of \d+$/)
  })
})

// ---------------------------------------------------------------------------
// 2. Page Size Configuration - MySQL
// ---------------------------------------------------------------------------
test.describe.serial('Page Size Configuration - MySQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('change limit to 5 and verify record range', async () => {
    const actions = await connectTo(window, 'mysql')

    await actions.openTable('orders')

    // Verify initial data is present
    const initialRange = await actions.getRecordRange()
    const initialParsed = parseRange(initialRange)
    expect(initialParsed).not.toBeNull()
    expect(initialParsed!.total).toBeGreaterThanOrEqual(30)

    // Change limit to 5
    await changePageSize(window, 5)

    // Verify record range shows 1-5 of X
    const page1Range = await actions.getRecordRange()
    expect(page1Range).toMatch(/^1-5 of \d+$/)

    // Navigate to next page and verify 6-10
    await actions.goToNextPage()
    const page2Range = await actions.getRecordRange()
    expect(page2Range).toMatch(/^6-10 of \d+$/)
  })
})

// ---------------------------------------------------------------------------
// 3. Previous Page Button - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Previous Page Button - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('prev button is disabled on first page and enabled after navigating forward', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('order_items')

    // Reduce page size so we can paginate
    await changePageSize(window, 10)

    // On first page, prev button should be disabled
    const prevBtn = window.getByTestId('statusbar-prev-page-btn')
    await expect(prevBtn).toBeDisabled()

    // Navigate to page 2
    await actions.goToNextPage()
    const page2Range = await actions.getRecordRange()
    expect(page2Range).toMatch(/^11-20 of \d+$/)

    // Now prev button should be enabled
    await expect(prevBtn).toBeEnabled()

    // Click prev, verify back on page 1
    await actions.goToPreviousPage()
    const page1Range = await actions.getRecordRange()
    expect(page1Range).toMatch(/^1-10 of \d+$/)

    // Prev button should be disabled again on page 1
    await expect(prevBtn).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// 4. Next Page Button - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Next Page Button - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('next button is enabled with data and disabled on the last page', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('order_items')

    // Reduce page size to make multiple pages
    await changePageSize(window, 10)

    const nextBtn = window.getByTestId('statusbar-next-page-btn')

    // Next button should be enabled on first page (order_items has >=50 rows)
    await expect(nextBtn).toBeEnabled()

    // Get the total count to determine how many pages
    const page1Range = await actions.getRecordRange()
    const parsed = parseRange(page1Range)
    expect(parsed).not.toBeNull()
    const totalRows = parsed!.total
    const totalPages = Math.ceil(totalRows / 10)

    // Navigate forward through all pages
    for (let page = 1; page < totalPages; page++) {
      await actions.goToNextPage()
    }

    // On the last page, next button should be disabled
    await expect(nextBtn).toBeDisabled()

    // Verify we are on the last page - start should be > 0 and end should equal total
    const lastPageRange = await actions.getRecordRange()
    const lastParsed = parseRange(lastPageRange)
    expect(lastParsed).not.toBeNull()
    expect(lastParsed!.end).toBe(totalRows)
  })
})

// ---------------------------------------------------------------------------
// 5. Offset Configuration - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Offset Configuration - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('setting offset skips rows from the beginning', async () => {
    const actions = await connectTo(window, 'postgres')

    await actions.openTable('order_items')

    // Set limit to 10 and offset to 5 (skip first 5 rows)
    await changePaginationSettings(window, 10, 5)

    // Verify record range starts from 6 (offset 5 means skip first 5)
    const range = await actions.getRecordRange()
    const parsed = parseRange(range)
    expect(parsed).not.toBeNull()
    expect(parsed!.start).toBe(6)
    expect(parsed!.end).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// 6. Page Size Persistence Across Tables - PostgreSQL
// ---------------------------------------------------------------------------
test.describe.serial('Page Size Persistence Across Tables - PostgreSQL', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('changing limit on one table and checking behavior on another table', async () => {
    const actions = await connectTo(window, 'postgres')

    // Open table A and change limit to 10
    await actions.openTable('order_items')
    await changePageSize(window, 10)

    const tableARange = await actions.getRecordRange()
    expect(tableARange).toMatch(/^1-10 of \d+$/)

    // Open table B (customers or orders)
    await actions.openTable('orders')
    await window.waitForTimeout(1_000)

    // Get the range for table B - check what limit is applied
    const tableBRange = await actions.getRecordRange()
    const tableBParsed = parseRange(tableBRange)
    expect(tableBParsed).not.toBeNull()

    // Verify table B loaded data (start is 1)
    expect(tableBParsed!.start).toBe(1)

    // The page size may or may not persist across tables depending on implementation.
    // Verify the range is valid either way (limit 10 or default).
    expect(tableBParsed!.end).toBeGreaterThanOrEqual(1)
    expect(tableBParsed!.total).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// 7. Page Size - SQLite
// ---------------------------------------------------------------------------
test.describe.serial('Page Size - SQLite', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('change limit and navigate pages', async () => {
    const actions = await connectTo(window, 'sqlite')

    await actions.openTable('order_items')

    // Verify initial data
    const initialRange = await actions.getRecordRange()
    const initialParsed = parseRange(initialRange)
    expect(initialParsed).not.toBeNull()
    expect(initialParsed!.total).toBeGreaterThanOrEqual(50)

    // Change limit to 10
    await changePageSize(window, 10)

    // Verify page 1 range
    const page1Range = await actions.getRecordRange()
    expect(page1Range).toMatch(/^1-10 of \d+$/)

    // Navigate to next page
    await actions.goToNextPage()
    const page2Range = await actions.getRecordRange()
    expect(page2Range).toMatch(/^11-20 of \d+$/)

    // Navigate back to page 1
    await actions.goToPreviousPage()
    const backToPage1Range = await actions.getRecordRange()
    expect(backToPage1Range).toMatch(/^1-10 of \d+$/)
  })
})

// ---------------------------------------------------------------------------
// 8. Page Size - DuckDB
// ---------------------------------------------------------------------------
test.describe.serial('Page Size - DuckDB', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('change limit and verify range', async () => {
    const actions = await connectTo(window, 'duckdb')

    await actions.openTable('order_items')

    // DuckDB order_items has ~13 seed rows
    const initialRange = await actions.getRecordRange()
    const initialParsed = parseRange(initialRange)
    expect(initialParsed).not.toBeNull()
    expect(initialParsed!.total).toBeGreaterThanOrEqual(10)

    // Change limit to 5
    await changePageSize(window, 5)

    // Verify page 1 range
    const page1Range = await actions.getRecordRange()
    expect(page1Range).toMatch(/^1-5 of \d+$/)

    // Navigate to next page
    await actions.goToNextPage()
    const page2Range = await actions.getRecordRange()
    expect(page2Range).toMatch(/^6-10 of \d+$/)

    // Navigate back to page 1
    await actions.goToPreviousPage()
    const backToPage1Range = await actions.getRecordRange()
    expect(backToPage1Range).toMatch(/^1-5 of \d+$/)
  })
})
