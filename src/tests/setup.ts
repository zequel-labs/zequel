// Global test setup
import { beforeAll, afterAll } from 'vitest'

// Environment variables for tests
export const testConfig = {
  mysql: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'laravel'
  },
  postgresql: {
    host: process.env.PG_HOST || '127.0.0.1',
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USERNAME || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'postgres'
  },
  sqlite: {
    filepath: process.env.SQLITE_PATH || ':memory:'
  }
}

// Global setup
beforeAll(() => {
  console.log('Starting test suite...')
})

// Global teardown
afterAll(() => {
  console.log('Test suite completed.')
})
