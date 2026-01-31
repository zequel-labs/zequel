import { ipcMain } from 'electron'
import { checkForUpdates, downloadUpdate, installUpdate } from '../services/autoUpdater'

export const registerUpdaterHandlers = (): void => {
  ipcMain.handle('updater:check', async () => {
    await checkForUpdates()
  })

  ipcMain.handle('updater:download', async () => {
    await downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    installUpdate()
  })
}
