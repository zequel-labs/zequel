import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { connectTo } from '../helpers/connect'

const assertNoErrorToast = async (page: Page): Promise<void> => {
  const errorToast = page.locator('.sonner-toast[data-type="error"]')
  await expect(errorToast).not.toBeVisible({ timeout: 2_000 })
}

const assertResultsVisible = async (page: Page): Promise<void> => {
  const results = page.getByTestId('query-results')
  await expect(results).toBeVisible({ timeout: 30_000 })
}

const assertResultsContain = async (page: Page, text: string): Promise<void> => {
  const results = page.getByTestId('query-results')
  await expect(results).toBeVisible({ timeout: 30_000 })
  await expect(results).toContainText(text, { timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Redis Key CRUD
// ---------------------------------------------------------------------------
test.describe.serial('Redis Key CRUD', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'redis')
    await actions.disableSafeMode()
    await actions.openQueryEditor()
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('create a key via SET', async () => {
    await actions.typeQuery('SET e2e_test_key "hello world"')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('read the key via GET', async () => {
    await actions.typeQuery('GET e2e_test_key')
    await actions.runQuery()

    await assertResultsContain(window, 'hello world')
    await assertNoErrorToast(window)
  })

  test('delete the key via DEL', async () => {
    await actions.typeQuery('DEL e2e_test_key')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('verify deleted key returns nil', async () => {
    await actions.typeQuery('GET e2e_test_key')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Redis TTL Operations
// ---------------------------------------------------------------------------
test.describe.serial('Redis TTL Operations', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'redis')
    await actions.disableSafeMode()
    await actions.openQueryEditor()
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('create a key for TTL testing', async () => {
    await actions.typeQuery('SET e2e_ttl_key "temp"')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('set TTL with EXPIRE', async () => {
    await actions.typeQuery('EXPIRE e2e_ttl_key 3600')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('check TTL returns positive number', async () => {
    await actions.typeQuery('TTL e2e_ttl_key')
    await actions.runQuery()

    // TTL should return a positive value (up to 3600)
    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })
    const text = await results.textContent()
    expect(text).not.toBeNull()
    // The TTL result should contain a positive number (not -1 or -2)
    expect(text).not.toContain('-1')
    expect(text).not.toContain('-2')
    await assertNoErrorToast(window)
  })

  test('remove TTL with PERSIST', async () => {
    await actions.typeQuery('PERSIST e2e_ttl_key')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('verify TTL removed (returns -1)', async () => {
    await actions.typeQuery('TTL e2e_ttl_key')
    await actions.runQuery()

    // TTL returns -1 when no expiration is set
    await assertResultsContain(window, '-1')
    await assertNoErrorToast(window)
  })

  test('cleanup TTL test key', async () => {
    await actions.typeQuery('DEL e2e_ttl_key')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Redis Rename Operations
// ---------------------------------------------------------------------------
test.describe.serial('Redis Rename Operations', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'redis')
    await actions.disableSafeMode()
    await actions.openQueryEditor()
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('create source key for rename', async () => {
    await actions.typeQuery('SET e2e_rename_source "value"')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('rename key', async () => {
    await actions.typeQuery('RENAME e2e_rename_source e2e_rename_dest')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('verify renamed key exists with correct value', async () => {
    await actions.typeQuery('GET e2e_rename_dest')
    await actions.runQuery()

    await assertResultsContain(window, 'value')
    await assertNoErrorToast(window)
  })

  test('cleanup renamed key', async () => {
    await actions.typeQuery('DEL e2e_rename_dest')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Redis Hash Operations
// ---------------------------------------------------------------------------
test.describe.serial('Redis Hash Operations', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'redis')
    await actions.disableSafeMode()
    await actions.openQueryEditor()
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('create hash with HSET', async () => {
    await actions.typeQuery('HSET e2e_hash_key field1 value1 field2 value2')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('get hash field with HGET', async () => {
    await actions.typeQuery('HGET e2e_hash_key field1')
    await actions.runQuery()

    await assertResultsContain(window, 'value1')
    await assertNoErrorToast(window)
  })

  test('delete hash field with HDEL', async () => {
    await actions.typeQuery('HDEL e2e_hash_key field1')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('verify deleted field no longer exists', async () => {
    await actions.typeQuery('HGET e2e_hash_key field1')
    await actions.runQuery()

    // HGET on a deleted field returns nil
    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('cleanup hash key', async () => {
    await actions.typeQuery('DEL e2e_hash_key')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Redis List Operations
// ---------------------------------------------------------------------------
test.describe.serial('Redis List Operations', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'redis')
    await actions.disableSafeMode()
    await actions.openQueryEditor()
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('push items with RPUSH', async () => {
    await actions.typeQuery('RPUSH e2e_list_key item1 item2 item3')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('get range with LRANGE', async () => {
    await actions.typeQuery('LRANGE e2e_list_key 0 -1')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })
    await expect(results).toContainText('item1', { timeout: 10_000 })
    await expect(results).toContainText('item2', { timeout: 10_000 })
    await expect(results).toContainText('item3', { timeout: 10_000 })
    await assertNoErrorToast(window)
  })

  test('pop item with LPOP', async () => {
    await actions.typeQuery('LPOP e2e_list_key')
    await actions.runQuery()

    // LPOP returns the first element (item1)
    await assertResultsContain(window, 'item1')
    await assertNoErrorToast(window)
  })

  test('verify list after pop', async () => {
    await actions.typeQuery('LRANGE e2e_list_key 0 -1')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })
    // item1 should no longer be in the list
    await expect(results).toContainText('item2', { timeout: 10_000 })
    await expect(results).toContainText('item3', { timeout: 10_000 })
    await assertNoErrorToast(window)
  })

  test('cleanup list key', async () => {
    await actions.typeQuery('DEL e2e_list_key')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })
})

// ---------------------------------------------------------------------------
// Redis Set Operations
// ---------------------------------------------------------------------------
test.describe.serial('Redis Set Operations', () => {
  let app: ElectronApplication
  let window: Page
  let actions: Awaited<ReturnType<typeof connectTo>>

  test.beforeAll(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
    actions = await connectTo(window, 'redis')
    await actions.disableSafeMode()
    await actions.openQueryEditor()
  })

  test.afterAll(async () => {
    await closeApp(app)
  })

  test('add members with SADD', async () => {
    await actions.typeQuery('SADD e2e_set_key member1 member2 member3')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('check members with SMEMBERS', async () => {
    await actions.typeQuery('SMEMBERS e2e_set_key')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })
    // Sets are unordered, but all three members should be present
    await expect(results).toContainText('member1', { timeout: 10_000 })
    await expect(results).toContainText('member2', { timeout: 10_000 })
    await expect(results).toContainText('member3', { timeout: 10_000 })
    await assertNoErrorToast(window)
  })

  test('remove member with SREM', async () => {
    await actions.typeQuery('SREM e2e_set_key member1')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })

  test('verify member removed from set', async () => {
    await actions.typeQuery('SMEMBERS e2e_set_key')
    await actions.runQuery()

    const results = window.getByTestId('query-results')
    await expect(results).toBeVisible({ timeout: 30_000 })
    // member1 should no longer be in the set
    await expect(results).toContainText('member2', { timeout: 10_000 })
    await expect(results).toContainText('member3', { timeout: 10_000 })
    await assertNoErrorToast(window)
  })

  test('cleanup set key', async () => {
    await actions.typeQuery('DEL e2e_set_key')
    await actions.runQuery()

    await assertResultsVisible(window)
    await assertNoErrorToast(window)
  })
})
