import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const { verifyBundle } = require(resolve('scripts/database-tools/verify-bundle.cjs')) as { verifyBundle: (platform: string, arch: string, project: string) => Promise<void> }
const directories: string[] = []
const platform = process.platform === 'win32' ? 'win32' : 'linux'
const fixture = async (): Promise<{ project: string; root: string }> => {
  const project = await mkdtemp(join(tmpdir(), 'zequel-tools-test-'))
  directories.push(project)
  const root = join(project, `resources/database-tools/${platform}-x64`)
  const required: Record<string, string[]> = { postgresql: ['pg_dump', 'pg_restore', 'psql'], mysql: ['mysql', 'mysqldump'], mariadb: ['mariadb', 'mariadb-dump'], mongodb: ['mongodump', 'mongorestore'], duckdb: ['duckdb'], sqlite: ['sqlite3'], sqlserver: ['sqlcmd'] }
  const tools: { engine: string; version: string; binaries: Record<string, string>; files: Record<string, string> }[] = []
  for (const [engine, binaries] of Object.entries(required)) {
    const files: Record<string, string> = {}
    const paths: Record<string, string> = {}
    for (const binary of [...binaries, 'licenses/LICENSE']) {
      const relative = `${engine}/1.0/${binary}`
      const file = join(root, relative)
      await mkdir(join(file, '..'), { recursive: true })
      await writeFile(file, 'fixture', { mode: 0o755 })
      files[relative] = createHash('sha256').update('fixture').digest('hex')
      if (!binary.includes('/')) paths[binary] = relative
    }
    tools.push({ engine, version: '1.0', binaries: paths, files })
  }
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ platform, arch: 'x64', tools }))
  return { project, root }
}
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

describe('installer toolchain gate', () => {
  it('accepts a complete bundle with verified contents', async () => {
    const { project } = await fixture()
    await expect(verifyBundle(platform, 'x64', project)).resolves.toBeUndefined()
  })
  it('rejects a modified executable before packaging', async () => {
    const { project, root } = await fixture()
    await writeFile(join(root, 'postgresql/1.0/pg_dump'), 'modified')
    await expect(verifyBundle(platform, 'x64', project)).rejects.toThrow('checksum mismatch')
  })
  it('rejects a missing engine rather than producing an incomplete installer', async () => {
    const { project, root } = await fixture()
    await rm(join(root, 'mongodb'), { recursive: true })
    await expect(verifyBundle(platform, 'x64', project)).rejects.toThrow()
  })
})
