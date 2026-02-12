import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { connectTo } from '@e2e/helpers/connect'

let app: ElectronApplication
let window: Page

// ---------------------------------------------------------------------------
// Redis – Keys Visible
// ---------------------------------------------------------------------------
test.describe('Redis Keys Visible', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('keys are visible in the sidebar after connecting', async () => {
    await connectTo(window, 'redis')

    // Verify at least one Redis key appears in the sidebar
    const redisKeys = window.locator('[data-testid^="sidebar-redis-key-"]')
    await expect(redisKeys.first()).toBeVisible({ timeout: 10_000 })

    // Verify a known string key is visible
    await expect(
      window.getByTestId('sidebar-redis-key-app:config:site_name')
    ).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Redis – Browse String Key
// ---------------------------------------------------------------------------
test.describe('Redis Browse String Key', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('browse string key shows its value', async () => {
    const actions = await connectTo(window, 'redis')

    await actions.openRedisKey('app:config:site_name')

    // Data grid should be visible
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // The grid should contain the string value "Zequel Store"
    await expect(grid).toContainText('Zequel Store', { timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Redis – Browse Hash Key
// ---------------------------------------------------------------------------
test.describe('Redis Browse Hash Key', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('browse hash key shows field-value pairs', async () => {
    const actions = await connectTo(window, 'redis')

    await actions.openRedisKey('user:1')

    // Data grid should be visible
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // Verify hash fields are displayed (user:1 has name, email, city, country, orders, total_spent)
    await expect(grid).toContainText('name', { timeout: 10_000 })
    await expect(grid).toContainText('email', { timeout: 10_000 })
    await expect(grid).toContainText('city', { timeout: 10_000 })
    await expect(grid).toContainText('country', { timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// Redis – Browse List Key
// ---------------------------------------------------------------------------
test.describe('Redis Browse List Key', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('browse list key shows list items', async () => {
    const actions = await connectTo(window, 'redis')

    await actions.openRedisKey('queue:emails')

    // Data grid should be visible
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // The grid should contain at least one row of data
    const rows = grid.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 10_000 })
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Redis – Browse Set Key
// ---------------------------------------------------------------------------
test.describe('Redis Browse Set Key', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('browse set key shows set members', async () => {
    const actions = await connectTo(window, 'redis')

    await actions.openRedisKey('tags:popular')

    // Data grid should be visible
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // The grid should contain at least one row with set members
    const rows = grid.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 10_000 })
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Redis – Browse Sorted Set Key
// ---------------------------------------------------------------------------
test.describe('Redis Browse Sorted Set Key', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  test('browse sorted set key shows members with scores', async () => {
    const actions = await connectTo(window, 'redis')

    await actions.openRedisKey('leaderboard:spending')

    // Data grid should be visible
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // The grid should contain at least one row with sorted set members and scores
    const rows = grid.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 10_000 })
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)

    // Sorted sets display a score column — verify the grid contains score data
    await expect(grid).toContainText('score', { timeout: 10_000 })
  })
})
