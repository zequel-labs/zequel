import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { postgresSqlSourceMajor, validatePostgresBackupVersion, validatePostgresRestoreVersion } from '@main/services/backup/compatibility'

let directory: string | undefined
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })

describe('PostgreSQL transfer compatibility', () => {
  it('rejects an old dump tool before creating an output artifact', () => {
    expect(() => validatePostgresBackupVersion(17, 18)).toThrow('pg_dump 18 or newer')
    expect(() => validatePostgresBackupVersion(18, 17)).not.toThrow()
    expect(() => validatePostgresBackupVersion(18, 9.1)).toThrow('9.2 or newer')
  })
  it('rejects a source server newer than the restore destination', () => {
    expect(() => validatePostgresRestoreVersion(18, 17)).toThrow('destination')
    expect(() => validatePostgresRestoreVersion(17, 18)).not.toThrow()
  })
  it('reads source versions from bounded SQL headers without interpreting arbitrary SQL as metadata', async () => {
    directory = await mkdtemp(join(tmpdir(), 'zequel-version-test-'))
    const path = join(directory, 'dump.sql')
    await writeFile(path, '-- PostgreSQL database dump\n-- Dumped from database version 18.6\nSELECT 1;\n')
    expect(await postgresSqlSourceMajor(path)).toBe(18)
    await writeFile(path, '-- Dumped from database version 9.6.24\n')
    expect(await postgresSqlSourceMajor(path)).toBe(9.6)
    await writeFile(path, "SELECT '-- Dumped from database version 999';\n")
    expect(await postgresSqlSourceMajor(path)).toBeUndefined()
  })
})
