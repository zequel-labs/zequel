import { ipcMain } from 'electron'
import { checkForUpdates, downloadUpdate, installUpdate, getUpdateChannel, setUpdateChannel } from '../services/autoUpdater'
import { UpdateChannel } from '../types'

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

  ipcMain.handle('updater:getChannel', () => getUpdateChannel())

  ipcMain.handle('updater:setChannel', (_, channel: string) => {
    setUpdateChannel(channel as UpdateChannel)
  })
}
