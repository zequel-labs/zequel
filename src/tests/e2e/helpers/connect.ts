import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { userActions } from '../page-actions'
import { postgresConfig } from '../config/postgres'
import { mysqlConfig } from '../config/mysql'
import { mariadbConfig } from '../config/mariadb'
import { sqliteConfig } from '../config/sqlite'
import { clickhouseConfig } from '../config/clickhouse'
import { mongodbConfig } from '../config/mongodb'
import { redisConfig } from '../config/redis'

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
}

// DbName is the shorthand key used in tests for readability
type DbName = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'clickhouse' | 'mongodb' | 'redis'

interface DbConfigEntry {
  config: Record<string, unknown>
  type: DatabaseType
  needsSSLOff?: boolean
}

const DB_CONFIGS: Record<DbName, DbConfigEntry> = {
  postgres: { config: postgresConfig, type: DatabaseType.PostgreSQL },
  mysql: { config: mysqlConfig, type: DatabaseType.MySQL },
  mariadb: { config: mariadbConfig, type: DatabaseType.MariaDB },
  sqlite: { config: sqliteConfig, type: DatabaseType.SQLite },
  clickhouse: { config: clickhouseConfig, type: DatabaseType.ClickHouse, needsSSLOff: true },
  mongodb: { config: mongodbConfig, type: DatabaseType.MongoDB },
  redis: { config: redisConfig, type: DatabaseType.Redis },
}

export const connectTo = async (page: Page, db: DbName): Promise<ReturnType<typeof userActions>> => {
  const actions = userActions(page)
  const { config, type, needsSSLOff } = DB_CONFIGS[db]

  await actions.selectDatabaseType(config.type as string)
  await actions.fillConnectionDetails(config as Parameters<typeof actions.fillConnectionDetails>[0])
  if (needsSSLOff) {
    await actions.disableSSL()
  }
  await actions.connectToDatabase()

  // Wait for sidebar to appear (connection successful).
  // If it doesn't appear, check for an error toast to provide a better diagnostic.
  const sidebar = page.getByTestId('sidebar-tab-items')
  const errorToast = page.locator('.sonner-toast[data-type="error"]')

  const result = await Promise.race([
    sidebar.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'sidebar' as const),
    errorToast.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'error' as const),
  ])

  if (result === 'error') {
    const toastText = await errorToast.textContent()
    throw new Error(`Connection to ${db} failed with error: ${toastText}`)
  }

  // PostgreSQL shows schema folders (public, information_schema, pg_catalog) collapsed.
  // Expand the "public" schema so that table test IDs become visible.
  if (type === DatabaseType.PostgreSQL) {
    const publicSchema = page.locator('text=public').first()
    await expect(publicSchema).toBeVisible({ timeout: 10_000 })
    await publicSchema.click()
    // Wait for tables to load inside the expanded schema
    await expect(page.getByTestId('sidebar-table-customers')).toBeVisible({ timeout: 15_000 })
  }

  return actions
}
