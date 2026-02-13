import type { Page, Locator } from '@playwright/test'

export class ConnectionFormComponent {
  readonly page: Page

  // Database type combobox
  readonly databaseTypeButton: Locator

  // Server fields
  readonly hostInput: Locator
  readonly portInput: Locator
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly databaseInput: Locator

  // SQLite-specific
  readonly filepathInput: Locator

  // MongoDB-specific
  readonly uriInput: Locator

  // SSL
  readonly sslSwitch: Locator

  // SQL Server
  readonly trustCertCheckbox: Locator

  // Action buttons
  readonly testButton: Locator
  readonly connectButton: Locator

  // Test result indicators
  readonly testSuccess: Locator
  readonly testError: Locator

  constructor(page: Page) {
    this.page = page

    this.databaseTypeButton = page.getByTestId('database-type-trigger')

    this.hostInput = page.getByTestId('connection-host')
    this.portInput = page.getByTestId('connection-port')
    this.usernameInput = page.getByTestId('connection-username')
    this.passwordInput = page.getByTestId('connection-password')
    this.databaseInput = page.getByTestId('connection-database')

    this.filepathInput = page.getByTestId('connection-filepath')

    this.uriInput = page.getByTestId('connection-uri')

    this.sslSwitch = page.getByTestId('connection-ssl-switch')

    this.trustCertCheckbox = page.getByTestId('connection-trust-cert')

    this.testButton = page.getByTestId('connection-test-btn')
    this.connectButton = page.getByTestId('connection-connect-btn')

    this.testSuccess = page.getByTestId('connection-test-success')
    this.testError = page.getByTestId('connection-test-error')
  }

  databaseTypeOption(type: string): Locator {
    return this.page.getByTestId(`database-type-option-${type}`)
  }
}
