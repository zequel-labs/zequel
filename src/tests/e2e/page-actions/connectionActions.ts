import type { Page } from '@playwright/test'
import { ConnectionFormComponent } from '../page-components/ConnectionForm'

interface ServerConnectionConfig {
  type: string
  host: string
  port: string
  username?: string
  password?: string
  database?: string
}

interface MongoConnectionConfig {
  type: 'MongoDB'
  uri: string
}

type ConnectionConfig = ServerConnectionConfig | MongoConnectionConfig

const isMongoConfig = (config: ConnectionConfig): config is MongoConnectionConfig => {
  return config.type === 'MongoDB'
}

// Map display type names to DatabaseType enum values used in data-testid
const TYPE_TO_ENUM: Record<string, string> = {
  PostgreSQL: 'postgresql',
  MySQL: 'mysql',
  MariaDB: 'mariadb',
  SQLite: 'sqlite',
  ClickHouse: 'clickhouse',
  MongoDB: 'mongodb',
  Redis: 'redis',
}

export const selectDatabaseType = async (page: Page, type: string): Promise<void> => {
  const form = new ConnectionFormComponent(page)
  await form.databaseTypeButton.click()
  await form.databaseTypeOption(TYPE_TO_ENUM[type]).click()
}

export const fillConnectionDetails = async (page: Page, config: ConnectionConfig): Promise<void> => {
  const form = new ConnectionFormComponent(page)

  if (isMongoConfig(config)) {
    await form.uriInput.fill(config.uri)
    return
  }

  await form.hostInput.fill(config.host)
  await form.portInput.fill(config.port)

  if (config.username) {
    await form.usernameInput.fill(config.username)
  }

  if (config.password) {
    await form.passwordInput.fill(config.password)
  }

  if (config.database) {
    await form.databaseInput.fill(config.database)
  }
}

export const testConnection = async (page: Page): Promise<void> => {
  const form = new ConnectionFormComponent(page)
  await form.testButton.click()
  await form.testSuccess.waitFor({ state: 'visible', timeout: 30_000 })
}

export const disableSSL = async (page: Page): Promise<void> => {
  const form = new ConnectionFormComponent(page)
  await form.sslSwitch.click()
}

export const connectToDatabase = async (page: Page): Promise<void> => {
  const form = new ConnectionFormComponent(page)
  await form.connectButton.click()
}
