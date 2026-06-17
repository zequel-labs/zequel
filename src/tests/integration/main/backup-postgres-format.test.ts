/**
 * Real round-trip of the PostgreSQL backup clients against the container, covering BOTH
 * formats: plain (psql) and custom -Fc (pg_restore, detected by the PGDMP magic header).
 * Verifies emoji / multibyte survive. Skips gracefully if pg_dump/psql or the container
 * aren't available.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'child_process'
import { createReadStream, existsSync } from 'fs'
import { unlink, rm } from 'fs/promises'
import { PostgresBackupClient } from '@main/services/backup/backup-clients/postgresql'
import { PostgresRestoreClient } from '@main/services/backup/restore-clients/postgresql'
import { DatabaseType, BackupEntityType, type SavedConnection, type BackupConfig, type RestoreConfig } from '@main/types'

const PG_BIN = '/Users/Shared/Herd/services/postgresql/18/bin'
const PG_DUMP = `${PG_BIN}/pg_dump`
const PSQL = `${PG_BIN}/psql`
const HOST = '127.0.0.1'
const PORT = 54320
const ENV = { ...process.env, PGPASSWORD: 'zequel' } as Record<string, string>

const conn = {
  id: 'pg', name: 'pg', type: DatabaseType.PostgreSQL,
  host: HOST, port: PORT, database: 'zequel', username: 'zequel',
  filepath: null, ssl: false, sslConfig: null, ssh: null, color: null,
  environment: null, folder: null, sortOrder: 0, createdAt: '', updatedAt: '', lastConnectedAt: null,
} as SavedConnection

const run = (binary: string, args: string[], stdinFile?: string): Promise<number> =>
  new Promise((resolve) => {
    const proc = spawn(binary, args, { env: ENV })
    if (stdinFile) createReadStream(stdinFile).pipe(proc.stdin)
    proc.on('close', (code) => resolve(code ?? 1))
    proc.on('error', () => resolve(1))
  })

const psqlExec = (sql: string): Promise<number> =>
  run(PSQL, ['-h', HOST, '-p', String(PORT), '-U', 'zequel', '-d', 'zequel', '-c', sql])

const psqlQuery = (sql: string): Promise<string> =>
  new Promise((resolve) => {
    const proc = spawn(PSQL, ['-h', HOST, '-p', String(PORT), '-U', 'zequel', '-d', 'zequel', '-t', '-A', '-c', sql], { env: ENV })
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', () => resolve(out.trim()))
    proc.on('error', () => resolve(''))
  })

const available = existsSync(PG_DUMP) && existsSync(PSQL)

describe('PostgreSQL backup round-trip (plain + custom format)', () => {
  beforeAll(async () => {
    if (!available) return
    await psqlExec(`DROP TABLE IF EXISTS pg_fmt_test; CREATE TABLE pg_fmt_test (id int, txt text); INSERT INTO pg_fmt_test VALUES (1, '🎉 café 日本語');`)
  })

  afterAll(async () => {
    if (!available) return
    await psqlExec('DROP TABLE IF EXISTS pg_fmt_test;')
  })

  it('custom -Fc dump restores via pg_restore with emoji intact', async () => {
    if (!available) { console.warn('Skipping — pg_dump/psql or container unavailable'); return }
    const outputPath = '/tmp/pg_fmt_test.dump'
    await unlink(outputPath).catch(() => {})

    // Build + run the backup (custom format).
    const backupConfig = {
      connectionId: 'pg',
      entities: [{ name: 'pg_fmt_test', schema: 'public', type: BackupEntityType.Table }],
      outputPath, binaryPath: PG_DUMP, compress: false, customArgs: '',
      options: { format: 'custom' },
    } as BackupConfig
    const bspec = await new PostgresBackupClient().buildBackupSpec({ config: backupConfig, conn, password: 'zequel', host: HOST, port: PORT })
    expect(bspec.args).toContain('--format=custom')
    expect(await run(bspec.binary, bspec.args)).toBe(0)
    expect(existsSync(outputPath)).toBe(true)

    // Drop, then build + run the restore — the client must pick pg_restore from the PGDMP magic.
    await psqlExec('DROP TABLE pg_fmt_test;')
    const restoreConfig = {
      connectionId: 'pg', inputPath: outputPath, binaryPath: PSQL, isDirectory: false, customArgs: '', options: {},
    } as RestoreConfig
    const rspec = await new PostgresRestoreClient().buildRestoreSpec({ config: restoreConfig, conn, password: 'zequel', host: HOST, port: PORT })
    expect(rspec.binary.endsWith('pg_restore')).toBe(true)
    expect(rspec.args).not.toContain('-f') // reads from stdin
    expect(await run(rspec.binary, rspec.args, outputPath)).toBe(0)

    expect(await psqlQuery('SELECT txt FROM pg_fmt_test')).toBe('🎉 café 日本語')
    await unlink(outputPath).catch(() => {})
  })

  it('directory -Fd dump with parallel jobs restores via pg_restore with emoji intact', async () => {
    if (!available) { console.warn('Skipping — pg_dump/psql or container unavailable'); return }
    const outputDir = '/tmp/pg_fmt_test_dir'
    await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    // Re-seed (previous test dropped/recreated the table on restore).
    await psqlExec(`DROP TABLE IF EXISTS pg_fmt_test; CREATE TABLE pg_fmt_test (id int, txt text); INSERT INTO pg_fmt_test VALUES (1, '🎉 café 日本語');`)

    const backupConfig = {
      connectionId: 'pg',
      entities: [{ name: 'pg_fmt_test', schema: 'public', type: BackupEntityType.Table }],
      outputPath: outputDir, binaryPath: PG_DUMP, compress: false, customArgs: '',
      options: { format: 'directory', jobs: 2 },
    } as BackupConfig
    const bspec = await new PostgresBackupClient().buildBackupSpec({ config: backupConfig, conn, password: 'zequel', host: HOST, port: PORT })
    expect(bspec.args).toContain('--format=directory')
    expect(bspec.args).toContain('--jobs')
    expect(await run(bspec.binary, bspec.args)).toBe(0)
    expect(existsSync(`${outputDir}/toc.dat`)).toBe(true)

    await psqlExec('DROP TABLE pg_fmt_test;')
    const restoreConfig = {
      connectionId: 'pg', inputPath: outputDir, binaryPath: PSQL, isDirectory: true, customArgs: '', options: { jobs: 2 },
    } as RestoreConfig
    const rspec = await new PostgresRestoreClient().buildRestoreSpec({ config: restoreConfig, conn, password: 'zequel', host: HOST, port: PORT })
    expect(rspec.binary.endsWith('pg_restore')).toBe(true)
    expect(rspec.inputAsArg).toBe(true)
    expect(rspec.args).toContain('--jobs')
    expect(await run(rspec.binary, rspec.args)).toBe(0)

    expect(await psqlQuery('SELECT txt FROM pg_fmt_test')).toBe('🎉 café 日本語')
    await rm(outputDir, { recursive: true, force: true }).catch(() => {})
  })
})
