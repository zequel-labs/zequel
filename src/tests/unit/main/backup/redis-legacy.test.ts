import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import type { RedisDriver } from '@main/db/redis'
import { restoreLegacyRedisArchive } from '@main/services/backup/native/redis-legacy'

vi.mock('@main/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }))

const withFile = async (content: string, run: (path: string) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'redis-legacy-'))
  try {
    const path = join(directory, 'backup.json')
    await writeFile(path, content)
    await run(path)
  } finally { await rm(directory, { recursive: true, force: true }) }
}

const client = () => ({ set: vi.fn(async () => 'OK'), del: vi.fn(async () => 1), renamenx: vi.fn(async () => 1) })
const driver = (value: ReturnType<typeof client>): RedisDriver => ({ getClient: () => value }) as unknown as RedisDriver

describe('streaming legacy Redis files', () => {
  it.each([false, true])('restores plain/wrapped data with metadata after the payload: wrapped=%s', async wrapped => {
    const data = { hello: { type: 'string', value: 'Olá', ttl: -1 }, data: { type: 'string', value: 'literal key', ttl: -1 } }
    const content = JSON.stringify(wrapped ? { data, _meta: { type: 'redis', version: 1 } } : data)
    const fake = client()
    const progress = vi.fn()
    await withFile(content, async path => {
      expect(await restoreLegacyRedisArchive(driver(fake), path, false, undefined, progress)).toEqual({ successCount: 2, errors: [] })
    })
    expect(fake.set).toHaveBeenCalledTimes(2)
    expect(progress.mock.calls).toEqual([[1], [2]])
  })

  it.each([
    '{"first":{"type":"string","value":"valid","ttl":-1},"last":',
    '{"_meta":{"type":"redis","version":2},"data":{}}',
    '{"first":{"type":"string","value":"valid","ttl":-1},"last":{"type":"unknown","value":null,"ttl":-1}}',
    '{"same":{"type":"string","value":"a","ttl":-1},"same":{"type":"string","value":"b","ttl":-1}}',
    '[]',
  ])('validates the whole file before publishing any key: %s', async content => {
    const fake = client()
    await withFile(content, async path => {
      await expect(restoreLegacyRedisArchive(driver(fake), path, false)).rejects.toThrow()
    })
    expect(fake.set).not.toHaveBeenCalled()
  })
})
