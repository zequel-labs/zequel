/**
 * Real round-trip of the MongoDB backup clients against the container, covering the
 * multi-collection fix: selecting 2 of 3 collections must back up exactly those 2 (one
 * mongodump per collection via extraCommands), never silently widening to the whole DB.
 * Verifies emoji survives. Skips gracefully if mongodump/mongorestore or the container
 * aren't available.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import { MongoBackupClient } from '@main/services/backup/backup-clients/mongodb'
import { MongoRestoreClient } from '@main/services/backup/restore-clients/mongodb'
import { DatabaseType, BackupEntityType, type SavedConnection, type BackupConfig, type RestoreConfig } from '@main/types'

const MONGODUMP = '/opt/homebrew/bin/mongodump'
const MONGORESTORE = '/opt/homebrew/bin/mongorestore'
const MONGOIMPORT = '/opt/homebrew/bin/mongoimport'
const HOST = '127.0.0.1'
const PORT = 27018
const DB = 'bktest'
const OUT = '/tmp/zequel_mongo_rt'
const AUTH = ['--host', HOST, '--port', String(PORT), '--username', 'zequel', '--password', 'zequel', '--authenticationDatabase', 'admin']

const conn = {
  id: 'mongo', name: 'mongo', type: DatabaseType.MongoDB,
  host: HOST, port: PORT, database: DB, username: 'zequel',
  filepath: null, ssl: false, sslConfig: null, ssh: null, color: null,
  environment: null, folder: null, sortOrder: 0, createdAt: '', updatedAt: '', lastConnectedAt: null,
} as SavedConnection

const run = (binary: string, args: string[]): Promise<number> =>
  new Promise((resolve) => {
    const proc = spawn(binary, args)
    proc.on('close', (code) => resolve(code ?? 1))
    proc.on('error', () => resolve(1))
  })

const seed = (collection: string, doc: string): Promise<number> =>
  new Promise((resolve) => {
    const proc = spawn(MONGOIMPORT, [...AUTH, '--db', DB, '--collection', collection, '--drop'])
    proc.stdin.write(doc + '\n')
    proc.stdin.end()
    proc.on('close', (code) => resolve(code ?? 1))
    proc.on('error', () => resolve(1))
  })

const countDocs = (collection: string): Promise<string> =>
  new Promise((resolve) => {
    // Use mongoexport to read back (no mongosh available).
    const proc = spawn(MONGOIMPORT.replace('mongoimport', 'mongoexport'), [...AUTH, '--db', DB, '--collection', collection])
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', () => resolve(out.trim()))
    proc.on('error', () => resolve(''))
  })

const available = existsSync(MONGODUMP) && existsSync(MONGORESTORE) && existsSync(MONGOIMPORT)

describe('MongoDB multi-collection backup round-trip', () => {
  beforeAll(async () => {
    if (!available) return
    await seed('coll_a', '{"id":1,"txt":"🎉 café 日本語"}')
    await seed('coll_b', '{"id":2,"txt":"hello"}')
    await seed('coll_c', '{"id":3,"txt":"must NOT be backed up"}')
    await rm(OUT, { recursive: true, force: true })
  })

  afterAll(async () => {
    await rm(OUT, { recursive: true, force: true }).catch(() => {})
  })

  it('backs up exactly the selected collections and restores emoji intact', async () => {
    if (!available) { console.warn('Skipping — mongodump/restore or container unavailable'); return }

    const backupConfig = {
      connectionId: 'mongo',
      entities: [
        { name: 'coll_a', type: BackupEntityType.Collection },
        { name: 'coll_b', type: BackupEntityType.Collection },
      ],
      outputPath: OUT, binaryPath: MONGODUMP, compress: false, customArgs: '', options: {},
    } as BackupConfig

    const spec = await new MongoBackupClient().buildBackupSpec({ config: backupConfig, conn, password: 'zequel', host: HOST, port: PORT })
    expect(spec.args).toContain('--authenticationDatabase')
    expect(spec.extraCommands).toHaveLength(1)

    // Run the main command + chained extras (as runBackup does).
    expect(await run(spec.binary, spec.args)).toBe(0)
    for (const extra of spec.extraCommands ?? []) {
      expect(await run(extra.binary, extra.args)).toBe(0)
    }

    // Only the selected collections were dumped — no silent widening.
    expect(existsSync(`${OUT}/${DB}/coll_a.bson`)).toBe(true)
    expect(existsSync(`${OUT}/${DB}/coll_b.bson`)).toBe(true)
    expect(existsSync(`${OUT}/${DB}/coll_c.bson`)).toBe(false)

    // Restore via the restore client (mongorestore --drop recreates each dumped collection).
    const restoreConfig = {
      connectionId: 'mongo', inputPath: `${OUT}/${DB}`, binaryPath: MONGORESTORE, isDirectory: true, customArgs: '', options: {},
    } as RestoreConfig
    const rspec = await new MongoRestoreClient().buildRestoreSpec({ config: restoreConfig, conn, password: 'zequel', host: HOST, port: PORT })
    expect(rspec.args).toContain('--authenticationDatabase')
    // mongorestore restores into <db> from the dump dir; add --drop for a clean restore.
    expect(await run(rspec.binary, [...rspec.args, '--drop'])).toBe(0)

    // Emoji survived the round-trip.
    expect(await countDocs('coll_a')).toContain('🎉 café 日本語')
  })
})
