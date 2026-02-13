import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '@e2e/helpers/app'
import { userActions } from '@e2e/page-actions'
import { postgresConfig } from '@e2e/config/postgres'
import { mysqlConfig } from '@e2e/config/mysql'
import { mariadbConfig } from '@e2e/config/mariadb'
import { mongodbConfig } from '@e2e/config/mongodb'
import { duckdbConfig } from '@e2e/config/duckdb'
import { clickhouseConfig } from '@e2e/config/clickhouse'
import { redisConfig } from '@e2e/config/redis'
import { sqliteConfig } from '@e2e/config/sqlite'
import { sqlserverConfig } from '@e2e/config/sqlserver'

let app: ElectronApplication
let window: Page

test.describe('Database Connections', () => {
  test.beforeEach(async () => {
    const launched = await launchApp()
    app = launched.app
    window = launched.window
  })

  test.afterEach(async () => {
    await closeApp(app)
  })

  const assertConnected = async (page: Page): Promise<void> => {
    // After connecting, the app switches from HomeView to the connected layout
    // which contains the Sidebar with Items/Queries/History tabs
    await expect(page.getByTestId('sidebar-tab-items')).toBeVisible({ timeout: 30_000 })
  }

  test('connect to PostgreSQL', async () => {
    const actions = userActions(window)
    await actions.selectDatabaseType(postgresConfig.type)
    await actions.fillConnectionDetails(postgresConfig)
    await actions.connectToDatabase()
    await assertConnected(window)
  })

  test('connect to MySQL', async () => {
    const actions = userActions(window)
    await actions.selectDatabaseType(mysqlConfig.type)
    await actions.fillConnectionDetails(mysqlConfig)
    await actions.connectToDatabase()
    await assertConnected(window)
  })

  test('connect to MariaDB', async () => {
    const actions = userActions(window)
    await actions.selectDatabaseType(mariadbConfig.type)
    await actions.fillConnectionDetails(mariadbConfig)
    await actions.connectToDatabase()
    await assertConnected(window)
  })

  test('connect to MongoDB', async () => {
    const actions = userActions(window)
    await actions.selectDatabaseType(mongodbConfig.type)
    await actions.fillConnectionDetails(mongodbConfig)
    await actions.connectToDatabase()
    await assertConnected(window)
  })

  test('connect to SQLite', async () => {
    const actions = userActions(window)
    await actions.selectDatabaseType(sqliteConfig.type)
    await actions.fillConnectionDetails(sqliteConfig)
    await actions.connectToDatabase()
    await assertConnected(window)
  })

  test('connect to DuckDB', async () => {
    const actions = userActions(window)
    await actions.selectDatabaseType(duckdbConfig.type)
    await actions.fillConnectionDetails(duckdbConfig)
    await actions.connectToDatabase()
    await assertConnected(window)
  })

  test('connect to ClickHouse', async () => {
    const actions = userActions(window)
    await actions.selectDatabaseType(clickhouseConfig.type)
    await actions.fillConnectionDetails(clickhouseConfig)
    await actions.disableSSL()
    await actions.connectToDatabase()
    await assertConnected(window)
  })

  test('connect to Redis', async () => {
    const actions = userActions(window)
    await actions.selectDatabaseType(redisConfig.type)
    await actions.fillConnectionDetails(redisConfig)
    await actions.connectToDatabase()
    await assertConnected(window)
  })

  test('connect to SQL Server', async () => {
    const actions = userActions(window)
    await actions.selectDatabaseType(sqlserverConfig.type)
    await actions.fillConnectionDetails(sqlserverConfig)
    await actions.enableTrustServerCertificate()
    await actions.connectToDatabase()
    await assertConnected(window)
  })
})