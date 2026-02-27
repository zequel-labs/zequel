import type { Page, Locator } from '@playwright/test'

export class ConnectionRailComponent {
  readonly page: Page
  readonly root: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.getByTestId('connection-rail')
  }

  item(index: number): Locator {
    return this.page.getByTestId(`connection-rail-item-${index}`)
  }

  get moveToWindowMenuItem(): Locator {
    return this.page.getByTestId('connection-rail-move-to-window')
  }

  get closeMenuItem(): Locator {
    return this.page.getByTestId('connection-rail-close')
  }

  get closeOthersMenuItem(): Locator {
    return this.page.getByTestId('connection-rail-close-others')
  }
}
