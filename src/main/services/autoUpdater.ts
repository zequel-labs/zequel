import { autoUpdater } from 'electron-updater'
import { BrowserWindow, dialog, app } from 'electron'
import { logger } from '../utils/logger'
import { setUpdaterMenuState } from '../menu'

export enum UpdateStatus {
  Idle = 'idle',
  Checking = 'checking',
  Available = 'available',
  NotAvailable = 'not-available',
  Downloading = 'downloading',
  Downloaded = 'downloaded',
  Error = 'error'
}

export interface UpdateStatusEvent {
  status: UpdateStatus
  version?: string
  progress?: number
  error?: string
}

let userInitiatedCheck = false
const DEFAULT_UPDATER_LABEL = 'Check for Updates...'

const sendStatusToRenderer = (event: UpdateStatusEvent): void => {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('updater:status', event)
  }
}

export const initAutoUpdater = (): void => {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = true

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...')
    sendStatusToRenderer({ status: UpdateStatus.Checking })
    if (userInitiatedCheck) {
      setUpdaterMenuState('Checking...', false)
    }
  })

  autoUpdater.on('update-available', (info) => {
    logger.info(`Update available: ${info.version}`)
    sendStatusToRenderer({ status: UpdateStatus.Available, version: info.version })
    if (userInitiatedCheck) {
      userInitiatedCheck = false
      setUpdaterMenuState(DEFAULT_UPDATER_LABEL, true)
    }
  })

  autoUpdater.on('update-not-available', () => {
    logger.info('Update not available')
    sendStatusToRenderer({ status: UpdateStatus.NotAvailable })
    if (userInitiatedCheck) {
      userInitiatedCheck = false
      setUpdaterMenuState(DEFAULT_UPDATER_LABEL, true)
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (win) {
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'No Updates Available',
          message: 'You\'re up to date!',
          detail: `Zequel ${app.getVersion()} is the latest version.`,
          buttons: ['OK'],
          defaultId: 0
        })
      }
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    logger.info(`Download progress: ${Math.round(progress.percent)}%`)
    sendStatusToRenderer({
      status: UpdateStatus.Downloading,
      progress: progress.percent
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`Update downloaded: ${info.version}`)
    sendStatusToRenderer({ status: UpdateStatus.Downloaded, version: info.version })
    setUpdaterMenuState(DEFAULT_UPDATER_LABEL, true)
  })

  autoUpdater.on('error', (error) => {
    logger.error('Auto-updater error', error)
    sendStatusToRenderer({ status: UpdateStatus.Error, error: error.message })
    userInitiatedCheck = false
    setUpdaterMenuState(DEFAULT_UPDATER_LABEL, true)
  })
}

export const checkForUpdates = async (): Promise<void> => {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    logger.error('Failed to check for updates', error)
  }
}

export const checkForUpdatesFromMenu = async (): Promise<void> => {
  userInitiatedCheck = true
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    userInitiatedCheck = false
    logger.error('Failed to check for updates', error)
  }
}

export const downloadUpdate = async (): Promise<void> => {
  try {
    setUpdaterMenuState('Downloading...', false)
    await autoUpdater.downloadUpdate()
  } catch (error) {
    setUpdaterMenuState(DEFAULT_UPDATER_LABEL, true)
    logger.error('Failed to download update', error)
  }
}

export const installUpdate = (): void => {
  autoUpdater.quitAndInstall()
}
