import { describe, it, expect } from 'vitest'
import { MySqlBackupClient } from '@main/services/backup/backup-clients/mysql'
import { MySqlRestoreClient } from '@main/services/backup/restore-clients/mysql'
import { DatabaseType, type SavedConnection, type BackupConfig, type RestoreConfig } from '@main/types'

const conn = {
  id: 'c1', name: 'mysql', type: DatabaseType.MySQL,
  host: '127.0.0.1', port: 3306, database: 'app', username: 'root',
  filepath: null, ssl: false, sslConfig: null, ssh: null, color: null,
  environment: null, folder: null, sortOrder: 0,
  createdAt: '', updatedAt: '', lastConnectedAt: null,
} as SavedConnection

describe('MySQL backup charset default (emoji / 4-byte Unicode)', () => {
  it('defaults to utf8mb4 so emoji export correctly', async () => {
    const config = {
      connectionId: 'c1', entities: [], outputPath: '/tmp/b.sql',
      binaryPath: '/usr/bin/mysqldump', compress: false, customArgs: '', options: {},
    } as BackupConfig
    const spec = await new MySqlBackupClient().buildBackupSpec({ config, conn, password: null, host: '127.0.0.1', port: 3306 })
    expect(spec.args).toContain('--default-character-set=utf8mb4')
  })

  it('honors an explicit charset override', async () => {
    const config = {
      connectionId: 'c1', entities: [], outputPath: '/tmp/b.sql',
      binaryPath: '/usr/bin/mysqldump', compress: false, customArgs: '',
      options: { charset: 'latin1' } as unknown as Record<string, boolean>,
    } as BackupConfig
    const spec = await new MySqlBackupClient().buildBackupSpec({ config, conn, password: null, host: '127.0.0.1', port: 3306 })
    expect(spec.args).toContain('--default-character-set=latin1')
    expect(spec.args).not.toContain('--default-character-set=utf8mb4')
  })

  it('restore also defaults to utf8mb4', async () => {
    const config = {
      connectionId: 'c1', inputPath: '/tmp/b.sql',
      binaryPath: '/usr/bin/mysql', customArgs: '', options: {},
    } as RestoreConfig
    const spec = await new MySqlRestoreClient().buildRestoreSpec({ config, conn, password: null, host: '127.0.0.1', port: 3306 })
    expect(spec.args).toContain('--default-character-set=utf8mb4')
  })
})
