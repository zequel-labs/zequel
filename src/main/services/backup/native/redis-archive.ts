import { createReadStream, createWriteStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'
import type { RedisDriver } from '@main/db/redis'

const HEADER = JSON.stringify({ format: 'zequel-redis', version: 2 })
// DUMP and expiration are captured atomically, including binary values and stream IDs.
const CAPTURE = `
local value = redis.call('DUMP', KEYS[1])
if not value then return false end
local ttl = redis.call('PTTL', KEYS[1])
return {value, ttl}
`

interface Entry {
  key: string
  dump: string
  ttl: number
}

const decodeEntry = (line: string): Entry => {
  const entry: unknown = JSON.parse(line)
  if (!entry || typeof entry !== 'object') throw new Error('Invalid Redis archive entry')
  const { key, dump, ttl } = entry as Partial<Entry>
  if (typeof key !== 'string' || typeof dump !== 'string' || typeof ttl !== 'number' ||
    !Number.isSafeInteger(ttl) || ttl < -1 || !dump ||
    Buffer.from(key, 'base64').toString('base64') !== key ||
    Buffer.from(dump, 'base64').toString('base64') !== dump) {
    throw new Error('Invalid Redis archive payload')
  }
  return { key, dump, ttl }
}

export const writeRedisArchive = async (
  driver: RedisDriver, path: string, signal?: AbortSignal, onProgress?: (count: number) => void,
): Promise<number> => {
  const client = driver.getClient()
  let count = 0
  const records = async function* (): AsyncGenerator<string> {
    const hash = createHash('sha256')
    const seen = new Set<string>()
    yield HEADER + '\n'
    let cursor = '0'
    do {
      signal?.throwIfAborted()
      const [next, keys] = await client.scanBuffer(cursor, 'COUNT', 500)
      cursor = next.toString()
      const unique = keys.filter(key => {
        const encoded = key.toString('base64')
        if (seen.has(encoded)) return false
        seen.add(encoded)
        return true
      })
      // A bounded number of requests in flight avoids one network round trip per key.
      for (let offset = 0; offset < unique.length; offset += 16) {
        signal?.throwIfAborted()
        const batch = unique.slice(offset, offset + 16)
        const results = await Promise.allSettled(batch.map(key => client.callBuffer('EVAL', CAPTURE, 1, key)))
        const failed = results.find(result => result.status === 'rejected')
        if (failed?.status === 'rejected') throw failed.reason
        signal?.throwIfAborted()
        for (let index = 0; index < batch.length; index++) {
          const result = results[index]
          const captured = (result.status === 'fulfilled' ? result.value : null) as [Buffer, number] | null
          if (!captured) continue // Key expired between SCAN and capture.
          const [dump, ttl] = captured
          const line = JSON.stringify({ key: batch[index].toString('base64'), dump: dump.toString('base64'), ttl }) + '\n'
          hash.update(line)
          yield line
          count++
          onProgress?.(count)
        }
      }
    } while (cursor !== '0')
    yield JSON.stringify({ end: true, count, sha256: hash.digest('hex') }) + '\n'
  }
  await pipeline(Readable.from(records()), createWriteStream(path, { flags: 'wx', mode: 0o600 }), { signal })
  return count
}

/** Validate the complete archive before the first destination write. */
export const inspectRedisArchive = async (path: string, signal?: AbortSignal): Promise<boolean> => {
  const input = createReadStream(path, { signal })
  const lines = createInterface({ input, crlfDelay: Infinity })
  let header = false
  let ended = false
  let count = 0
  const hash = createHash('sha256')
  try {
    for await (const line of lines) {
      signal?.throwIfAborted()
      if (!header) {
        if (line !== HEADER) return false // Legacy JSON is handled by its own reader.
        header = true
        continue
      }
      if (ended) throw new Error('Unexpected data after Redis archive footer')
      const value = JSON.parse(line) as { end?: boolean; count?: number; sha256?: string }
      if (value.end === true) {
        if (value.count !== count || value.sha256 !== hash.digest('hex')) throw new Error('Redis archive checksum mismatch')
        ended = true
      } else {
        decodeEntry(line)
        hash.update(line + '\n')
        count++
      }
    }
    if (!header || !ended) throw new Error('Redis archive is incomplete')
    return true
  } finally {
    lines.close()
    input.destroy()
  }
}

export const restoreRedisArchive = async (
  driver: RedisDriver, path: string, replace: boolean, signal?: AbortSignal,
  onProgress?: (count: number) => void,
): Promise<number> => {
  if (!await inspectRedisArchive(path, signal)) throw new Error('Unsupported Redis archive format')
  const input = createReadStream(path, { signal })
  const lines = createInterface({ input, crlfDelay: Infinity })
  let count = 0
  let first = true
  let batch: Entry[] = []
  let bytes = 0
  const flush = async (): Promise<void> => {
    if (!batch.length) return
    signal?.throwIfAborted()
    const results = await Promise.allSettled(batch.map(entry => {
      const args: (string | number | Buffer)[] = [Buffer.from(entry.key, 'base64'), entry.ttl === -1 ? 0 : Math.max(1, entry.ttl), Buffer.from(entry.dump, 'base64')]
      if (replace) args.push('REPLACE')
      return driver.getClient().call('RESTORE', ...args)
    }))
    count += results.filter(result => result.status === 'fulfilled').length
    onProgress?.(count)
    batch = []
    bytes = 0
    signal?.throwIfAborted()
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') {
      throw new Error(`Restored ${count} keys; the destination may be partially restored. ${failed.reason instanceof Error ? failed.reason.message : String(failed.reason)}`)
    }
  }
  try {
    for await (const line of lines) {
      signal?.throwIfAborted()
      if (first) { first = false; continue }
      if ((JSON.parse(line) as { end?: boolean }).end) break
      const entry = decodeEntry(line)
      if (bytes + line.length > 1024 * 1024) await flush()
      batch.push(entry)
      bytes += line.length
      if (batch.length >= 16) await flush()
    }
    await flush()
    return count
  } finally {
    lines.close()
    input.destroy()
  }
}
