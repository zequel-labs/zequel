import type { Page } from '@playwright/test'
import {
  selectDatabaseType,
  fillConnectionDetails,
  testConnection,
  disableSSL,
  connectToDatabase,
} from './connectionActions'

export const userActions = (page: Page) => ({
  selectDatabaseType: (type: string) => selectDatabaseType(page, type),
  fillConnectionDetails: (config: Parameters<typeof fillConnectionDetails>[1]) =>
    fillConnectionDetails(page, config),
  testConnection: () => testConnection(page),
  disableSSL: () => disableSSL(page),
  connectToDatabase: () => connectToDatabase(page),
})

export type UserActions = ReturnType<typeof userActions>
