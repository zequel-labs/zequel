import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve } from 'path'

const MAIN_ENTRY = resolve(process.cwd(), 'out/main/index.js')

export const launchApp = async (): Promise<{ app: ElectronApplication; window: Page }> => {
  const app = await electron.launch({
    args: [MAIN_ENTRY, '--no-sandbox', '--disable-gpu'],
    env: { ...process.env, E2E: '1' },
  })
  const window = await app.firstWindow()

  // Log renderer console messages to stdout for CI debugging
  window.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Electron:renderer:error] ${msg.text()}`)
    }
  })

  await window.waitForLoadState('domcontentloaded')
  return { app, window }
}

export const closeApp = async (app: ElectronApplication): Promise<void> => {
  await app.close()
}
