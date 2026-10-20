import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { RedisDriver } from '@main/db/redis'
import { inspectRedisArchive, restoreRedisArchive, writeRedisArchive } from '@main/services/backup/native/redis-archive'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})
const archivePath = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'zequel-redis-test-'))
  directories.push(dir)
  return join(dir, 'backup.jsonl')
}

describe('Redis binary archive', () => {
  it('streams every SCAN page, deduplicates keys and round trips binary payloads and TTL', async () => {
    const key = Buffer.from([0, 255, 128])
    const dump = Buffer.from([255, 0, 1, 128])
    const client = {
      scanBuffer: vi.fn().mockResolvedValueOnce([Buffer.from('31'), [key]]).mockResolvedValueOnce([Buffer.from('0'), [key, Buffer.from('second')]]),
      callBuffer: vi.fn().mockResolvedValueOnce([dump, 1234]).mockResolvedValueOnce([dump, -1]),
      call: vi.fn().mockResolvedValue('OK'),
    }
    const driver = { getClient: () => client } as unknown as RedisDriver
    const path = await archivePath()
    expect(await writeRedisArchive(driver, path)).toBe(2)
    expect(await inspectRedisArchive(path)).toBe(true)
    expect(await restoreRedisArchive(driver, path, false)).toBe(2)
    expect(client.call).toHaveBeenNthCalledWith(1, 'RESTORE', key, 1234, dump)
    expect(client.call).toHaveBeenNthCalledWith(2, 'RESTORE', Buffer.from('second'), 0, dump)
  })
  it('validates the footer before making any destination changes', async () => {
    const client = { scanBuffer: vi.fn().mockResolvedValue([Buffer.from('0'), []]), call: vi.fn() }
    const driver = { getClient: () => client } as unknown as RedisDriver
    const path = await archivePath()
    await writeRedisArchive(driver, path)
    const content = await readFile(path, 'utf8')
    await writeFile(path, content.split('\n')[0] + '\n')
    await expect(restoreRedisArchive(driver, path, true)).rejects.toThrow('incomplete')
    expect(client.call).not.toHaveBeenCalled()
  })
  it('does not swallow capture errors or cancellation', async () => {
    const client = { scanBuffer: vi.fn().mockRejectedValue(new Error('ACL denied')) }
    const driver = { getClient: () => client } as unknown as RedisDriver
    await expect(writeRedisArchive(driver, await archivePath())).rejects.toThrow('ACL denied')
    await expect(writeRedisArchive(driver, await archivePath(), AbortSignal.abort())).rejects.toThrow()
  })
})
