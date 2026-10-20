import type { ElectronApplication } from '@playwright/test'

/** Only used by transfers running with disposable profiles and databases. */
export const prepareTransferTestApp = async (app: ElectronApplication): Promise<void> => {
  try {
    await app.firstWindow()
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    })
  } catch (error) {
    await closeTransferTestApp(app)
    throw error
  }
}

export const closeTransferTestApp = async (app?: ElectronApplication): Promise<void> => {
  if (!app) return
  // Failed cancellation assertions must not leave a hidden process or native
  // confirmation dialog running after Playwright's test timeout.
  const timeout = setTimeout(() => { app.process().kill('SIGKILL') }, 8000)
  try { await app.close() }
  finally { clearTimeout(timeout) }
}
