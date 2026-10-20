import { describe, it, expect } from 'vitest'
import { compressBackup } from '@main/services/backup/compress'
import { mkdtemp, writeFile, readFile, mkdir, rm, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import extract from 'extract-zip'

const fixture = async (body: (directory: string) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'zequel-zip-'))
  try { await body(directory) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

describe('backup compression owns and closes streams', () => {
  it('round trips a file without consuming or renaming its source', async () => {
    await fixture(async directory => {
      const source = join(directory, 'backup.sql')
      const output = join(directory, 'backup.zip')
      const content = randomBytes(128 * 1024)
      await writeFile(source, content)
      let processed = 0
      await compressBackup(source, output, undefined, bytes => { processed = bytes })
      expect(processed).toBe(content.length)
      await extract(output, { dir: join(directory, 'extracted') })
      expect((await readFile(join(directory, 'extracted/backup.sql'))).equals(content)).toBe(true)
      expect((await readFile(source)).equals(content)).toBe(true)
    })
  })

  it('preserves nested and empty directories with platform-independent ZIP paths', async () => {
    await fixture(async directory => {
      const source = join(directory, 'dump')
      await mkdir(join(source, 'nested/empty'), { recursive: true })
      await writeFile(join(source, 'nested/á.sql'), 'SELECT 1;')
      const output = join(directory, 'dump.zip')
      await compressBackup(source, output)
      await extract(output, { dir: join(directory, 'restored') })
      expect(await readFile(join(directory, 'restored/nested/á.sql'), 'utf8')).toBe('SELECT 1;')
      expect(await readdir(join(directory, 'restored/nested/empty'))).toEqual([])
    })
  })

  it.each([false, true])('closes active file handles before cancellation resolves (directory=%s)', async isDirectory => {
    await fixture(async directory => {
      const controller = new AbortController()
      const source = join(directory, isDirectory ? 'dump' : 'large.sql')
      if (isDirectory) await mkdir(source)
      const file = isDirectory ? join(source, 'large.sql') : source
      const content = randomBytes(2 * 1024 * 1024)
      await writeFile(file, content)
      const output = join(directory, 'cancelled.zip')
      await expect(compressBackup(source, output, controller.signal, () => controller.abort(new Error('test cancellation')))).rejects.toThrow()
      expect((await readFile(file)).equals(content)).toBe(true)
      // Windows refuses these removals if either input/output still owns a handle.
      await rm(source, { recursive: true })
      await rm(output)
      expect(await readdir(directory)).toEqual([])
    })
  })

  it('never overwrites an existing destination', async () => {
    await fixture(async directory => {
      const source = join(directory, 'source.sql')
      const output = join(directory, 'existing.zip')
      await writeFile(source, 'SELECT 1;')
      await writeFile(output, 'previous backup')
      await expect(compressBackup(source, output)).rejects.toThrow()
      expect(await readFile(output, 'utf8')).toBe('previous backup')
    })
  })

  it('rejects before opening files when already cancelled', async () => {
    await fixture(async directory => {
      const controller = new AbortController()
      controller.abort(new Error('already stopped'))
      await expect(compressBackup(join(directory, 'missing.sql'), join(directory, 'output.zip'), controller.signal)).rejects.toThrow('already stopped')
      expect(await readdir(directory)).toEqual([])
    })
  })
})
