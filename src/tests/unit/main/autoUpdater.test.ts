import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAutoUpdater, mockWebContents, mockGetAllWindows, mockSetUpdaterMenuState, mockSettingsService } = vi.hoisted(() => {
  const mockWebContents = { send: vi.fn() }
  const mockGetAllWindows = vi.fn()
  const mockSetUpdaterMenuState = vi.fn()
  const mockSettingsService = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }
  const mockAutoUpdater = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    channel: '' as string,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn()
  }
  return { mockAutoUpdater, mockWebContents, mockGetAllWindows, mockSetUpdaterMenuState, mockSettingsService }
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

vi.mock('@main/services/settings', () => ({
  settingsService: mockSettingsService
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
  checkForUpdatesFromMenu,
  downloadUpdate,
  installUpdate,
  getUpdateChannel,
  setUpdateChannel,
  UpdateStatus
} from '@main/services/autoUpdater'
import { UpdateChannel } from '@main/types'
import { BrowserWindow, dialog } from 'electron'
import { logger } from '@main/utils/logger'

describe('autoUpdater service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAutoUpdater.autoDownload = true
    mockAutoUpdater.autoInstallOnAppQuit = false
    mockAutoUpdater.allowPrerelease = false
    mockAutoUpdater.channel = ''
    mockSettingsService.get.mockReturnValue(null)
    // Reset channel state to stable default
    setUpdateChannel(UpdateChannel.Stable)
    vi.clearAllMocks()
    mockSettingsService.get.mockReturnValue(null)
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

  describe('user-initiated check event handlers', () => {
    const getHandler = (eventName: string): ((...args: unknown[]) => void) => {
      initAutoUpdater()
      const call = mockAutoUpdater.on.mock.calls.find(
        (c: [string, unknown]) => c[0] === eventName
      )
      return call[1] as (...args: unknown[]) => void
    }

    it('should set menu to Checking when user-initiated checking-for-update fires', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      await checkForUpdatesFromMenu()
      const handler = getHandler('checking-for-update')
      handler()

      expect(mockSetUpdaterMenuState).toHaveBeenCalledWith('Checking...', false)
    })

    it('should reset menu state when user-initiated update-available fires', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      await checkForUpdatesFromMenu()
      const handler = getHandler('update-available')
      handler({ version: '3.0.0' })

      expect(mockSetUpdaterMenuState).toHaveBeenCalledWith('Check for Updates...', true)
    })

    it('should show dialog when user-initiated update-not-available fires with focused window', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])
      const mockFocusedWindow = { webContents: mockWebContents }
      vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(mockFocusedWindow as unknown as Electron.BrowserWindow)

      await checkForUpdatesFromMenu()
      const handler = getHandler('update-not-available')
      handler()

      expect(mockSetUpdaterMenuState).toHaveBeenCalledWith('Check for Updates...', true)
      expect(dialog.showMessageBox).toHaveBeenCalledWith(mockFocusedWindow, {
        type: 'info',
        title: 'No Updates Available',
        message: 'You\'re up to date!',
        detail: 'Zequel 1.0.0 is the latest version.',
        buttons: ['OK'],
        defaultId: 0
      })
    })

    it('should fall back to first window when no focused window on update-not-available', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
      const mockWindow = { webContents: mockWebContents }
      mockGetAllWindows.mockReturnValue([mockWindow])
      vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(null as unknown as Electron.BrowserWindow)

      await checkForUpdatesFromMenu()
      const handler = getHandler('update-not-available')
      handler()

      expect(dialog.showMessageBox).toHaveBeenCalledWith(mockWindow, expect.objectContaining({
        type: 'info',
        title: 'No Updates Available'
      }))
    })

    it('should not show dialog when no windows available on update-not-available', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
      mockGetAllWindows.mockReturnValue([])
      vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(null as unknown as Electron.BrowserWindow)

      await checkForUpdatesFromMenu()
      const handler = getHandler('update-not-available')
      handler()

      expect(mockSetUpdaterMenuState).toHaveBeenCalledWith('Check for Updates...', true)
      expect(dialog.showMessageBox).not.toHaveBeenCalled()
    })

    it('should reset userInitiatedCheck on error event', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      await checkForUpdatesFromMenu()
      const errorHandler = getHandler('error')
      errorHandler(new Error('Update error'))

      expect(mockSetUpdaterMenuState).toHaveBeenCalledWith('Check for Updates...', true)

      // After error resets userInitiatedCheck, checking-for-update should NOT set menu
      vi.clearAllMocks()
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])
      const checkingHandler = getHandler('checking-for-update')
      checkingHandler()

      expect(mockSetUpdaterMenuState).not.toHaveBeenCalled()
    })
  })

  describe('checkForUpdatesFromMenu', () => {
    it('should call autoUpdater.checkForUpdates', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)

      await checkForUpdatesFromMenu()

      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
    })

    it('should reset userInitiatedCheck and log error on failure', async () => {
      mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error('connection refused'))
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])

      await checkForUpdatesFromMenu()

      expect(logger.error).toHaveBeenCalledWith('Failed to check for updates', expect.any(Error))

      // Verify userInitiatedCheck was reset by triggering checking-for-update
      // and confirming menu state is NOT updated (would only happen if userInitiatedCheck was true)
      const handler = (() => {
        initAutoUpdater()
        const call = mockAutoUpdater.on.mock.calls.find(
          (c: [string, unknown]) => c[0] === 'checking-for-update'
        )
        return call[1] as (...args: unknown[]) => void
      })()
      vi.clearAllMocks()
      mockGetAllWindows.mockReturnValue([{ webContents: mockWebContents }])
      handler()

      expect(mockSetUpdaterMenuState).not.toHaveBeenCalled()
    })

    it('should swallow errors without throwing', async () => {
      mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error('connection refused'))

      await expect(checkForUpdatesFromMenu()).resolves.toBeUndefined()
    })
  })

  describe('checkForUpdates', () => {
    it('should call autoUpdater.checkForUpdates', async () => {
      mockAutoUpdater.checkForUpdates.mockResolvedValue(undefined)

      await checkForUpdates()

      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled()
    })

    it('should log error on failure', async () => {
      mockAutoUpdater.checkForUpdates.mockRejectedValue(new Error('offline'))

      await checkForUpdates()

      expect(logger.error).toHaveBeenCalledWith('Failed to check for updates', expect.any(Error))
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

    it('should set menu to Downloading before starting download', async () => {
      mockAutoUpdater.downloadUpdate.mockResolvedValue(undefined)

      await downloadUpdate()

      expect(mockSetUpdaterMenuState).toHaveBeenCalledWith('Downloading...', false)
    })

    it('should reset menu state on download error', async () => {
      mockAutoUpdater.downloadUpdate.mockRejectedValue(new Error('disk full'))

      await downloadUpdate()

      expect(mockSetUpdaterMenuState).toHaveBeenCalledWith('Check for Updates...', true)
      expect(logger.error).toHaveBeenCalledWith('Failed to download update', expect.any(Error))
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

  describe('getUpdateChannel', () => {
    it('should return stable by default', () => {
      expect(getUpdateChannel()).toBe(UpdateChannel.Stable)
    })
  })

  describe('setUpdateChannel', () => {
    it('should set channel to beta with allowPrerelease true', () => {
      setUpdateChannel(UpdateChannel.Beta)

      expect(getUpdateChannel()).toBe(UpdateChannel.Beta)
      expect(mockAutoUpdater.channel).toBe('beta')
      expect(mockAutoUpdater.allowPrerelease).toBe(true)
      expect(mockSettingsService.set).toHaveBeenCalledWith('update_channel', 'beta')
    })

    it('should set channel to stable with allowPrerelease false', () => {
      setUpdateChannel(UpdateChannel.Beta)
      vi.clearAllMocks()

      setUpdateChannel(UpdateChannel.Stable)

      expect(getUpdateChannel()).toBe(UpdateChannel.Stable)
      expect(mockAutoUpdater.channel).toBe('stable')
      expect(mockAutoUpdater.allowPrerelease).toBe(false)
      expect(mockSettingsService.set).toHaveBeenCalledWith('update_channel', 'stable')
    })
  })

  describe('initAutoUpdater channel loading', () => {
    it('should load saved beta channel from settings', () => {
      mockSettingsService.get.mockReturnValue('beta')

      initAutoUpdater()

      expect(mockAutoUpdater.channel).toBe('beta')
      expect(mockAutoUpdater.allowPrerelease).toBe(true)
    })

    it('should load saved stable channel from settings', () => {
      mockSettingsService.get.mockReturnValue('stable')

      initAutoUpdater()

      expect(mockAutoUpdater.channel).toBe('stable')
      expect(mockAutoUpdater.allowPrerelease).toBe(false)
    })

    it('should default to stable when settings returns null', () => {
      mockSettingsService.get.mockReturnValue(null)

      initAutoUpdater()

      expect(mockAutoUpdater.channel).toBe('stable')
      expect(mockAutoUpdater.allowPrerelease).toBe(false)
    })

    it('should default to stable when settings returns invalid value', () => {
      mockSettingsService.get.mockReturnValue('nightly')

      initAutoUpdater()

      expect(mockAutoUpdater.channel).toBe('stable')
      expect(mockAutoUpdater.allowPrerelease).toBe(false)
    })
  })
})
