/**
 * Real round-trip of the driver-based Redis backup (the fix for the unrestorable `--rdb`
 * bug): populate keys of every type → serialize → flush → deserialize → assert identical,
 * including TTL and emoji. Works over any connection, including SSH tunnels. Skips
 * gracefully if the container isn't running.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('@main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { RedisDriver } from '@main/db/redis'
import {
  serializeRedis,
  deserializeRedis,
} from '@main/services/backup/native/redis-serializer'

const REDIS = {
  type: 'redis',
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 63790),
  password: process.env.REDIS_PASSWORD || 'zequel',
  database: '0',
}

describe('Redis driver-based backup round-trip', () => {
  let driver: RedisDriver | null = null

  beforeAll(async () => {
    driver = new RedisDriver()
    try {
      await driver.connect(REDIS as never)
    } catch {
      driver = null
    }
  })

  afterAll(async () => {
    if (driver) {
      try { await driver.getClient().flushdb() } catch { /* ignore */ }
      await driver.disconnect()
    }
  })

  it('round-trips string/list/set/hash/zset keys with TTL and emoji', async () => {
    if (!driver) {
      console.warn('Skipping — Redis container not available')
      return
    }

    const client = driver.getClient()
    await client.flushdb()
    await client.set('greeting', 'héllo 🎉')
    await client.expire('greeting', 1000)
    await client.rpush('tasks', 'a', 'b', 'c')
    await client.sadd('tags', 'x', 'y')
    await client.hset('user', 'name', 'café ☕', 'age', '42')
    await client.zadd('board', 1, 'first', 2, 'second')

    // Back up via the driver, then wipe the database.
    const json = await serializeRedis(driver)
    expect(json).toContain('🎉')
    await client.flushdb()
    expect(await client.dbsize()).toBe(0)

    // Restore and verify every type came back identical.
    const result = await deserializeRedis(driver, json)
    expect(result.errors).toEqual([])

    expect(await client.get('greeting')).toBe('héllo 🎉')
    expect(await client.ttl('greeting')).toBeGreaterThan(0)
    expect(await client.lrange('tasks', 0, -1)).toEqual(['a', 'b', 'c'])
    expect((await client.smembers('tags')).sort()).toEqual(['x', 'y'])
    expect(await client.hgetall('user')).toEqual({ name: 'café ☕', age: '42' })
    expect(await client.zrange('board', 0, -1)).toEqual(['first', 'second'])
  })
})
