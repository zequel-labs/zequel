import { randomUUID } from 'node:crypto'
import type { RedisDriver } from '@main/db/redis'
import { logger } from '@main/utils/logger'

export interface RedisBackupEntry {
  type: string
  value: unknown
  ttl: number
}

/**
 * Serialize an entire Redis database to a restorable JSON document, preserving every key
 * type (string/list/set/hash/zset/stream) and TTL. Works over any connection — including
 * SSH tunnels — because it uses the live driver client, not `redis-cli --rdb` (whose RDB
 * output cannot be restored remotely).
 */
export const serializeRedis = async (driver: RedisDriver, signal?: AbortSignal): Promise<string> => {
  const client = driver.getClient()
  const keys = await driver.getAllKeys()

  logger.info(`Redis backup: found ${keys.length} keys to export`)

  const backup: Record<string, RedisBackupEntry> = {}
  let exportedCount = 0
  let errorCount = 0

  for (const key of keys) {
    signal?.throwIfAborted()
    try {
      const keyType = await client.type(key)
      const ttl = await client.ttl(key)

      let value: unknown

      switch (keyType) {
        case 'string':
          value = await client.get(key)
          break

        case 'list':
          value = await client.lrange(key, 0, -1)
          break

        case 'set':
          value = await client.smembers(key)
          break

        case 'hash':
          value = await client.hgetall(key)
          break

        case 'zset': {
          // Retrieve members with scores as alternating array [member, score, ...]
          const raw = await client.zrange(key, 0, -1, 'WITHSCORES')
          const pairs: { member: string; score: string }[] = []
          for (let i = 0; i < raw.length; i += 2) {
            pairs.push({ member: raw[i], score: raw[i + 1] })
          }
          value = pairs
          break
        }

        case 'stream': {
          try {
            const entries = await client.xrange(key, '-', '+', 'COUNT', 10000)
            value = entries.map(([id, fields]) => {
              const obj: Record<string, string> = { _id: id }
              for (let i = 0; i < fields.length; i += 2) {
                obj[fields[i]] = fields[i + 1]
              }
              return obj
            })
          } catch {
            value = null
            logger.warn(`Redis backup: could not read stream key "${key}", skipping value`)
          }
          break
        }

        default:
          // Unknown type; store null
          value = null
          logger.warn(`Redis backup: unknown type "${keyType}" for key "${key}", skipping value`)
      }

      backup[key] = { type: keyType, value, ttl }
      exportedCount++

      if (exportedCount % 500 === 0) {
        logger.info(`Redis backup: exported ${exportedCount}/${keys.length} keys`)
      }
    } catch (err) {
      errorCount++
      logger.warn(`Redis backup: failed to export key "${key}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  logger.info(`Redis backup: completed. Exported ${exportedCount} keys, ${errorCount} errors`)

  const backupWrapper = {
    _meta: {
      type: 'redis',
      version: 1,
      exportedAt: new Date().toISOString(),
      keyCount: exportedCount
    },
    data: backup
  }

  return JSON.stringify(backupWrapper, null, 2)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const validateRedisEntry = (key: string, value: unknown): RedisBackupEntry => {
  const invalid = (): never => { throw new Error(`Invalid legacy Redis entry for key "${key}"`) }
  if (!isRecord(value) || !Number.isSafeInteger(value.ttl) || Number(value.ttl) < -1) return invalid()
  const entry = value as unknown as RedisBackupEntry
  const data = entry.value
  switch (entry.type) {
    case 'string':
      if (typeof data !== 'string') return invalid()
      break
    case 'list':
    case 'set':
      if (!Array.isArray(data) || !data.length || !data.every(item => typeof item === 'string')) return invalid()
      break
    case 'hash':
      if (!isRecord(data) || !Object.keys(data).length || !Object.values(data).every(item => typeof item === 'string')) return invalid()
      break
    case 'zset':
      if (!Array.isArray(data) || !data.length || !data.every(item => isRecord(item) && typeof item.member === 'string' &&
        (typeof item.score === 'number' || typeof item.score === 'string') && String(item.score).trim() !== '' &&
        (Number.isFinite(Number(item.score)) || ['inf', '+inf', '-inf'].includes(String(item.score))))) return invalid()
      break
    case 'stream': {
      if (!Array.isArray(data) || !data.length) return invalid()
      let previous = [0n, 0n]
      for (const item of data) {
        if (!isRecord(item) || typeof item._id !== 'string' || !/^\d+-\d+$/.test(item._id) ||
          Object.keys(item).length < 2 || !Object.values(item).every(field => typeof field === 'string')) return invalid()
        const id = item._id.split('-').map(BigInt)
        if (id.some(part => part > 18446744073709551615n) || id[0] < previous[0] || (id[0] === previous[0] && id[1] <= previous[1])) return invalid()
        previous = id
      }
      break
    }
    default: return invalid()
  }
  return entry
}

/** Build each key privately, then publish atomically so failure never destroys its destination. */
export const restoreRedisEntry = async (
  driver: RedisDriver, key: string, entry: RedisBackupEntry, replace: boolean, signal?: AbortSignal,
): Promise<void> => {
  const client = driver.getClient()
  const temporary = `__zequel_restore_${randomUUID()}`
  signal?.throwIfAborted()
  try {
    const value = entry.value
    switch (entry.type) {
      case 'string':
        await client.set(temporary, value as string)
        break
      case 'list':
      case 'set': {
        const values = value as string[]
        for (let offset = 0; offset < values.length; offset += 500) {
          signal?.throwIfAborted()
          const batch = values.slice(offset, offset + 500)
          if (entry.type === 'list') await client.rpush(temporary, ...batch)
          else await client.sadd(temporary, ...batch)
        }
        break
      }
      case 'hash': {
        const fields = Object.entries(value as Record<string, string>)
        for (let offset = 0; offset < fields.length; offset += 500) {
          signal?.throwIfAborted()
          await client.hset(temporary, ...fields.slice(offset, offset + 500).flat())
        }
        break
      }
      case 'zset': {
        const members = value as { member: string; score: string | number }[]
        for (let offset = 0; offset < members.length; offset += 500) {
          signal?.throwIfAborted()
          await client.zadd(temporary, ...members.slice(offset, offset + 500).flatMap(item => [item.score, item.member]))
        }
        break
      }
      case 'stream':
        for (const item of value as Record<string, string>[]) {
          signal?.throwIfAborted()
          await client.xadd(temporary, item._id, ...Object.entries(item).filter(([field]) => field !== '_id').flat())
        }
        break
    }
    if (entry.ttl >= 0) await client.expire(temporary, Math.max(1, entry.ttl))
    signal?.throwIfAborted()
    if (replace) await client.rename(temporary, key)
    else if (!await client.renamenx(temporary, key)) throw new Error('Destination key already exists; enable replacement to overwrite it')
  } finally {
    await client.del(temporary)
  }
}

/** Compatibility helper for in-memory legacy callers. Validate everything before any write. */
export const deserializeRedis = async (
  driver: RedisDriver, content: string, signal?: AbortSignal, replace = false,
  onProgress?: (count: number) => void,
): Promise<{ successCount: number; errors: string[] }> => {
  const parsed: unknown = JSON.parse(content)
  if (!isRecord(parsed)) throw new Error('Invalid legacy Redis backup')
  let backup = parsed
  if ('_meta' in parsed && 'data' in parsed) {
    if (!isRecord(parsed._meta) || parsed._meta.type !== 'redis' || parsed._meta.version !== 1 || !isRecord(parsed.data)) {
      throw new Error('Unsupported legacy Redis backup version')
    }
    backup = parsed.data
  }
  const entries = Object.entries(backup).map(([key, entry]) => [key, validateRedisEntry(key, entry)] as const)
  let successCount = 0
  const errors: string[] = []
  for (const [key, entry] of entries) {
    signal?.throwIfAborted()
    try {
      await restoreRedisEntry(driver, key, entry, replace, signal)
      successCount++
      onProgress?.(successCount)
    } catch (error) {
      signal?.throwIfAborted()
      errors.push(`Failed to restore key "${key}": ${error instanceof Error ? error.message : String(error)}`)
      break
    }
  }
  return { successCount, errors }
}
