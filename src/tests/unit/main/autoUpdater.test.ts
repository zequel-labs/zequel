import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAutoUpdater, mockWebContents, mockGetAllWindows, mockSetUpdaterMenuState } = vi.hoisted(() => {
  const mockWebContents = { send: vi.fn() }
  const mockGetAllWindows = vi.fn()
  const mockSetUpdaterMenuState = vi.fn()
  const mockAutoUpdater = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn()
  }
  return { mockAutoUpdater, mockWebContents, mockGetAllWindows, mockSetUpdaterMenuState }
})

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: mockGetAllWindows,
    getFocusedWindow: vi.fn()
  },
  dialog: {
    showMessageBox: vi.fn()
  },
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    name: 'Zequel'
  }
}))

vi.mock('@main/menu', () => ({
  setUpdaterMenuState: mockSetUpdaterMenuState
}))

vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

import {
  initAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  UpdateStatus
} from '@main/services/autoUpdater'

describe('autoUpdater service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAutoUpdater.autoDownload = true
    mockAutoUpdater.autoInstallOnAppQuit = false
  })

  describe('initAutoUpdater', () => {
    it('should set autoDownload to false', () => {
      initAutoUpdater()
      expect(mockAutoUpdater.autoDownload).toBe(false)
    })

    it('should set autoInstallOnAppQuit to true', () => {
      initAutoUpdater()
      expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true)
    })

    it('should register all 6 event handlers', () => {
      initAutoUpdater()
      const events = mockAutoUpdater.on.mock.calls.map(
        (call: [string, unknown]) => call[0]
      )
      expect(events).toEqual([
        'checking-for-update',
        'update-available',
        'update-not-available',
        'download-progress',
        'update-downloaded',
        'error'
      ])
    })
  })

  describe('event handlers', () => {
    const getHandler = (eventName: string): ((...args: unknown[]) => void) => {
      initAutoUpdater()
      const call = mockAutoUpdater.on.mock.calls.find(
        (c: [string, unknown]) => c[0] === eventName
      )
      return call[1] as (...args: unknown[]) => void
    }

    it('should send Checking status on checking-for-update', () => {
      const handler = getHandler('checking-for-update')
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      handler()

      expect(mockWebContents.send).toHaveBeenCalledWith('updater:status', {
        status: UpdateStatus.Checking
      })
    })

    it('should send Available status with version on update-available', () => {
      const handler = getHandler('update-available')
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      handler({ version: '2.0.0' })

      expect(mockWebContents.send).toHaveBeenCalledWith('updater:status', {
        status: UpdateStatus.Available,
        version: '2.0.0'
      })
    })

    it('should send NotAvailable status on update-not-available', () => {
      const handler = getHandler('update-not-available')
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      handler()

      expect(mockWebContents.send).toHaveBeenCalledWith('updater:status', {
        status: UpdateStatus.NotAvailable
      })
    })

    it('should send Downloading status with progress on download-progress', () => {
      const handler = getHandler('download-progress')
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      handler({ percent: 45.5 })

      expect(mockWebContents.send).toHaveBeenCalledWith('updater:status', {
        status: UpdateStatus.Downloading,
        progress: 45.5
      })
    })

    it('should send Downloaded status with version on update-downloaded', () => {
      const handler = getHandler('update-downloaded')
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      handler({ version: '2.0.0' })

      expect(mockWebContents.send).toHaveBeenCalledWith('updater:status', {
        status: UpdateStatus.Downloaded,
        version: '2.0.0'
      })
    })

    it('should send Error status with message on error', () => {
      const handler = getHandler('error')
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      handler(new Error('Network failed'))

      expect(mockWebContents.send).toHaveBeenCalledWith('updater:status', {
        status: UpdateStatus.Error,
        error: 'Network failed'
      })
    })

    it('should broadcast status to multiple windows', () => {
      const handler = getHandler('checking-for-update')
      const webContents1 = { send: vi.fn() }
      const webContents2 = { send: vi.fn() }
      mockGetAllWindows.mockReturnValue([
        { webContents: webContents1 },
        { webContents: webContents2 }
      ])

      handler()

      expect(webContents1.send).toHaveBeenCalledWith('updater:status', {
        status: UpdateStatus.Checking
      })
      expect(webContents2.send).toHaveBeenCalledWith('updater:status', {
        status: UpdateStatus.Checking
      })
    })

    it('should handle zero windows without error', () => {
      const handler = getHandler('checking-for-update')
      mockGetAllWindows.mockReturnValue([])

      expect(() => handler()).not.toThrow()
    })
  })

  describe('checkForUpdates', () => {
    it('should call autoUpdater.checkForUpdates', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)

      await checkForUpdates()

      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
    })

    it('should swallow errors without throwing', async () => {
      mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error('offline'))

      await expect(checkForUpdates()).resolves.toBeUndefined()
    })
  })

  describe('downloadUpdate', () => {
    it('should call autoUpdater.downloadUpdate', async () => {
      mockAutoUpdater.downloadUpdate.mockResolvedValue(undefined)

      await downloadUpdate()

      expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled()
    })

    it('should swallow errors without throwing', async () => {
      mockAutoUpdater.downloadUpdate.mockRejectedValue(new Error('disk full'))

      await expect(downloadUpdate()).resolves.toBeUndefined()
    })
  })

  describe('installUpdate', () => {
    it('should call autoUpdater.quitAndInstall', () => {
      installUpdate()

      expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalled()
    })
  })
})
