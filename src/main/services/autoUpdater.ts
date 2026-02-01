import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import { logger } from '../utils/logger'

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
  })

  autoUpdater.on('update-available', (info) => {
    logger.info(`Update available: ${info.version}`)
    sendStatusToRenderer({ status: UpdateStatus.Available, version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    logger.info('Update not available')
    sendStatusToRenderer({ status: UpdateStatus.NotAvailable })
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
  })

  autoUpdater.on('error', (error) => {
    logger.error('Auto-updater error', error)
    sendStatusToRenderer({ status: UpdateStatus.Error, error: error.message })
  })
}

export const checkForUpdates = async (): Promise<void> => {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    logger.error('Failed to check for updates', error)
  }
}

export const downloadUpdate = async (): Promise<void> => {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    logger.error('Failed to download update', error)
  }
}

export const installUpdate = (): void => {
  autoUpdater.quitAndInstall()
}
