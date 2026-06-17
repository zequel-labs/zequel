import { DatabaseType } from '@main/types'
import type { BackupClient, RestoreClient } from './models'
import { PostgresBackupClient } from './backup-clients/postgresql'
import { MySqlBackupClient } from './backup-clients/mysql'
import { SqliteBackupClient } from './backup-clients/sqlite'
import { DuckdbBackupClient } from './backup-clients/duckdb'
import { ClickHouseBackupClient } from './backup-clients/clickhouse'
import { MongoBackupClient } from './backup-clients/mongodb'
import { RedisBackupClient } from './backup-clients/redis'
import { SqlServerBackupClient } from './backup-clients/sqlserver'
import { PostgresRestoreClient } from './restore-clients/postgresql'
import { MySqlRestoreClient } from './restore-clients/mysql'
import { SqliteRestoreClient } from './restore-clients/sqlite'
import { DuckdbRestoreClient } from './restore-clients/duckdb'
import { ClickHouseRestoreClient } from './restore-clients/clickhouse'
import { MongoRestoreClient } from './restore-clients/mongodb'
import { RedisRestoreClient } from './restore-clients/redis'
import { SqlServerRestoreClient } from './restore-clients/sqlserver'

export interface CommandClients {
  backup: BackupClient | null
  restore: RestoreClient | null
}

/**
 * Factory mapping a dialect to its backup/restore clients (mirrors Beekeeper's
 * `commandClientsFor`). Unknown dialects return `{ backup: null, restore: null }`.
 */
export const commandClientsFor = (dbType: DatabaseType): CommandClients => {
  switch (dbType) {
    case DatabaseType.PostgreSQL:
      return { backup: new PostgresBackupClient(), restore: new PostgresRestoreClient() }
    case DatabaseType.MySQL:
    case DatabaseType.MariaDB:
      return { backup: new MySqlBackupClient(), restore: new MySqlRestoreClient() }
    case DatabaseType.SQLite:
      return { backup: new SqliteBackupClient(), restore: new SqliteRestoreClient() }
    case DatabaseType.DuckDB:
      return { backup: new DuckdbBackupClient(), restore: new DuckdbRestoreClient() }
    case DatabaseType.ClickHouse:
      return { backup: new ClickHouseBackupClient(), restore: new ClickHouseRestoreClient() }
    case DatabaseType.MongoDB:
      return { backup: new MongoBackupClient(), restore: new MongoRestoreClient() }
    case DatabaseType.Redis:
      return { backup: new RedisBackupClient(), restore: new RedisRestoreClient() }
    case DatabaseType.SQLServer:
      return { backup: new SqlServerBackupClient(), restore: new SqlServerRestoreClient() }
    default:
      return { backup: null, restore: null }
  }
}
