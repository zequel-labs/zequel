import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import parser from 'stream-json/parser.js'
import Assembler from 'stream-json/assembler.js'
import pick from 'stream-json/filters/pick.js'
import streamObject from 'stream-json/streamers/stream-object.js'
import type { RedisDriver } from '@main/db/redis'
import { restoreRedisEntry, validateRedisEntry } from '@main/services/backup/native/redis-serializer'

/** Inspect only the wrapper; never assemble the complete legacy database in memory. */
const inspectWrapper = async (path: string, signal?: AbortSignal): Promise<boolean> => {
  const input = createReadStream(path, { signal })
  const tokens = parser.asStream({ streamValues: false })
  const completed = pipeline(input, tokens).catch(() => {})
  let depth = 0
  let rootKey = ''
  let metadata: unknown
  let hasMetadata = false
  let hasData = false
  let assembler: Assembler | undefined
  try {
    for await (const value of tokens) {
      signal?.throwIfAborted()
      const token = value as parser.Token
      if (depth === 0 && token.name !== 'startObject') throw new Error('Invalid legacy Redis backup')
      if (depth === 1 && token.name === 'keyValue') {
        rootKey = token.value
        if (rootKey === 'data') {
          if (hasData) throw new Error('Duplicate Redis data property')
          hasData = true
        }
        if (rootKey === '_meta') {
          if (hasMetadata) throw new Error('Duplicate Redis backup metadata')
          hasMetadata = true
          assembler = new Assembler()
        }
      } else if (assembler && rootKey === '_meta' && depth >= 1) {
        assembler.consume(token)
        if (assembler.done) { metadata = assembler.current; assembler = undefined }
      }
      if (token.name === 'startObject' || token.name === 'startArray') depth++
      if (token.name === 'endObject' || token.name === 'endArray') depth--
    }
    if (!hasMetadata || !hasData) return false
    const meta = metadata as { type?: unknown; version?: unknown } | null
    if (!meta || meta.type !== 'redis' || meta.version !== 1) throw new Error('Unsupported legacy Redis backup version')
    return true
  } finally {
    input.destroy()
    tokens.destroy()
    await completed
  }
}

const entries = async function* (path: string, wrapped: boolean, signal?: AbortSignal): AsyncGenerator<streamObject.StreamObjectItem> {
  const input = createReadStream(path, { signal })
  const tokens = parser.asStream({ streamValues: false })
  const output = streamObject.asStream()
  const completed = (wrapped
    ? pipeline(input, tokens, pick.asStream({ filter: 'data', once: true }), output)
    : pipeline(input, tokens, output)).catch(() => {})
  try {
    for await (const entry of output) {
      signal?.throwIfAborted()
      yield entry as streamObject.StreamObjectItem
    }
  } finally {
    input.destroy()
    tokens.destroy()
    output.destroy()
    await completed
  }
}

/** Legacy files are validated in full, then restored one key at a time with backpressure. */
export const restoreLegacyRedisArchive = async (
  driver: RedisDriver, path: string, replace: boolean, signal?: AbortSignal,
  onProgress?: (count: number) => void,
): Promise<{ successCount: number; errors: string[] }> => {
  const wrapped = await inspectWrapper(path, signal)
  const keys = new Set<string>()
  for await (const { key, value } of entries(path, wrapped, signal)) {
    if (keys.has(key)) throw new Error(`Duplicate Redis key "${key}"`)
    keys.add(key)
    validateRedisEntry(key, value)
  }
  keys.clear()
  let successCount = 0
  for await (const { key, value } of entries(path, wrapped, signal)) {
    try {
      await restoreRedisEntry(driver, key, validateRedisEntry(key, value), replace, signal)
      successCount++
      onProgress?.(successCount)
    } catch (error) {
      signal?.throwIfAborted()
      return { successCount, errors: [`Failed to restore key "${key}": ${error instanceof Error ? error.message : String(error)}`] }
    }
  }
  return { successCount, errors: [] }
}
