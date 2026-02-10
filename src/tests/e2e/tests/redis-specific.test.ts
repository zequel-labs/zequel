import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

test.describe('Redis Specific', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'redis')
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('keys are visible in the sidebar after connecting', async () => {
    // Verify at least one Redis key appears in the sidebar
    const redisKeys = window.locator('[data-testid^="sidebar-redis-key-"]')
    await expect(redisKeys.first()).toBeVisible({ timeout: 10_000 })

    // Verify a known string key is visible
    await expect(
      window.getByTestId('sidebar-redis-key-app:config:site_name')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('browse string key shows its value', async () => {
    await actions.openRedisKey('app:config:site_name')

    // Data grid should be visible
    const grid = window.getByTestId('data-grid-table')
    await expect(grid).toBeVisible({ timeout: 10_000 })

    // The grid should contain the string value "Zequel Store"
    await expect(grid).toContainText('Zequel Store', { timeout: 10_000 })
  })

  test('browse hash key shows field-value pairs', async () => {
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

  test('browse list key shows list items', async () => {
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

  test('browse set key shows set members', async () => {
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

  test('browse sorted set key shows members with scores', async () => {
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
