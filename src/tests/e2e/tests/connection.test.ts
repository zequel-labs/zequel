import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'
import { userActions } from '../page-actions'
import { postgresConfig } from '../config/postgres'
import { mysqlConfig } from '../config/mysql'
import { mariadbConfig } from '../config/mariadb'
import { mongodbConfig } from '../config/mongodb'
import { clickhouseConfig } from '../config/clickhouse'
import { redisConfig } from '../config/redis'

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
})
