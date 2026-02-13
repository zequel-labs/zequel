import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { userActions } from '@e2e/page-actions'
import { postgresConfig } from '@e2e/config/postgres'
import { mysqlConfig } from '@e2e/config/mysql'
import { mariadbConfig } from '@e2e/config/mariadb'
import { sqliteConfig } from '@e2e/config/sqlite'
import { clickhouseConfig } from '@e2e/config/clickhouse'
import { mongodbConfig } from '@e2e/config/mongodb'
import { redisConfig } from '@e2e/config/redis'
import { duckdbConfig } from '@e2e/config/duckdb'
import { sqlserverConfig } from '@e2e/config/sqlserver'

// Mirrors the app's DatabaseType enum (src/renderer/types/connection.ts).
// E2E tests can't import app types directly, so we maintain a local copy.
export enum DatabaseType {
  PostgreSQL = 'postgresql',
  MySQL = 'mysql',
  MariaDB = 'mariadb',
  SQLite = 'sqlite',
  ClickHouse = 'clickhouse',
  MongoDB = 'mongodb',
  Redis = 'redis',
  DuckDB = 'duckdb',
  SQLServer = 'sqlserver',
}

// DbName is the shorthand key used in tests for readability
type DbName = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'clickhouse' | 'mongodb' | 'redis' | 'duckdb' | 'sqlserver'

interface DbConfigEntry {
  config: Record<string, unknown>
  type: DatabaseType
  needsSSLOff?: boolean
  needsTrustCert?: boolean
}

const DB_CONFIGS: Record<DbName, DbConfigEntry> = {
  postgres: { config: postgresConfig, type: DatabaseType.PostgreSQL },
  mysql: { config: mysqlConfig, type: DatabaseType.MySQL },
  mariadb: { config: mariadbConfig, type: DatabaseType.MariaDB },
  sqlite: { config: sqliteConfig, type: DatabaseType.SQLite },
  clickhouse: { config: clickhouseConfig, type: DatabaseType.ClickHouse, needsSSLOff: true },
  mongodb: { config: mongodbConfig, type: DatabaseType.MongoDB },
  redis: { config: redisConfig, type: DatabaseType.Redis },
  duckdb: { config: duckdbConfig, type: DatabaseType.DuckDB },
  sqlserver: { config: sqlserverConfig, type: DatabaseType.SQLServer, needsTrustCert: true },
}

export const connectTo = async (page: Page, db: DbName): Promise<ReturnType<typeof userActions>> => {
  const actions = userActions(page)
  const { config, type, needsSSLOff, needsTrustCert } = DB_CONFIGS[db]

  await actions.selectDatabaseType(config.type as string)
  await actions.fillConnectionDetails(config as Parameters<typeof actions.fillConnectionDetails>[0])
  if (needsSSLOff) {
    await actions.disableSSL()
  }
  if (needsTrustCert) {
    await actions.enableTrustServerCertificate()
  }
  await actions.connectToDatabase()

  // Wait for sidebar to appear (connection successful)
  await expect(page.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })

  // PostgreSQL shows schema folders (public, information_schema, pg_catalog) collapsed.
  // Expand the "public" schema so that table test IDs become visible.
  if (type === DatabaseType.PostgreSQL) {
    const publicSchema = page.locator('text=public').first()
    await expect(publicSchema).toBeVisible({ timeout: 10_000 })
    await publicSchema.click()
    // Wait for tables to load inside the expanded schema
    await expect(page.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })
  }

  // SQL Server shows schema folders (dbo, reporting, etc.) collapsed.
  // Expand "dbo" so that table test IDs become visible.
  if (type === DatabaseType.SQLServer) {
    const dboSchema = page.locator('text=dbo').first()
    await expect(dboSchema).toBeVisible({ timeout: 10_000 })
    await dboSchema.click()
    await expect(page.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })
  }

  return actions
}
