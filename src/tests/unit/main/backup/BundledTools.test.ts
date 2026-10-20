import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const state = vi.hoisted(() => ({ root: '' }))
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => state.root } }))
import { findBundledTool } from '@main/services/backup/BundledTools'

let directory: string
beforeEach(async () => {
  state.root = await mkdtemp(join(tmpdir(), 'zequel-tools-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(state.root)
  directory = join(state.root, 'resources/database-tools', `${process.platform}-${process.arch}`)
  await mkdir(directory, { recursive: true })
})
afterEach(async () => { vi.restoreAllMocks(); await rm(state.root, { recursive: true, force: true }) })
const manifest = async (binary: string, platform = process.platform): Promise<void> => {
  await writeFile(join(directory, 'manifest.json'), JSON.stringify({
    platform, arch: process.arch,
    tools: [{ engine: 'postgresql', version: '18.6', binaries: { pg_dump: binary } }],
  }))
}

describe('bundled tools', () => {
  it('resolves an executable from its platform manifest without querying PATH', async () => {
    await writeFile(join(directory, 'pg_dump'), '')
    await manifest('pg_dump')
    expect(findBundledTool('postgresql', 'pg_dump')).toMatchObject({
      path: join(directory, 'pg_dump'), found: true, version: '18.6',
    })
  })
  it('fails closed for escaped paths and damaged files', async () => {
    await writeFile(join(state.root, 'outside'), '')
    await manifest('../../../outside')
    expect(findBundledTool('postgresql', 'pg_dump')?.found).toBe(false)
    await manifest('missing')
    expect(findBundledTool('postgresql', 'pg_dump')?.found).toBe(false)
  })
  it('distinguishes an absent toolchain from a corrupt manifest', async () => {
    expect(findBundledTool('postgresql', 'pg_dump')).toBeNull()
    await writeFile(join(directory, 'manifest.json'), '{')
    expect(findBundledTool('postgresql', 'pg_dump')?.found).toBe(false)
  })
  it('rejects an incomplete toolchain even when the requested executable exists', async () => {
    await writeFile(join(directory, 'psql'), '')
    await writeFile(join(directory, 'manifest.json'), JSON.stringify({
      platform: process.platform, arch: process.arch,
      tools: [{ engine: 'postgresql', version: '18.6', binaries: { psql: 'psql', pg_restore: 'missing' } }],
    }))
    expect(findBundledTool('postgresql', 'psql')?.found).toBe(false)
  })
})
