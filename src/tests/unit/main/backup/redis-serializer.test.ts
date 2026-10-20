import { describe, it, expect, vi } from 'vitest'

vi.mock('@main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { serializeRedis, deserializeRedis } from '@main/services/backup/native/redis-serializer'
import type { RedisDriver } from '@main/db/redis'

// A minimal in-memory fake of the ioredis-style client used by serializeRedis/deserializeRedis.
const makeFakeClient = (overrides: Record<string, unknown> = {}) => ({
  type: vi.fn(),
  ttl: vi.fn(() => Promise.resolve(-1)),
  get: vi.fn(),
  lrange: vi.fn(),
  smembers: vi.fn(),
  hgetall: vi.fn(),
  zrange: vi.fn(),
  xrange: vi.fn(),
  set: vi.fn(() => Promise.resolve('OK')),
  del: vi.fn(() => Promise.resolve(1)),
  rpush: vi.fn(() => Promise.resolve(1)),
  sadd: vi.fn(() => Promise.resolve(1)),
  hset: vi.fn(() => Promise.resolve(1)),
  zadd: vi.fn(() => Promise.resolve(1)),
  xadd: vi.fn(() => Promise.resolve('1-0')),
  rename: vi.fn(() => Promise.resolve('OK')),
  renamenx: vi.fn(() => Promise.resolve(1)),
  expire: vi.fn(() => Promise.resolve(1)),
  ...overrides,
})

const makeDriver = (client: ReturnType<typeof makeFakeClient>, keys: string[]): RedisDriver =>
  ({ getClient: () => client, getAllKeys: () => Promise.resolve(keys) }) as unknown as RedisDriver

describe('serializeRedis', () => {
  it('serializes a string key with TTL into the wrapped JSON format', async () => {
    const client = makeFakeClient({
      type: vi.fn(() => Promise.resolve('string')),
      ttl: vi.fn(() => Promise.resolve(120)),
      get: vi.fn(() => Promise.resolve('hello')),
    })
    const json = await serializeRedis(makeDriver(client, ['greeting']))
    const parsed = JSON.parse(json)

    expect(parsed._meta.type).toBe('redis')
    expect(parsed._meta.keyCount).toBe(1)
    expect(parsed.data.greeting).toEqual({ type: 'string', value: 'hello', ttl: 120 })
  })

  it('serializes a zset as member/score pairs', async () => {
    const client = makeFakeClient({
      type: vi.fn(() => Promise.resolve('zset')),
      zrange: vi.fn(() => Promise.resolve(['a', '1', 'b', '2'])),
    })
    const json = await serializeRedis(makeDriver(client, ['board']))
    const parsed = JSON.parse(json)

    expect(parsed.data.board.value).toEqual([
      { member: 'a', score: '1' },
      { member: 'b', score: '2' },
    ])
  })
})

describe('deserializeRedis', () => {
  it('restores a string key and re-applies a positive TTL', async () => {
    const client = makeFakeClient()
    const content = JSON.stringify({
      _meta: { type: 'redis', version: 1 },
      data: { greeting: { type: 'string', value: 'hello', ttl: 120 } },
    })

    const result = await deserializeRedis(makeDriver(client, []), content)

    expect(result.successCount).toBe(1)
    expect(result.errors).toEqual([])
    expect(client.set).toHaveBeenCalledWith(expect.stringMatching(/^__zequel_restore_/), 'hello')
    expect(client.expire).toHaveBeenCalledWith(expect.stringMatching(/^__zequel_restore_/), 120)
  })

  it('accepts the plain (unwrapped) format and restores a list in order', async () => {
    const client = makeFakeClient()
    const content = JSON.stringify({
      tasks: { type: 'list', value: ['a', 'b', 'c'], ttl: -1 },
    })

    const result = await deserializeRedis(makeDriver(client, []), content)

    expect(result.successCount).toBe(1)
    expect(client.del).not.toHaveBeenCalledWith('tasks')
    expect(client.renamenx).toHaveBeenCalledWith(expect.any(String), 'tasks')
    expect(client.rpush).toHaveBeenCalledWith(expect.any(String), 'a', 'b', 'c')
    expect(client.expire).not.toHaveBeenCalled()
  })
})

describe('legacy Redis destination safety', () => {
  it('preserves an existing destination unless replacement is explicitly enabled', async () => {
    const client = makeFakeClient({ renamenx: vi.fn(async () => 0) })
    const content = JSON.stringify({ key: { type: 'string', value: 'replacement', ttl: -1 } })
    expect(await deserializeRedis(makeDriver(client, []), content)).toMatchObject({ successCount: 0, errors: [expect.stringContaining('already exists')] })
    expect(client.rename).not.toHaveBeenCalled()
    expect(client.del).not.toHaveBeenCalledWith('key')
    expect(await deserializeRedis(makeDriver(client, []), content, undefined, true)).toEqual({ successCount: 1, errors: [] })
    expect(client.rename).toHaveBeenCalledWith(expect.any(String), 'key')
  })

  it('rejects an unknown format or malformed later entry before writing any key', async () => {
    const client = makeFakeClient()
    const data = { first: { type: 'string', value: 'valid', ttl: -1 }, later: { type: 'module', value: 'invalid', ttl: -1 } }
    await expect(deserializeRedis(makeDriver(client, []), JSON.stringify(data))).rejects.toThrow('Invalid legacy Redis entry')
    await expect(deserializeRedis(makeDriver(client, []), JSON.stringify({ _meta: { type: 'redis', version: 9 }, data }))).rejects.toThrow('Unsupported')
    expect(client.set).not.toHaveBeenCalled()
  })

  it('preserves stream IDs and removes staging keys after cancellation', async () => {
    const controller = new AbortController()
    const client = makeFakeClient({ xadd: vi.fn(async () => { controller.abort(); return '12-3' }) })
    const content = JSON.stringify({ events: { type: 'stream', value: [{ _id: '12-3', field: 'value' }, { _id: '13-0', field: 'later' }], ttl: -1 } })
    await expect(deserializeRedis(makeDriver(client, []), content, controller.signal, true)).rejects.toThrow()
    expect(client.xadd).toHaveBeenCalledExactlyOnceWith(expect.any(String), '12-3', 'field', 'value')
    expect(client.rename).not.toHaveBeenCalled()
    expect(client.del).toHaveBeenCalledWith(client.xadd.mock.calls[0][0])
  })
})
