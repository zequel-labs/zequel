import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve } from 'path'

const MAIN_ENTRY = resolve(__dirname, '../../../../out/main/index.js')

export const launchApp = async (): Promise<{ app: ElectronApplication; window: Page }> => {
  const app = await electron.launch({
    args: [MAIN_ENTRY],
    env: { ...process.env, E2E: '1' },
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  return { app, window }
}

export const closeApp = async (app: ElectronApplication): Promise<void> => {
  await app.close()
}
