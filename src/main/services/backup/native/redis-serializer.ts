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
export const serializeRedis = async (driver: RedisDriver): Promise<string> => {
  const client = driver.getClient()
  const keys = await driver.getAllKeys()

  logger.info(`Redis backup: found ${keys.length} keys to export`)

  const backup: Record<string, RedisBackupEntry> = {}
  let exportedCount = 0
  let errorCount = 0

  for (const key of keys) {
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

/**
 * Restore a Redis database from a JSON document produced by {@link serializeRedis}.
 * Accepts both the wrapped (`{ _meta, data }`) and plain formats.
 */
export const deserializeRedis = async (
  driver: RedisDriver,
  content: string
): Promise<{ successCount: number; errors: string[] }> => {
  const parsed = JSON.parse(content)

  // Support both wrapped format (with _meta) and plain format
  const backup: Record<string, RedisBackupEntry> =
    parsed._meta && parsed.data ? parsed.data : parsed

  const client = driver.getClient()
  const keys = Object.keys(backup)
  let successCount = 0
  const errors: string[] = []

  logger.info(`Redis import: restoring ${keys.length} keys`)

  for (const key of keys) {
    try {
      const entry = backup[key]
      const { type, value, ttl } = entry

      switch (type) {
        case 'string': {
          if (value !== null && value !== undefined) {
            await client.set(key, String(value))
          }
          break
        }

        case 'list': {
          if (Array.isArray(value) && value.length > 0) {
            // Delete existing key first to avoid appending to existing data
            await client.del(key)
            // RPUSH to maintain order
            await client.rpush(key, ...value.map(String))
          }
          break
        }

        case 'set': {
          if (Array.isArray(value) && value.length > 0) {
            await client.del(key)
            await client.sadd(key, ...value.map(String))
          }
          break
        }

        case 'hash': {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            await client.del(key)
            const hashEntries = Object.entries(value as Record<string, unknown>)
            if (hashEntries.length > 0) {
              const flatArgs: string[] = []
              for (const [field, val] of hashEntries) {
                flatArgs.push(field, String(val))
              }
              await client.hset(key, ...flatArgs)
            }
          }
          break
        }

        case 'zset': {
          if (Array.isArray(value) && value.length > 0) {
            await client.del(key)
            // Each entry is { member, score }
            const zaddArgs: (string | number)[] = []
            for (const item of value) {
              const entry = item as { member: string; score: string | number }
              zaddArgs.push(Number(entry.score), String(entry.member))
            }
            // ioredis types zadd with strict overloads; call through a variadic signature.
            await (client.zadd as (k: string, ...args: (string | number)[]) => Promise<unknown>)(key, ...zaddArgs)
          }
          break
        }

        case 'stream': {
          if (Array.isArray(value) && value.length > 0) {
            await client.del(key)
            for (const entry of value) {
              const obj = entry as Record<string, string>
              const fields: string[] = []
              for (const [field, val] of Object.entries(obj)) {
                if (field !== '_id') {
                  fields.push(field, String(val))
                }
              }
              if (fields.length > 0) {
                await client.xadd(key, '*', ...fields)
              }
            }
          }
          break
        }

        default:
          logger.warn(`Redis import: unknown type "${type}" for key "${key}", skipping`)
          continue
      }

      // Restore TTL if it was set (positive value means expiry was set)
      if (ttl > 0) {
        await client.expire(key, ttl)
      }

      successCount++

      if (successCount % 500 === 0) {
        logger.info(`Redis import: restored ${successCount}/${keys.length} keys`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to restore key "${key}": ${errorMsg}`)
      logger.warn(`Redis import: failed to restore key "${key}": ${errorMsg}`)
    }
  }

  logger.info(`Redis import: completed. Restored ${successCount} keys, ${errors.length} errors`)
  return { successCount, errors }
}
