import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ClickHouseDriver } from '@main/db/clickhouse'
import { restoreClickHouseArchive } from '@main/services/backup/native/clickhouse-serializer'

describe('ClickHouse restore cancellation', () => {
  it('interrupts an active statement and never starts the next one', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zequel-clickhouse-cancel-'))
    const path = join(directory, 'backup.sql')
    const controller = new AbortController()
    let finish: (value: { error: string }) => void = () => {}
    const execute = vi.fn(() => new Promise<{ error: string }>(resolve => {
      finish = resolve
      queueMicrotask(() => controller.abort())
    }))
    const cancelQuery = vi.fn(async () => {
      finish({ error: 'Aborted' })
      return true
    })
    try {
      await writeFile(path, 'SELECT sleep(30); SELECT 2;')
      const driver = { execute, cancelQuery } as unknown as ClickHouseDriver
      await expect(restoreClickHouseArchive(driver, path, controller.signal)).rejects.toThrow()
      expect(cancelQuery).toHaveBeenCalledOnce()
      expect(execute).toHaveBeenCalledTimes(1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
