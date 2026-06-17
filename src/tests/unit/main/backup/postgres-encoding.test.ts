import { describe, it, expect } from 'vitest'
import { PostgresBackupClient } from '@main/services/backup/backup-clients/postgresql'
import { DatabaseType, type SavedConnection, type BackupConfig } from '@main/types'

const conn = {
  id: 'c1', name: 'pg', type: DatabaseType.PostgreSQL,
  host: '127.0.0.1', port: 5432, database: 'app', username: 'postgres',
  filepath: null, ssl: false, sslConfig: null, ssh: null, color: null,
  environment: null, folder: null, sortOrder: 0,
  createdAt: '', updatedAt: '', lastConnectedAt: null,
} as SavedConnection

const baseConfig = {
  connectionId: 'c1', entities: [], outputPath: '/tmp/b.sql',
  binaryPath: '/usr/bin/pg_dump', compress: false, customArgs: '',
} as Omit<BackupConfig, 'options'>

describe('PostgreSQL backup encoding default (full Unicode)', () => {
  it('defaults to UTF8', async () => {
    const config = { ...baseConfig, options: {} } as BackupConfig
    const spec = await new PostgresBackupClient().buildBackupSpec({ config, conn, password: null, host: '127.0.0.1', port: 5432 })
    expect(spec.args).toContain('--encoding=UTF8')
  })

  it('honors an explicit encoding override', async () => {
    const config = { ...baseConfig, options: { encoding: 'LATIN1' } } as BackupConfig
    const spec = await new PostgresBackupClient().buildBackupSpec({ config, conn, password: null, host: '127.0.0.1', port: 5432 })
    expect(spec.args).toContain('--encoding=LATIN1')
    expect(spec.args).not.toContain('--encoding=UTF8')
  })
})

describe('PostgreSQL backup format option', () => {
  it('defaults to plain format', async () => {
    const config = { ...baseConfig, options: {} } as BackupConfig
    const spec = await new PostgresBackupClient().buildBackupSpec({ config, conn, password: null, host: '127.0.0.1', port: 5432 })
    expect(spec.args).toContain('--format=plain')
  })

  it('uses custom format with native compression when selected', async () => {
    const config = { ...baseConfig, options: { format: 'custom', compression: 6 } } as BackupConfig
    const spec = await new PostgresBackupClient().buildBackupSpec({ config, conn, password: null, host: '127.0.0.1', port: 5432 })
    expect(spec.args).toContain('--format=custom')
    expect(spec.args).toContain('--compress=6')
  })
})
